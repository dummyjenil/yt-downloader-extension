import { useEffect, useState } from "react";
import React from "react";

import type { VideoInfo, StreamFormat, TrimRange, CaptionTrack } from "./types/youtube";
import { extractVideoId, formatBytes } from "./utils/youtube";
import { themeStyles, themeColors } from "./styles/theme";
import { getDirectoryHandle, storeDirectoryHandle, clearDirectoryHandle } from "./utils/storage";

// Components
import { Header } from "./components/Header";
import { UrlForm } from "./components/UrlForm";
import { VideoDetails } from "./components/VideoDetails";
import { StreamTabs } from "./components/StreamTabs";
import { StreamRow } from "./components/StreamRow";
import { Placeholder } from "./components/Placeholder";
import { CustomFusionSelector } from "./components/CustomFusionSelector";

// Popup Sub-Tabs
import { PopupDashboardTab } from "./components/popup/PopupDashboardTab";
import { PopupSettingsTab } from "./components/popup/PopupSettingsTab";
import { PopupHistoryTab } from "./components/popup/PopupHistoryTab";

function IndexPopup() {
  const [urlInput, setUrlInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"video" | "audio" | "adaptive" | "fusion" | "subtitle">("video");
  const [trimRange, setTrimRange] = useState<TrimRange | null>(null);

  // Navigation tabs for popup
  const [navTab, setNavTab] = useState<"streams" | "dashboard" | "settings" | "history">("streams");

  // Downloads state registry synced from background
  const [downloads, setDownloads] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);

  // Local Settings States
  const [chunkSize, setChunkSize] = useState<number>(5 * 1024 * 1024);
  const [concurrency, setConcurrency] = useState<number>(3);
  const [defaultDirName, setDefaultDirName] = useState<string | null>(null);

  // Load Outfit Google Font dynamically
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  // Auto detect YouTube video page from current active browser tab
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && activeTab.url) {
          const id = extractVideoId(activeTab.url);
          if (id) {
            setVideoId(id);
            fetchInfo(id);
          }
        }
      });
    }
  }, []);

  // Sync active downloads and local storage settings
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.storage.local.get(["chunkSize", "concurrency", "downloadHistory"], (res) => {
        if (res.chunkSize) setChunkSize(res.chunkSize as number);
        if (res.concurrency) setConcurrency(res.concurrency as number);
        if (res.downloadHistory) setHistoryList(res.downloadHistory as any[]);
      });

      getDirectoryHandle().then((handle) => {
        if (handle) setDefaultDirName(handle.name);
      }).catch(console.error);

      chrome.runtime.sendMessage({ type: "GET_ALL_DOWNLOADS" }, (response) => {
        if (response && response.downloads) {
          setDownloads(response.downloads);
        }
      });

      const listener = (message: any) => {
        if (message.type === "DOWNLOADS_UPDATED") {
          setDownloads(message.downloads);
        }
      };

      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }
  }, []);

  const fetchInfo = (id: string) => {
    setLoading(true);
    setError(null);
    setVideoInfo(null);

    chrome.runtime.sendMessage(
      { type: "GET_VIDEO_INFO", videoId: id },
      (response) => {
        setLoading(false);
        if (chrome.runtime.lastError) {
          setError(chrome.runtime.lastError.message || "Failed to communicate with service worker.");
        } else if (response && response.success) {
          setVideoInfo(response.info);
          setNavTab("streams");
        } else {
          setError(response?.error || "Unable to extract stream URLs for this video.");
        }
      }
    );
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractVideoId(urlInput);
    if (id) {
      setVideoId(id);
      fetchInfo(id);
    } else {
      setError("Invalid YouTube URL. Please enter a valid watch or share link.");
    }
  };

  const handleDownload = (
    stream: StreamFormat,
    category: "video" | "audio" | "adaptive" | "fusion" | "subtitle",
    customAudioStream?: StreamFormat,
    selectedSubtitles?: CaptionTrack[]
  ) => {
    if (!videoInfo) return;

    let ext = "mp4";
    let audioUrl: string | undefined = undefined;
    let audioSize: number | undefined = undefined;
    let audioExt: string | undefined = undefined;

    if (category === "subtitle") {
      ext = "srt";
    } else if (category === "audio") {
      ext = stream.mimeType.includes("webm") ? "webm" : "m4a";
    } else if (category === "fusion" && customAudioStream) {
      audioUrl = customAudioStream.url;
      audioSize = parseInt(customAudioStream.contentLength || "0", 10);
      audioExt = customAudioStream.mimeType.includes("webm") ? "webm" : "m4a";
      ext = stream.mimeType.includes("webm") ? "webm" : "mp4";
    } else if (category === "adaptive") {
      ext = stream.mimeType.includes("webm") ? "webm" : "mp4";
    } else if (stream.mimeType.includes("webm")) {
      ext = "webm";
    }

    const totalSec = parseInt(videoInfo.lengthSeconds || "0", 10);
    const isTrimmed = trimRange && trimRange.enabled && totalSec > 0;
    const trimmedRatio = isTrimmed
      ? Math.max(0.005, Math.min(1.0, (trimRange.endTimeSec - trimRange.startTimeSec) / totalSec))
      : 1.0;

    let scaledContentLength = stream.contentLength;
    if (stream.contentLength && isTrimmed) {
      scaledContentLength = String(Math.round(parseInt(stream.contentLength, 10) * trimmedRatio));
    }

    if (audioSize && isTrimmed) {
      audioSize = Math.round(audioSize * trimmedRatio);
    }

    const trimSuffix = isTrimmed ? `_trimmed_${trimRange.startTimeSec}s-${trimRange.endTimeSec}s` : "";
    const suffix = stream.qualityLabel ? `_${stream.qualityLabel}${trimSuffix}` : trimSuffix;
    const cleanTitle = videoInfo.title.replace(/[\\/:*?"<>|]/g, "_");
    const filename = `${cleanTitle}${suffix}`;

    chrome.runtime.sendMessage({
      type: "ADD_DOWNLOAD_JOB",
      url: stream.url,
      title: filename,
      ext: ext,
      contentLength: scaledContentLength || "",
      audioUrl: audioUrl,
      audioSize: audioSize ? String(audioSize) : "",
      audioExt: audioExt || "",
      initRange: stream.initRange,
      indexRange: stream.indexRange,
      audioInitRange: customAudioStream?.initRange,
      audioIndexRange: customAudioStream?.indexRange,
      trimRange: trimRange && trimRange.enabled ? trimRange : undefined,
      selectedSubtitles: selectedSubtitles
    });

    setNavTab("dashboard");
  };

  const handleSelectDirectory = async () => {
    try {
      if (!(window as any).showDirectoryPicker) {
        alert("Your browser does not support directory picking. Please use Google Chrome.");
        return;
      }
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      await storeDirectoryHandle(handle);
      setDefaultDirName(handle.name);
    } catch (err: any) {
      console.error(err);
      alert("Failed to select directory: " + err.message);
    }
  };

  const handleClearDirectory = async () => {
    await clearDirectoryHandle();
    setDefaultDirName(null);
  };

  const clearHistory = () => {
    chrome.storage.local.set({ downloadHistory: [] }, () => {
      setHistoryList([]);
    });
  };

  const activeDownloads = downloads.filter(d => d.status === "downloading" || d.status === "paused");

  return (
    <div style={themeStyles.container}>
      {/* Header with App Logo and Status Badge */}
      <Header />

      {/* Sub Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          background: "rgba(255,255,255,0.02)",
          padding: "3px",
          borderRadius: "10px",
          border: `1px solid ${themeColors.border}`,
          marginBottom: "16px"
        }}
      >
        {[
          { id: "streams", label: "Extractor" },
          { id: "dashboard", label: `Downloads ${activeDownloads.length > 0 ? `(${activeDownloads.length})` : ""}` },
          { id: "settings", label: "Settings" },
          { id: "history", label: "History" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setNavTab(tab.id as any)}
            style={{
              flex: 1,
              background: navTab === tab.id ? "rgba(255,255,255,0.05)" : "transparent",
              border: navTab === tab.id ? `1px solid ${themeColors.border}` : "1px solid transparent",
              borderRadius: "8px",
              color: navTab === tab.id ? "#c084fc" : "#a1a1aa",
              padding: "5px 0",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* RENDER VIEWS */}
      {navTab === "streams" && (
        <>
          <UrlForm
            urlInput={urlInput}
            setUrlInput={setUrlInput}
            onSubmit={handleManualSubmit}
            loading={loading}
          />

          {loading && (
            <div style={themeStyles.loader}>
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
              <div style={themeStyles.spinner}></div>
              <span style={{ fontSize: "11px", color: "#a1a1aa" }}>Extracting media streams...</span>
            </div>
          )}

          {error && <div style={themeStyles.errorText}>{error}</div>}

          {videoInfo && <VideoDetails videoInfo={videoInfo} />}

          {videoInfo && (
            <>
              <StreamTabs activeTab={activeTab} setActiveTab={setActiveTab} />

              {activeTab === "fusion" && (
                <CustomFusionSelector
                  videoInfo={videoInfo}
                  downloads={downloads}
                  handleDownload={handleDownload as any}
                />
              )}

              <div style={themeStyles.streamList}>
                {activeTab === "video" &&
                  videoInfo.formats.map((stream) => (
                    <StreamRow
                      key={stream.itag}
                      label={`MP4 Video (${stream.qualityLabel || "Progressive"})`}
                      meta={`${formatBytes(stream.contentLength)} • Video + Audio`}
                      isDownloading={downloads.some(d => d.url === stream.url && (d.status === "downloading" || d.status === "paused"))}
                      onDownload={() => handleDownload(stream, "video")}
                    />
                  ))}

                {activeTab === "audio" &&
                  videoInfo.adaptiveFormats
                    .filter((f) => f.mimeType.startsWith("audio/"))
                    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
                    .map((stream) => {
                      const isOpus = stream.mimeType.includes("opus");
                      const ext = isOpus ? "webm" : "m4a";
                      const kbps = Math.round((stream.bitrate || 0) / 1000);
                      return (
                        <StreamRow
                          key={stream.itag}
                          label={`${ext.toUpperCase()} Audio (${kbps} kbps)`}
                          meta={`${formatBytes(stream.contentLength)} • ${isOpus ? "Opus" : "AAC"}`}
                          isDownloading={downloads.some(d => d.url === stream.url && (d.status === "downloading" || d.status === "paused"))}
                          onDownload={() => handleDownload(stream, "audio")}
                        />
                      );
                    })}

                {activeTab === "adaptive" &&
                  videoInfo.adaptiveFormats
                    .filter((f) => f.mimeType.startsWith("video/"))
                    .sort((a, b) => {
                      const qa = parseInt(a.qualityLabel || "0", 10);
                      const qb = parseInt(b.qualityLabel || "0", 10);
                      return qb - qa;
                    })
                    .map((stream) => {
                      const isWebm = stream.mimeType.includes("webm");
                      return (
                        <StreamRow
                          key={stream.itag}
                          label={`${isWebm ? "WEBM" : "MP4"} Video (${stream.qualityLabel})`}
                          meta={`${formatBytes(stream.contentLength)} • Video Only`}
                          isDownloading={downloads.some(d => d.url === stream.url && (d.status === "downloading" || d.status === "paused"))}
                          onDownload={() => handleDownload(stream, "adaptive")}
                        />
                      );
                    })}
              </div>
            </>
          )}

          {!videoInfo && !loading && <Placeholder />}
        </>
      )}

      {navTab === "dashboard" && (
        <PopupDashboardTab activeDownloads={activeDownloads} />
      )}

      {navTab === "settings" && (
        <PopupSettingsTab
          defaultDirName={defaultDirName}
          chunkSize={chunkSize}
          concurrency={concurrency}
          handleSelectDirectory={handleSelectDirectory}
          handleClearDirectory={handleClearDirectory}
          setChunkSize={setChunkSize}
          setConcurrency={setConcurrency}
        />
      )}

      {navTab === "history" && (
        <PopupHistoryTab historyList={historyList} clearHistory={clearHistory} />
      )}
    </div>
  );
}

export default IndexPopup;
