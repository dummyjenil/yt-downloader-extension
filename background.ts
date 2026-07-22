import type { VideoInfo } from "./types/youtube";
import { fetchVideoInfo } from "./background/youtube-video";
import { setDNRHeadersForClient } from "./background/dnr";

// Register DNR rules on install & runtime startup
chrome.runtime.onInstalled.addListener(() => {
  setDNRHeadersForClient("WEB");
});
setDNRHeadersForClient("WEB");

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

  if (message.type === "GET_ACTIVE_DOWNLOADS" || message.type === "GET_ALL_DOWNLOADS") {
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
