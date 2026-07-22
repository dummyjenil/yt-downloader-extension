import { setDNRHeadersForClient } from "./dnr";
import { decipherSignature } from "../decipherer";

function parseFormatUrl(f: any, jsCode: string = ""): string | undefined {
  if (f.url) return f.url;
  const cipherStr = f.signatureCipher || f.cipher;
  if (!cipherStr) return undefined;
  
  try {
    const params = new URLSearchParams(cipherStr);
    const rawUrl = params.get("url");
    if (!rawUrl) return undefined;

    const s = params.get("s");
    const sp = params.get("sp") || "sig";

    if (s) {
      const deciphered = decipherSignature(s, jsCode);
      return `${rawUrl}&${sp}=${encodeURIComponent(deciphered)}`;
    }
    return rawUrl;
  } catch (err) {
    console.warn("Failed to parse format cipher:", err);
    return undefined;
  }
}

let cachedPlayerJsCode: string | null = null;

export async function getPlayerJsCode(): Promise<string> {
  if (cachedPlayerJsCode) return cachedPlayerJsCode;
  try {
    const watchRes = await fetch("https://www.youtube.com/iframe_api");
    if (watchRes.ok) {
      const text = await watchRes.text();
      const jsUrlMatch = text.match(/\/s\/player\/[a-zA-Z0-9_-]+\/player_ias\.vflset\/[a-zA-Z_]+\/base\.js/) ||
                         text.match(/https:\/\/www\.youtube\.com\/s\/player\/[^\s'"]+\/base\.js/);
      if (jsUrlMatch) {
        const jsUrl = jsUrlMatch[0].startsWith("http") ? jsUrlMatch[0] : `https://www.youtube.com${jsUrlMatch[0]}`;
        const jsRes = await fetch(jsUrl);
        if (jsRes.ok) {
          cachedPlayerJsCode = await jsRes.text();
          return cachedPlayerJsCode;
        }
      }
    }
  } catch (err) {
    console.warn("Failed to fetch YouTube player JS:", err);
  }
  return "";
}

let cachedApiKey: string | null = process.env.PLASMO_PUBLIC_YOUTUBE_API_KEY || null;

export async function getApiKey(): Promise<string> {
  if (cachedApiKey) {
    return cachedApiKey;
  }
  try {
    const response = await fetch("https://www.youtube.com/app_shell");
    if (!response.ok) {
      throw new Error(`Failed to fetch app_shell: ${response.status}`);
    }
    const text = await response.text();
    const match = text.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/) || text.match(/INNERTUBE_API_KEY":"([^"]+)"/) || text.match(/INNERTUBE_API_KEY":"(.*?)","?/);
    if (match && match[1]) {
      cachedApiKey = match[1];
      return cachedApiKey;
    }
    throw new Error("INNERTUBE_API_KEY not found in app_shell response");
  } catch (error) {
    console.error("Failed to retrieve InnerTube API key dynamically:", error);
    return "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
  }
}

export async function fetchVisitorData(videoId: string): Promise<string> {
  const apiKey = await getApiKey();
  const url = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false&ext_request=true`;

  await setDNRHeadersForClient("WEB");

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
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch visitor data. Status: ${response.status}`);
  }

  const data = await response.json();
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

export async function fetchVideoInfo(videoId: string) {
  let visitorData: string = "";
  try {
    visitorData = await fetchVisitorData(videoId);
    console.log("Retrieved visitorData successfully:", visitorData);
  } catch (error: any) {
    console.warn("Failed to fetch visitorData:", error.message);
  }

  const apiKey = await getApiKey();
  const clientConfigs = [
    {
      name: "ANDROID_VR" as const,
      apiKey: apiKey,
      payloadContext: {
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
      }
    },
    {
      name: "TV" as const,
      apiKey: apiKey,
      payloadContext: {
        client: {
          clientName: "TVHTML5",
          clientVersion: "7.20240813.07.00",
          platform: "TV",
          visitorData: visitorData || undefined
        }
      }
    }
  ];

  let lastError = new Error("No clients succeeded");

  for (const config of clientConfigs) {
    try {
      console.log(`Attempting fetch using client: ${config.name}`);
      await setDNRHeadersForClient(config.name);

      const url = `https://www.youtube.com/youtubei/v1/player?key=${config.apiKey}&prettyPrint=false&ext_request=true`;
      const payload = {
        videoId: videoId,
        contentCheckOk: true,
        context: config.payloadContext
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`HTTP Status ${response.status}`);
      }

      const data = await response.json();
      const playabilityStatus = data.playabilityStatus || {};

      if (playabilityStatus.status !== "OK") {
        const reason = playabilityStatus.reason || "Video unavailable";
        throw new Error(`Playability status not OK: ${reason}`);
      }

      const streamingData = data.streamingData || {};
      if (!streamingData.formats && !streamingData.adaptiveFormats) {
        throw new Error("No streaming formats returned in player response");
      }

      const videoDetails = data.videoDetails || {};

      // Extract caption tracks
      const rawCaptions = data.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      const captionTracks = rawCaptions.map((track: any) => {
        let name = "";
        const nameDict = track.name || {};
        if ("simpleText" in nameDict) {
          name = nameDict.simpleText;
        } else if (Array.isArray(nameDict.runs)) {
          name = nameDict.runs.map((r: any) => r.text || "").join("");
        }
        let code = track.vssId || track.languageCode || "";
        code = code.replace(/^\.+|\.+$/g, "");
        return {
          baseUrl: track.baseUrl,
          name: name || code || "Subtitle",
          code: code || "und"
        };
      });

      // Check if signature deciphering is needed
      const rawFormats = streamingData.formats || [];
      const rawAdaptive = streamingData.adaptiveFormats || [];
      const hasCipher = rawFormats.some((f: any) => f.signatureCipher || f.cipher) ||
                        rawAdaptive.some((f: any) => f.signatureCipher || f.cipher);
      const playerJsCode = hasCipher ? await getPlayerJsCode() : "";

      // Extract formats
      const formats = rawFormats
        .map((f: any) => ({
          itag: f.itag,
          url: parseFormatUrl(f, playerJsCode),
          mimeType: f.mimeType,
          qualityLabel: f.qualityLabel,
          contentLength: f.contentLength,
          initRange: f.initRange,
          indexRange: f.indexRange
        }))
        .filter((f: any) => !!f.url);

      const adaptiveFormats = rawAdaptive
        .map((f: any) => {
          const audioTrack = f.audioTrack || {};
          const rawTrackId = audioTrack.id || "";
          const langCode = rawTrackId ? rawTrackId.split(".")[0] : undefined;
          return {
            itag: f.itag,
            url: parseFormatUrl(f, playerJsCode),
            mimeType: f.mimeType,
            qualityLabel: f.qualityLabel,
            contentLength: f.contentLength,
            audioQuality: f.audioQuality,
            bitrate: f.bitrate,
            langCode: langCode,
            displayName: audioTrack.displayName,
            audioTrackId: rawTrackId,
            isDefaultAudio: !!audioTrack.audioIsDefault,
            initRange: f.initRange,
            indexRange: f.indexRange
          };
        })
        .filter((f: any) => !!f.url);

      return {
        title: videoDetails.title,
        author: videoDetails.author,
        lengthSeconds: videoDetails.lengthSeconds,
        thumbnail: videoDetails.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        formats,
        adaptiveFormats,
        captionTracks
      };
    } catch (err: any) {
      console.warn(`Client ${config.name} failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError;
}

