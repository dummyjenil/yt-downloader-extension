import type { VideoInfo } from "./types/youtube";

// Explicitly register web request rule to strip 'referer' header for YouTube streaming requests
function setupDeclarativeNetRules() {
  const RULE_ID = 1;
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: [
      {
        id: RULE_ID,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [
            {
              header: "referer",
              operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
            }
          ]
        },
        condition: {
          urlFilter: "googlevideo.com",
          resourceTypes: [
            chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
            chrome.declarativeNetRequest.ResourceType.MEDIA,
            chrome.declarativeNetRequest.ResourceType.OTHER
          ]
        }
      }
    ]
  });
}

// Register rules on install & runtime startup
chrome.runtime.onInstalled.addListener(() => {
  setupDeclarativeNetRules();
});
setupDeclarativeNetRules();

async function fetchVideoInfo(videoId: string): Promise<VideoInfo> {
  const apiKey = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
  const playerUrl = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false&ext_request=true`;

  let visitorData = "";
  try {
    const webRes = await fetch(playerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20251021.01.00",
            osName: "Windows",
            osVersion: "10.0",
            platform: "DESKTOP"
          }
        }
      })
    });

    if (webRes.ok) {
      const webData = await webRes.json();
      visitorData = webData?.responseContext?.visitorData || "";
    }
  } catch (err) {
    console.warn("Failed to fetch Web visitorData:", err);
  }

  const vrRes = await fetch(playerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip"
    },
    body: JSON.stringify({
      videoId,
      contentCheckOk: true,
      context: {
        client: {
          clientName: "ANDROID_VR",
          clientVersion: "1.60.19",
          deviceMake: "Oculus",
          deviceModel: "Quest 3",
          osName: "Android",
          osVersion: "12L",
          androidSdkVersion: "32",
          visitorData
        }
      }
    })
  });

  if (!vrRes.ok) {
    throw new Error(`YouTube VR Player API HTTP ${vrRes.status}`);
  }

  const data = await vrRes.json();
  const videoDetails = data?.videoDetails || {};
  const streamingData = data?.streamingData || {};
  const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

  return {
    title: videoDetails.title || "YouTube Video",
    duration: videoDetails.lengthSeconds || "0",
    lengthSeconds: videoDetails.lengthSeconds || "0",
    formats: streamingData.formats || [],
    adaptiveFormats: streamingData.adaptiveFormats || [],
    captionTracks: captionTracks.map((t: any) => ({
      baseUrl: t.baseUrl,
      name: t.name?.simpleText || t.name?.runs?.[0]?.text || "Unknown",
      code: t.languageCode || "en"
    }))
  };
}

// In-memory active downloads state rehydrated from storage for MV3 lifecycle
const activeDownloads = new Map<string, any>();

// Rehydrate active downloads state when service worker starts
chrome.storage.local.get({ activeDownloadsState: [] }, (res) => {
  if (Array.isArray(res.activeDownloadsState)) {
    res.activeDownloadsState.forEach((item: any) => {
      if (item && item.id) {
        activeDownloads.set(item.id, item);
      }
    });
  }
});

function syncActiveDownloadsToStorage() {
  const downloads = Array.from(activeDownloads.values());
  chrome.storage.local.set({ activeDownloadsState: downloads });
}

function broadcastToAll(message: any) {
  syncActiveDownloadsToStorage();
  chrome.runtime.sendMessage(message).catch(() => {});
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    });
  });
}

function saveToHistory(entry: any) {
  chrome.storage.local.get({ downloadHistory: [] }, (result) => {
    const history = result.downloadHistory || [];
    const updated = [entry, ...history.filter((h: any) => h.id !== entry.id)].slice(0, 100);
    chrome.storage.local.set({ downloadHistory: updated });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OPEN_DOWNLOAD_TAB") {
    chrome.tabs.create({ url: message.url });
    sendResponse({ success: true });
    return false;
  }

  if (message.type === "GET_VIDEO_INFO") {
    const videoId = message.videoId;
    fetchVideoInfo(videoId)
      .then((info) => {
        sendResponse({ success: true, info });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // Async response
  }

  if (message.type === "ADD_DOWNLOAD_JOB") {
    const jobPayload = {
      type: "NEW_DOWNLOAD_JOB",
      url: message.url,
      title: message.title,
      ext: message.ext,
      contentLength: message.contentLength,
      audioUrl: message.audioUrl,
      audioSize: message.audioSize,
      audioExt: message.audioExt,
      initRange: message.initRange,
      indexRange: message.indexRange,
      audioInitRange: message.audioInitRange,
      audioIndexRange: message.audioIndexRange,
      trimRange: message.trimRange,
      selectedSubtitles: message.selectedSubtitles
    };

    sendResponse({ success: true });

    const targetUrl = chrome.runtime.getURL("tabs/download.html");
    chrome.tabs.query({}, (tabs) => {
      const existingTab = tabs.find((t) => t.url && t.url.startsWith(targetUrl));

      if (existingTab && existingTab.id !== undefined) {
        chrome.tabs.sendMessage(existingTab.id, jobPayload).catch(() => {});
        chrome.tabs.update(existingTab.id, { active: true });
      } else {
        // Save payload in storage to avoid URL length truncation
        chrome.storage.local.set({ pendingDownloadJob: jobPayload }, () => {
          chrome.tabs.create({ url: targetUrl, active: true });
        });
      }
    });
    return false;
  }

  // Relay actions to the download page
  if (message.type === "PAUSE_DOWNLOAD" || message.type === "RESUME_DOWNLOAD" || message.type === "CANCEL_DOWNLOAD") {
    const targetUrl = chrome.runtime.getURL("tabs/download.html");
    chrome.tabs.query({}, (tabs) => {
      const existingTab = tabs.find((t) => t.url && t.url.startsWith(targetUrl));
      if (existingTab && existingTab.id !== undefined) {
        chrome.tabs.sendMessage(existingTab.id, message).catch(() => {});
      }
    });
    sendResponse({ success: true });
    return false;
  }

  // Registry updates sent by the download page
  if (message.type === "TAB_DOWNLOAD_START") {
    const { id, url, title, ext, total } = message;
    activeDownloads.set(id, {
      id,
      url,
      title,
      ext,
      downloaded: 0,
      total,
      percent: 0,
      speed: 0,
      eta: 0,
      status: "downloading",
      timestamp: Date.now()
    });
    broadcastToAll({ type: "DOWNLOADS_UPDATED", downloads: Array.from(activeDownloads.values()) });
    sendResponse({ success: true });
    return false;
  }

  if (message.type === "TAB_DOWNLOAD_PROGRESS") {
    const { id, percent, downloaded, total, speed, eta } = message;
    const download = activeDownloads.get(id);
    if (download) {
      activeDownloads.set(id, {
        ...download,
        downloaded,
        percent,
        total,
        speed,
        eta,
        status: "downloading"
      });
    }
    broadcastToAll({ type: "DOWNLOADS_UPDATED", downloads: Array.from(activeDownloads.values()) });
    sendResponse({ success: true });
    return false;
  }

  if (message.type === "TAB_DOWNLOAD_PAUSE_STATE") {
    const { id, isPaused } = message;
    const download = activeDownloads.get(id);
    if (download) {
      activeDownloads.set(id, {
        ...download,
        status: isPaused ? "paused" : "downloading"
      });
    }
    broadcastToAll({ type: "DOWNLOADS_UPDATED", downloads: Array.from(activeDownloads.values()) });
    sendResponse({ success: true });
    return false;
  }

  if (message.type === "TAB_DOWNLOAD_COMPLETE") {
    const { id } = message;
    const download = activeDownloads.get(id);
    if (download) {
      activeDownloads.set(id, {
        ...download,
        status: "complete",
        percent: 100,
        downloaded: download.total
      });
      saveToHistory({
        id,
        title: download.title,
        ext: download.ext,
        total: download.total,
        timestamp: Date.now(),
        status: "complete"
      });
      try {
        chrome.notifications.create(id, {
          type: "basic",
          iconUrl: chrome.runtime.getURL("assets/icon.png"),
          title: "Download Complete",
          message: `${download.title}.${download.ext} has been successfully downloaded!`
        }, () => {});
      } catch (_) {}
    }
    broadcastToAll({ type: "DOWNLOADS_UPDATED", downloads: Array.from(activeDownloads.values()) });
    sendResponse({ success: true });
    return false;
  }

  if (message.type === "TAB_DOWNLOAD_FAILED" || message.type === "TAB_DOWNLOAD_CANCELLED") {
    const { id } = message;
    activeDownloads.delete(id);
    broadcastToAll({ type: "DOWNLOADS_UPDATED", downloads: Array.from(activeDownloads.values()) });
    sendResponse({ success: true });
    return false;
  }

  if (message.type === "GET_ACTIVE_DOWNLOADS") {
    sendResponse({ downloads: Array.from(activeDownloads.values()) });
    return false;
  }

  if (message.type === "CLEAR_DOWNLOAD") {
    const { id } = message;
    activeDownloads.delete(id);
    broadcastToAll({ type: "DOWNLOADS_UPDATED", downloads: Array.from(activeDownloads.values()) });
    sendResponse({ success: true });
    return false;
  }

  return false;
});
