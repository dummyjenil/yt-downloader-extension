import { setDNRHeadersForClient } from "./dnr";

export async function fetchVisitorData(videoId: string): Promise<string> {
  const apiKey = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
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

  const clientConfigs = [
    {
      name: "ANDROID_VR" as const,
      apiKey: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
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
      apiKey: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
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

      // Extract formats
      const formats = (streamingData.formats || []).map((f: any) => ({
        itag: f.itag,
        url: f.url,
        mimeType: f.mimeType,
        qualityLabel: f.qualityLabel,
        contentLength: f.contentLength
      }));

      const adaptiveFormats = (streamingData.adaptiveFormats || []).map((f: any) => ({
        itag: f.itag,
        url: f.url,
        mimeType: f.mimeType,
        qualityLabel: f.qualityLabel,
        contentLength: f.contentLength,
        audioQuality: f.audioQuality,
        bitrate: f.bitrate
      }));

      return {
        title: videoDetails.title,
        author: videoDetails.author,
        lengthSeconds: videoDetails.lengthSeconds,
        thumbnail: videoDetails.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        formats,
        adaptiveFormats
      };
    } catch (err: any) {
      console.warn(`Client ${config.name} failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError;
}
