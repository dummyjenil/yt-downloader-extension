import { setDNRHeadersForClient } from "./background/dnr";
import { fetchVideoInfo } from "./background/youtube-api";
import {
  getActiveDownload,
  setActiveDownload,
  startChunkedDownload
} from "./background/downloader";

// Set default rules to ANDROID_VR when background loads
chrome.runtime.onInstalled.addListener(() => {
  setDNRHeadersForClient("ANDROID_VR").catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  setDNRHeadersForClient("ANDROID_VR").catch(console.error);
});

// Listener for popup and tab messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

  if (message.type === "DOWNLOAD_STREAM") {
    const { url, title, ext, itag, contentLength } = message;

    startChunkedDownload(url, title, ext, itag, contentLength)
      .catch((err) => {
        console.error("Chunked download failed:", err);
        setActiveDownload(null);
        chrome.runtime.sendMessage({
          type: "DOWNLOAD_FAILED",
          itag,
          error: err.message || "Network error"
        }).catch(() => { });
      });

    sendResponse({ success: true });
    return true;
  }

  if (message.type === "GET_DOWNLOAD_STATUS") {
    const activeDownload = getActiveDownload();
    if (activeDownload) {
      sendResponse({
        downloading: true,
        itag: activeDownload.itag,
        status: activeDownload.status
      });
    } else {
      sendResponse({ downloading: false });
    }
    return true;
  }

  // Handlers for tab-based direct streaming downloads (to update popup and keep state synchronized)
  if (message.type === "TAB_DOWNLOAD_START") {
    const { url, title, ext, total } = message;
    setActiveDownload({
      url,
      title,
      ext,
      itag: 9999,
      downloaded: 0,
      total,
      percent: 0,
      status: "Starting download..."
    });
    chrome.runtime.sendMessage({
      type: "DOWNLOAD_PROGRESS",
      itag: 9999,
      downloaded: 0,
      total,
      percent: 0
    }).catch(() => { });
    return true;
  }

  if (message.type === "TAB_DOWNLOAD_PROGRESS") {
    const { percent, downloaded, total } = message;
    const activeDownload = getActiveDownload();
    if (activeDownload) {
      setActiveDownload({
        ...activeDownload,
        downloaded,
        percent,
        status: `Downloading: ${percent}%`
      });
    }
    chrome.runtime.sendMessage({
      type: "DOWNLOAD_PROGRESS",
      itag: 9999,
      downloaded,
      total,
      percent
    }).catch(() => { });
    return true;
  }

  if (message.type === "TAB_DOWNLOAD_COMPLETE") {
    setActiveDownload(null);
    chrome.runtime.sendMessage({
      type: "DOWNLOAD_COMPLETE",
      itag: 9999
    }).catch(() => { });
    return true;
  }

  if (message.type === "TAB_DOWNLOAD_FAILED") {
    setActiveDownload(null);
    chrome.runtime.sendMessage({
      type: "DOWNLOAD_FAILED",
      itag: 9999,
      error: message.error
    }).catch(() => { });
    return true;
  }
});
