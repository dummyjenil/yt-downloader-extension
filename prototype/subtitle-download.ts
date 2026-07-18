import * as fs from "fs";
import * as path from "path";

const VIDEO_ID = "jHscXbYZ_Ow";
const OUTPUT_DIR = __dirname;
const OUTPUT_FILE = path.join(OUTPUT_DIR, "output.srt");

interface CaptionTrack {
  baseUrl: string;
  name: string;
  code: string;
}

function formatTime(ms: number): string {
  if (ms < 0) ms = 0;
  const milliseconds = Math.floor(ms % 1000);
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const pad = (n: number, width: number = 2) => String(n).padStart(width, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
}

function jsonToWordSrt(data: any): string {
  const subtitles: any[] = [];
  let index = 1;

  const events = data.events || [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (!event.segs) {
      continue;
    }

    const event_start = event.tStartMs || 0;
    let event_end: number;

    if (event.dDurationMs !== undefined) {
      event_end = event_start + event.dDurationMs;
    } else {
      let foundEnd = null;
      for (let j = i + 1; j < events.length; j++) {
        if (events[j].tStartMs !== undefined) {
          foundEnd = events[j].tStartMs;
          break;
        }
      }
      event_end = foundEnd !== null ? foundEnd : (event_start + 1000);
    }

    // Extract valid words
    const words: { text: string; start_ms: number }[] = [];
    for (const seg of event.segs) {
      const text = (seg.utf8 || "").trim();
      if (!text || text === "\n") {
        continue;
      }
      const start_ms = event_start + (seg.tOffsetMs || 0);
      words.push({ text, start_ms });
    }

    if (words.length === 0) {
      continue;
    }

    // Create one subtitle per word
    for (let k = 0; k < words.length; k++) {
      const { text: word, start_ms } = words[k];
      let end_ms: number;

      if (k < words.length - 1) {
        end_ms = words[k + 1].start_ms;
      } else {
        end_ms = event_end;
      }

      if (end_ms <= start_ms) {
        end_ms = start_ms + 50;
      }

      subtitles.push({
        index: index,
        start: formatTime(start_ms),
        end: formatTime(end_ms),
        content: word
      });
      index++;
    }
  }

  return subtitles.map(sub => `${sub.index}\n${sub.start} --> ${sub.end}\n${sub.content}`).join("\n\n") + "\n";
}

async function getApiKey(): Promise<string> {
  try {
    const response = await fetch("https://www.youtube.com/app_shell");
    if (!response.ok) {
      throw new Error(`Failed to fetch app_shell: ${response.status}`);
    }
    const text = await response.text();
    const match = text.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/) || 
                  text.match(/INNERTUBE_API_KEY":"([^"]+)"/) || 
                  text.match(/INNERTUBE_API_KEY":"(.*?)","?/);
    if (match && match[1]) {
      return match[1];
    }
    throw new Error("INNERTUBE_API_KEY not found in app_shell response");
  } catch (error) {
    console.warn("Failed to retrieve InnerTube API key dynamically, using fallback:", error);
    return "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
  }
}

async function fetchVisitorData(videoId: string, apiKey: string): Promise<string> {
  const url = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false&ext_request=true`;
  const payload = {
    videoId: videoId,
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20251021.01.00",
        osName: "Windows",
        osVersion: "10.0",
        platform: "DESKTOP"
      }
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "x-youtube-client-name": "1",
      "x-youtube-client-version": "2.20251021.01.00"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch visitor data. Status: ${response.status}`);
  }

  const data: any = await response.json();
  const visitorData = data.responseContext?.visitorData;
  if (visitorData) {
    return visitorData;
  }

  const trackingParams = data.responseContext?.serviceTrackingParams || [];
  for (const item of trackingParams) {
    const params = item.params || [];
    const found = params.find((p: any) => p.key === "visitor_data");
    if (found && found.value) {
      return found.value;
    }
  }

  throw new Error("Unable to obtain visitorData from InnerTube API");
}

async function fetchPlayerResponse(videoId: string, apiKey: string, visitorData: string, clientName: "WEB" | "ANDROID_VR" | "TV") {
  const url = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false&ext_request=true`;
  
  let payloadContext: any;
  let headers: Record<string, string>;

  if (clientName === "WEB") {
    payloadContext = {
      client: {
        clientName: "WEB",
        clientVersion: "2.20251021.01.00",
        osName: "Windows",
        osVersion: "10.0",
        platform: "DESKTOP",
        visitorData: visitorData || undefined
      }
    };
    headers = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "x-youtube-client-name": "1",
      "x-youtube-client-version": "2.20251021.01.00"
    };
  } else if (clientName === "ANDROID_VR") {
    payloadContext = {
      client: {
        clientName: "ANDROID_VR",
        clientVersion: "1.60.19",
        deviceMake: "Oculus",
        deviceModel: "Quest 3",
        osName: "Android",
        osVersion: "12L",
        androidSdkVersion: "32",
        visitorData: visitorData || undefined
      }
    };
    headers = {
      "Content-Type": "application/json",
      "User-Agent": "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
      "x-youtube-client-name": "28",
      "x-youtube-client-version": "1.60.19"
    };
  } else {
    payloadContext = {
      client: {
        clientName: "TVHTML5",
        clientVersion: "7.20240813.07.00",
        platform: "TV",
        visitorData: visitorData || undefined
      }
    };
    headers = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (ChromiumStylePlatform; Widevine) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "x-youtube-client-name": "7",
      "x-youtube-client-version": "7.20240813.07.00"
    };
  }

  const payload = {
    videoId: videoId,
    contentCheckOk: true,
    context: payloadContext
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP Status ${response.status}`);
  }

  return response.json();
}

async function main() {
  console.log(`Starting Subtitle Download Prototype for Video ID: ${VIDEO_ID}...`);
  try {
    const apiKey = await getApiKey();
    console.log(`Fetched InnerTube API Key: ${apiKey}`);

    const visitorData = await fetchVisitorData(VIDEO_ID, apiKey);
    console.log(`Fetched Visitor Data successfully.`);

    const clients: Array<"WEB" | "ANDROID_VR" | "TV"> = ["WEB", "ANDROID_VR", "TV"];
    let playerResponse: any = null;

    for (const client of clients) {
      try {
        console.log(`Attempting client: ${client}...`);
        const res = await fetchPlayerResponse(VIDEO_ID, apiKey, visitorData, client);
        console.log(`- Top-level keys: [${Object.keys(res).join(", ")}]`);
        
        const status = res.playabilityStatus?.status || "UNKNOWN";
        console.log(`- PlayabilityStatus: "${status}"`);
        
        if (res.captions) {
          playerResponse = res;
          console.log(`- Found "captions" key in this response!`);
          break;
        } else {
          console.log(`- No "captions" key found in this response.`);
        }
      } catch (err: any) {
        console.warn(`Client ${client} failed: ${err.message}`);
      }
    }

    if (!playerResponse) {
      console.error("Could not find captions in any client responses.");
      return;
    }

    const captions = playerResponse.captions || {};
    console.log(`- Captions keys: [${Object.keys(captions).join(", ")}]`);

    const playerCaptionsTracklistRenderer = captions.playerCaptionsTracklistRenderer || {};
    console.log(`- playerCaptionsTracklistRenderer keys: [${Object.keys(playerCaptionsTracklistRenderer).join(", ")}]`);

    const rawTracks = playerCaptionsTracklistRenderer.captionTracks || [];
    console.log(`Found ${rawTracks.length} raw caption tracks.`);

    if (rawTracks.length === 0) {
      console.log("No caption tracks found for this video.");
      return;
    }

    const parsedTracks: CaptionTrack[] = rawTracks.map((track: any) => {
      let name = "";
      const nameDict = track.name || {};
      if ("simpleText" in nameDict) {
        name = nameDict.simpleText;
      } else if (Array.isArray(nameDict.runs)) {
        for (const el of nameDict.runs) {
          if (el && typeof el.text === "string") {
            name += el.text;
          }
        }
      }
      
      let code = track.vssId || track.languageCode || "";
      code = code.replace(/^\.+|\.+$/g, "");

      return {
        baseUrl: track.baseUrl,
        name,
        code
      };
    });

    console.log("--- Native Caption Tracks Available ---");
    for (const track of parsedTracks) {
      console.log(`- Code: "${track.code}", Name: "${track.name}"`);
    }
    console.log("---------------------------------------");

    // Download the first available track
    const targetTrack = parsedTracks[0];
    console.log(`Selected track: "${targetTrack.name}" (${targetTrack.code})`);

    let jsonUrl = targetTrack.baseUrl;
    if (jsonUrl.includes('fmt=')) {
      jsonUrl = jsonUrl.replace('fmt=srv3', 'fmt=json3');
    } else {
      jsonUrl = `${jsonUrl}&fmt=json3`;
    }

    console.log("Fetching JSON caption track data...");
    const captionResponse = await fetch(jsonUrl);
    if (!captionResponse.ok) {
      throw new Error(`Failed to fetch captions. Status: ${captionResponse.status}`);
    }

    const jsonCaptions = await captionResponse.json();
    console.log("Caption track JSON loaded.");
    console.log(`- wireMagic: "${jsonCaptions.wireMagic}"`);
    console.log(`- Events count: ${jsonCaptions.events?.length || 0}`);

    console.log("Parsing JSON captions to Word-level SRT...");
    const srtContent = jsonToWordSrt(jsonCaptions);

    console.log(`Writing SRT file to: ${OUTPUT_FILE}`);
    fs.writeFileSync(OUTPUT_FILE, srtContent, "utf8");

    const stats = fs.statSync(OUTPUT_FILE);
    console.log("--- Conversion Verification Summary ---");
    console.log(`- Output File Size: ${stats.size} bytes`);
    console.log(`- SRT lines count estimate: ${srtContent.split("\n").length}`);
    console.log(`- Success! Captions downloaded and parsed successfully.`);
    console.log("----------------------------------------");

  } catch (error: any) {
    console.error("An error occurred during prototype execution:", error.stack || error.message || error);
  }
}

main();
