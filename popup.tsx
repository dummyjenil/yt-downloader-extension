import { useEffect, useState } from "react";
import React from "react";

import type { VideoInfo, StreamFormat } from "./types/youtube";
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

function IndexPopup() {
  const [urlInput, setUrlInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"video" | "audio" | "adaptive">("video");
  
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
      // Get settings and history
      chrome.storage.local.get(["chunkSize", "concurrency", "downloadHistory"], (res) => {
        if (res.chunkSize) setChunkSize(res.chunkSize);
        if (res.concurrency) setConcurrency(res.concurrency);
        if (res.downloadHistory) setHistoryList(res.downloadHistory);
      });

      getDirectoryHandle().then((handle) => {
        if (handle) setDefaultDirName(handle.name);
      }).catch(console.error);

      // Fetch active downloads
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
          setNavTab("streams"); // auto switch to streams extractor if info found
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

  const handleDownload = (stream: StreamFormat, category: "video" | "audio" | "adaptive") => {
    if (!videoInfo) return;

    let ext = "mp4";
    if (category === "audio") {
      ext = stream.mimeType.includes("webm") ? "webm" : "m4a";
    } else if (stream.mimeType.includes("webm")) {
      ext = "webm";
    }

    const suffix = stream.qualityLabel ? `_${stream.qualityLabel}` : "";
    const cleanTitle = videoInfo.title.replace(/[\\/:*?"<>|]/g, "_");
    const filename = `${cleanTitle}${suffix}`;

    // Send command to background to open/reuse dashboard and start downloading
    chrome.runtime.sendMessage({
      type: "ADD_DOWNLOAD_JOB",
      url: stream.url,
      title: filename,
      ext: ext,
      contentLength: stream.contentLength || ""
    });

    setNavTab("dashboard"); // redirect to active dashboard tab
  };

  const handleSelectDirectory = async () => {
    try {
      if (!(window as any).showDirectoryPicker) {
        alert("Your browser does not support directory picking. Please use Google Chrome.");
        return;
      }
      const handle = await (window as any).showDirectoryPicker({
        mode: "readwrite"
      });
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
          {/* Manual URL Input Form */}
          <UrlForm
            urlInput={urlInput}
            setUrlInput={setUrlInput}
            onSubmit={handleManualSubmit}
            loading={loading}
          />

          {/* Loading State Indicator */}
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

          {/* Error Notifications */}
          {error && <div style={themeStyles.errorText}>{error}</div>}

          {/* Video Details Card */}
          {videoInfo && <VideoDetails videoInfo={videoInfo} />}

          {/* Stream Tabs & Options List */}
          {videoInfo && (
            <>
              <StreamTabs activeTab={activeTab} setActiveTab={setActiveTab} />

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

          {/* Welcome Placeholder */}
          {!videoInfo && !loading && <Placeholder />}
        </>
      )}

      {navTab === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: 700 }}>Active Downloads</h3>
          {activeDownloads.length === 0 ? (
            <div style={{ padding: "40px 10px", textAlign: "center", color: "#71717a", fontSize: "12px" }}>
              No active downloads running
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "420px", overflowY: "auto" }}>
              {activeDownloads.map((job) => (
                <div key={job.id} style={themeStyles.glassCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#f4f4f5", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", flex: 1 }}>
                      {job.title}.{job.ext}
                    </span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => {
                          chrome.runtime.sendMessage({
                            type: job.status === "paused" ? "RESUME_DOWNLOAD" : "PAUSE_DOWNLOAD",
                            id: job.id
                          });
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: job.status === "paused" ? "#10b981" : "#fbbf24",
                          cursor: "pointer",
                          padding: 0
                        }}
                      >
                        {job.status === "paused" ? "▶" : "⏸"}
                      </button>
                      <button
                        onClick={() => {
                          chrome.runtime.sendMessage({ type: "CANCEL_DOWNLOAD", id: job.id });
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#f43f5e",
                          cursor: "pointer",
                          padding: 0
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div style={themeStyles.progressBarContainer}>
                    <div 
                      style={{ 
                        ...themeStyles.progressBarFill, 
                        width: `${job.percent}%`,
                        background: job.status === "paused" ? "#fbbf24" : themeColors.accent
                      }} 
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#a1a1aa", marginTop: "4px" }}>
                    <span>{job.status === "paused" ? "Paused" : `${formatBytes(job.speed)}/s`}</span>
                    <span>{job.percent}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {navTab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>
          <h3 style={{ margin: "0", fontSize: "14px", fontWeight: 700 }}>Settings</h3>

          {/* Directory Access */}
          <div>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#e4e4e7", display: "block", marginBottom: "4px" }}>
              Default Folder
            </span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                onClick={handleSelectDirectory}
                style={{
                  ...themeStyles.button,
                  padding: "6px 12px",
                  fontSize: "11px",
                  background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)"
                }}
              >
                {defaultDirName ? "Change" : "Choose Folder"}
              </button>
              {defaultDirName && (
                <button
                  onClick={handleClearDirectory}
                  style={{
                    background: "rgba(244, 63, 94, 0.1)",
                    border: "1px solid rgba(244, 63, 94, 0.2)",
                    color: "#fda4af",
                    borderRadius: "12px",
                    padding: "6px 12px",
                    fontSize: "11px",
                    cursor: "pointer"
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            {defaultDirName && (
              <span style={{ fontSize: "10px", color: "#a78bfa", marginTop: "4px", display: "block" }}>
                Saving directly to: {defaultDirName}
              </span>
            )}
          </div>

          {/* Chunk Size Selector */}
          <div>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#e4e4e7", display: "block", marginBottom: "4px" }}>
              Chunk Size
            </span>
            <select
              value={chunkSize}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setChunkSize(val);
                chrome.storage.local.set({ chunkSize: val });
              }}
              style={{
                background: "#18181b",
                border: `1px solid ${themeColors.border}`,
                borderRadius: "8px",
                color: "#f4f4f5",
                padding: "6px 10px",
                fontSize: "11px",
                width: "100%",
                outline: "none"
              }}
            >
              <option value={1 * 1024 * 1024}>1 MB</option>
              <option value={2 * 1024 * 1024}>2 MB</option>
              <option value={5 * 1024 * 1024}>5 MB (Default)</option>
              <option value={10 * 1024 * 1024}>10 MB</option>
              <option value={20 * 1024 * 1024}>20 MB</option>
            </select>
          </div>

          {/* Concurrency limit */}
          <div>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#e4e4e7", display: "block", marginBottom: "4px" }}>
              Parallel Chunk Fetches
            </span>
            <select
              value={concurrency}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setConcurrency(val);
                chrome.storage.local.set({ concurrency: val });
              }}
              style={{
                background: "#18181b",
                border: `1px solid ${themeColors.border}`,
                borderRadius: "8px",
                color: "#f4f4f5",
                padding: "6px 10px",
                fontSize: "11px",
                width: "100%",
                outline: "none"
              }}
            >
              <option value={1}>1 (Sequential)</option>
              <option value={2}>2 Parallel Chunks</option>
              <option value={3}>3 Parallel Chunks</option>
              <option value={5}>5 Parallel Chunks</option>
            </select>
          </div>
        </div>
      )}

      {navTab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: "0", fontSize: "14px", fontWeight: 700 }}>History</h3>
            {historyList.length > 0 && (
              <button
                onClick={clearHistory}
                style={{
                  background: "none",
                  border: "none",
                  color: "#f43f5e",
                  fontSize: "10px",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0
                }}
              >
                Clear All
              </button>
            )}
          </div>
          {historyList.length === 0 ? (
            <div style={{ padding: "40px 10px", textAlign: "center", color: "#71717a", fontSize: "12px" }}>
              No history found
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "420px", overflowY: "auto" }}>
              {historyList.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "rgba(255, 255, 255, 0.01)",
                    border: `1px solid ${themeColors.border}`,
                    borderRadius: "10px",
                    padding: "8px 10px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div style={{ flex: 1, overflow: "hidden", paddingRight: "8px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {item.title}.{item.ext}
                    </div>
                    <div style={{ fontSize: "9px", color: "#71717a", marginTop: "2px" }}>
                      {formatBytes(item.total)}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 600,
                      color: item.status === "complete" ? "#10b981" : "#f43f5e"
                    }}
                  >
                    {item.status === "complete" ? "Success" : "Failed"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default IndexPopup;
