import { setDNRHeadersForClient } from "./background/dnr";
import { fetchVideoInfo, fetchFullPlaylist } from "./background/youtube-api";

// Set default rules to ANDROID_VR when background loads
chrome.runtime.onInstalled.addListener(() => {
  setDNRHeadersForClient("ANDROID_VR").catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  setDNRHeadersForClient("ANDROID_VR").catch(console.error);
});

interface ActiveDownload {
  id: string;
  url: string;
  title: string;
  ext: string;
  downloaded: number;
  total: number;
  percent: number;
  speed: number;
  eta: number;
  status: "idle" | "downloading" | "paused" | "complete" | "error";
  errorMessage?: string;
  timestamp: number;
}

const activeDownloads = new Map<string, ActiveDownload>();

// Broadcast message to popup and all tabs (YouTube content script overlays)
function broadcastToAll(message: any) {
  chrome.runtime.sendMessage(message).catch(() => {});
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    }
  });
}

function saveToHistory(item: any) {
  chrome.storage.local.get(["downloadHistory"], (result) => {
    const history = result.downloadHistory || [];
    // Keep max 50 items
    const updatedHistory = [item, ...history].slice(0, 50);
    chrome.storage.local.set({ downloadHistory: updatedHistory });
  });
}

// Listener for popup and tab messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OPEN_DOWNLOAD_TAB") {
    chrome.tabs.create({ url: message.url });
    sendResponse({ success: true });
    return true;
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
    return true;
  }

  if (message.type === "GET_PLAYLIST_INFO") {
    const playlistId = message.playlistId;
    fetchFullPlaylist(playlistId)
      .then((info) => {
        sendResponse({ success: true, info });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (message.type === "ADD_PLAYLIST_JOBS") {
    const { videos, playlistName } = message;
    const targetUrl = chrome.runtime.getURL("tabs/download.html");
    
    chrome.tabs.query({}, (tabs) => {
      const existingTab = tabs.find(t => t.url && t.url.startsWith(targetUrl));
      if (existingTab && existingTab.id !== undefined) {
        chrome.tabs.sendMessage(existingTab.id, {
          type: "NEW_PLAYLIST_JOBS",
          videos,
          playlistName
        }).catch(() => {});
        chrome.tabs.update(existingTab.id, { active: true });
        sendResponse({ success: true });
      } else {
        chrome.storage.local.set({ pendingPlaylistJobs: { videos, playlistName } }, () => {
          chrome.tabs.create({ url: targetUrl, active: true });
          sendResponse({ success: true });
        });
      }
    });
    return true;
  }

  if (message.type === "ADD_DOWNLOAD_JOB") {
    const { url, title, ext, contentLength } = message;

    // Check if dashboard/downloader tab is already open
    const targetUrl = chrome.runtime.getURL("tabs/download.html");
    chrome.tabs.query({}, (tabs) => {
      const existingTab = tabs.find(t => t.url && t.url.startsWith(targetUrl));

      if (existingTab && existingTab.id !== undefined) {
        // Send a message to the existing tab to add the job
        chrome.tabs.sendMessage(existingTab.id, {
          type: "NEW_DOWNLOAD_JOB",
          url,
          title,
          ext,
          contentLength
        }).catch(() => {});
        // Focus the existing tab
        chrome.tabs.update(existingTab.id, { active: true });
        sendResponse({ success: true, tabOpened: false });
      } else {
        // Create new tab and pass the parameters
        const downloadPageUrl = `${targetUrl}?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&ext=${ext}&contentLength=${contentLength || ""}`;
        chrome.tabs.create({ url: downloadPageUrl, active: true });
        sendResponse({ success: true, tabOpened: true });
      }
    });
    return true;
  }

  // Relay actions to the download page
  if (message.type === "PAUSE_DOWNLOAD" || message.type === "RESUME_DOWNLOAD" || message.type === "CANCEL_DOWNLOAD") {
    const targetUrl = chrome.runtime.getURL("tabs/download.html");
    chrome.tabs.query({}, (tabs) => {
      const existingTab = tabs.find(t => t.url && t.url.startsWith(targetUrl));
      if (existingTab && existingTab.id !== undefined) {
        chrome.tabs.sendMessage(existingTab.id, message).catch(() => {});
      }
    });
    sendResponse({ success: true });
    return true;
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
    return true;
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
    return true;
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
    return true;
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
      // Save to storage history
      saveToHistory({
        id,
        title: download.title,
        ext: download.ext,
        total: download.total,
        timestamp: Date.now(),
        status: "complete"
      });
      // Trigger notification
      chrome.notifications.create(id, {
        type: "basic",
        iconUrl: "assets/icon.png",
        title: "Download Complete",
        message: `${download.title}.${download.ext} has been successfully downloaded!`
      }, () => {});
    }
    broadcastToAll({ type: "DOWNLOADS_UPDATED", downloads: Array.from(activeDownloads.values()) });
    return true;
  }

  if (message.type === "TAB_DOWNLOAD_FAILED") {
    const { id, error } = message;
    const download = activeDownloads.get(id);
    if (download) {
      activeDownloads.set(id, {
        ...download,
        status: "error",
        errorMessage: error
      });
      // Save to storage history
      saveToHistory({
        id,
        title: download.title,
        ext: download.ext,
        total: download.total,
        timestamp: Date.now(),
        status: "error",
        error
      });
      // Trigger notification
      chrome.notifications.create(id, {
        type: "basic",
        iconUrl: "assets/icon.png",
        title: "Download Failed",
        message: `Failed to download ${download.title}.${download.ext}: ${error}`
      }, () => {});
    }
    broadcastToAll({ type: "DOWNLOADS_UPDATED", downloads: Array.from(activeDownloads.values()) });
    return true;
  }

  if (message.type === "TAB_DOWNLOAD_CANCELLED") {
    const { id } = message;
    activeDownloads.delete(id);
    broadcastToAll({ type: "DOWNLOADS_UPDATED", downloads: Array.from(activeDownloads.values()) });
    return true;
  }

  if (message.type === "GET_ALL_DOWNLOADS") {
    sendResponse({
      downloads: Array.from(activeDownloads.values())
    });
    return true;
  }
});
