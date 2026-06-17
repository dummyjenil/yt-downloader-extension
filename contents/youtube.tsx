import type { PlasmoCSConfig } from "plasmo";
import React, { useEffect, useState, useRef } from "react";
import type { VideoInfo, StreamFormat } from "../types/youtube";
import { extractVideoId, formatBytes, formatTime } from "../utils/youtube";

// Content Script Configuration to run on all YouTube domains
export const config: PlasmoCSConfig = {
  matches: ["*://*.youtube.com/*"]
};

export default function YoutubeOverlay() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"video" | "audio" | "adaptive">("video");

  // Download-related states synced from background registry
  const [downloads, setDownloads] = useState<any[]>([]);

  // Load typography and track routing changes
  useEffect(() => {
    // 1. Inject Outfit Google Font
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    // 2. SPA URL change tracking
    const handleUrlChange = () => {
      const url = window.location.href;
      const id = extractVideoId(url);
      setVideoId(id);
    };

    handleUrlChange();

    // Listen to standard YouTube SPA transition completion event
    window.addEventListener("yt-navigate-finish", handleUrlChange);

    // Fallback interval for robustness
    const interval = setInterval(handleUrlChange, 1000);

    return () => {
      window.removeEventListener("yt-navigate-finish", handleUrlChange);
      clearInterval(interval);
    };
  }, []);

  // Sync active downloads registry and listen to background updates
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      // Fetch initial background status on mount
      chrome.runtime.sendMessage({ type: "GET_ALL_DOWNLOADS" }, (response) => {
        if (response && response.downloads) {
          setDownloads(response.downloads);
        }
      });

      const messageListener = (message: any) => {
        if (message.type === "DOWNLOADS_UPDATED") {
          setDownloads(message.downloads);
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);
      return () => chrome.runtime.onMessage.removeListener(messageListener);
    }
  }, []);

  // Whenever videoId changes, auto pre-fetch the stream options
  useEffect(() => {
    if (videoId) {
      fetchInfo(videoId);
    } else {
      setVideoInfo(null);
      setError(null);
      setLoading(false);
      setShowDialog(false);
    }
  }, [videoId]);

  const fetchInfo = (id: string) => {
    setLoading(true);
    setError(null);
    setVideoInfo(null);

    chrome.runtime.sendMessage(
      { type: "GET_VIDEO_INFO", videoId: id },
      (response) => {
        setLoading(false);
        if (chrome.runtime.lastError) {
          setError("Failed to communicate with YouTube Downloader background.");
        } else if (response && response.success) {
          setVideoInfo(response.info);
        } else {
          setError(response?.error || "Unable to extract stream links for this video.");
        }
      }
    );
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

    // Send command to background to add download job
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: "ADD_DOWNLOAD_JOB",
        url: stream.url,
        title: filename,
        ext: ext,
        contentLength: stream.contentLength || ""
      }).catch((e) => {
        console.error("Failed to add download job:", e);
        alert("Failed to initiate background downloader.");
      });
    }
  };

  // If we're not on a watch or shorts page, render nothing
  if (!videoId) return null;

  // Find if there is an active download matching the current video title
  const activeJobs = downloads.filter((d) => d.status === "downloading" || d.status === "paused");
  const cleanTitleForMatch = videoInfo ? videoInfo.title.replace(/[\\/:*?"<>|]/g, "_") : "";
  const currentVideoJob = activeJobs.find(
    (d) => d.title.includes(cleanTitleForMatch) || cleanTitleForMatch.includes(d.title)
  );

  const isCurrentlyDownloading = currentVideoJob !== undefined;
  const currentDownloadPercent = currentVideoJob ? currentVideoJob.percent : null;
  const currentDownloadStatus = currentVideoJob ? currentVideoJob.status : null;

  // Circular progress calculations
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = currentDownloadPercent !== null 
    ? circumference - (circumference * currentDownloadPercent) / 100 
    : circumference;

  return (
    <div className="ytd-overlay-root">
      {/* Dynamic CSS Stylesheet scoped in Shadow DOM */}
      <style>{`
        .ytd-overlay-root {
          font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #f4f4f5;
        }

        /* FAB Button styling */
        .ytd-fab-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 68px;
          height: 68px;
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ytd-fab {
          position: absolute;
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f43f5e 0%, #ff0000 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(225, 29, 72, 0.4);
          color: white;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          padding: 0;
        }

        .ytd-fab:hover {
          transform: scale(1.08);
          box-shadow: 0 6px 20px rgba(225, 29, 72, 0.55);
        }

        .ytd-fab:active {
          transform: scale(0.95);
        }

        .ytd-fab svg {
          width: 22px;
          height: 22px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2.5;
          stroke-linecap: round;
          stroke-linejoin: round;
          transition: transform 0.2s ease;
        }

        .ytd-fab:hover svg {
          transform: translateY(1px);
        }

        .ytd-progress-ring {
          position: absolute;
          top: 0;
          left: 0;
          width: 68px;
          height: 68px;
          transform: rotate(-90deg);
          pointer-events: none;
        }

        .ytd-progress-ring-circle-bg {
          fill: transparent;
          stroke: rgba(255, 255, 255, 0.1);
          stroke-width: 3.5px;
        }

        .ytd-progress-ring-circle-fg {
          fill: transparent;
          stroke: #8b5cf6;
          stroke-width: 3.5px;
          stroke-linecap: round;
          transition: stroke-dashoffset 0.15s linear;
        }

        /* Dialog Backdrop */
        .ytd-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999999;
          animation: fadeIn 0.2s ease-out;
        }

        /* Dialog Card Box */
        .ytd-dialog {
          width: 90%;
          max-width: 420px;
          background: rgba(18, 18, 22, 0.94);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
          padding: 24px;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          overflow: hidden;
        }

        .ytd-dialog-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .ytd-dialog-title-area {
          flex: 1;
          padding-right: 12px;
        }

        .ytd-dialog-title {
          font-size: 15px;
          font-weight: 700;
          margin: 0 0 6px 0;
          line-height: 1.45;
          color: #f4f4f5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .ytd-dialog-subtitle {
          font-size: 11px;
          color: #a1a1aa;
          margin: 0;
          font-weight: 500;
        }

        .ytd-close-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #a1a1aa;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 0;
        }

        .ytd-close-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #f4f4f5;
          transform: rotate(90deg);
        }

        /* Detail card styling */
        .ytd-detail-card {
          display: flex;
          gap: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 12px;
          margin-bottom: 20px;
        }

        .ytd-thumb {
          width: 90px;
          height: 50px;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .ytd-detail-meta {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex: 1;
        }

        .ytd-meta-title {
          font-size: 12px;
          font-weight: 600;
          color: #e4e4e7;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-bottom: 2px;
        }

        .ytd-meta-channel {
          font-size: 10px;
          color: #a1a1aa;
          margin-bottom: 4px;
        }

        .ytd-duration-badge {
          background: rgba(139, 92, 246, 0.1);
          color: #c084fc;
          padding: 2px 6px;
          border-radius: 6px;
          font-size: 9px;
          font-weight: 600;
          border: 1px solid rgba(139, 92, 246, 0.15);
          width: fit-content;
        }

        /* Tabs capsule navigation */
        .ytd-tabs {
          display: flex;
          gap: 4px;
          background: rgba(255, 255, 255, 0.02);
          padding: 4px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: 16px;
        }

        .ytd-tab-btn {
          flex: 1;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: #a1a1aa;
          padding: 8px 0;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s ease;
        }

        .ytd-tab-btn:hover {
          color: #f4f4f5;
        }

        .ytd-tab-btn.active {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.04);
          color: #a78bfa;
        }

        /* Lists */
        .ytd-stream-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 220px;
          overflow-y: auto;
          padding-right: 4px;
          margin-bottom: 12px;
        }

        .ytd-stream-list::-webkit-scrollbar {
          width: 4px;
        }

        .ytd-stream-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
        }

        .ytd-stream-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.05);
          transition: all 0.2s ease;
        }

        .ytd-stream-row:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.09);
        }

        .ytd-stream-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .ytd-stream-label {
          font-size: 12px;
          font-weight: 600;
          color: #f4f4f5;
        }

        .ytd-stream-meta {
          font-size: 10px;
          color: #a1a1aa;
        }

        .ytd-download-icon-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          color: #f4f4f5;
          border-radius: 10px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 0;
        }

        .ytd-download-icon-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          color: #a78bfa;
        }

        .ytd-download-icon-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Loading / Error States */
        .ytd-loader-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px 0;
          color: #a1a1aa;
          font-size: 12px;
        }

        .ytd-spinner {
          width: 24px;
          height: 24px;
          border: 2.5px solid rgba(255, 255, 255, 0.05);
          border-top: 2.5px solid #a78bfa;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 12px;
        }

        .ytd-error {
          color: #f43f5e;
          font-size: 12px;
          line-height: 1.5;
          padding: 12px;
          background: rgba(244, 63, 94, 0.06);
          border: 1px solid rgba(244, 63, 94, 0.15);
          border-radius: 12px;
          margin-top: 8px;
          text-align: center;
        }

        .ytd-error-btn {
          margin-top: 10px;
          background: #f43f5e;
          border: none;
          color: white;
          padding: 6px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          transition: background 0.2s;
        }

        .ytd-error-btn:hover {
          background: #e11d48;
        }

        /* Active Download Progress Details inside Dialog */
        .ytd-progress-card {
          margin-top: 12px;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 12px;
        }

        .ytd-progress-card-header {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #a1a1aa;
          margin-bottom: 6px;
        }

        .ytd-progress-bar-bg {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 100px;
          height: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .ytd-progress-bar-fg {
          height: 100%;
          background: linear-gradient(90deg, #f43f5e 0%, #8b5cf6 100%);
          border-radius: 100px;
          transition: width 0.2s ease;
        }

        .ytd-progress-details {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #71717a;
        }

        /* Animations declarations */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Floating Action Button (FAB) + Progress Circle */}
      <div className="ytd-fab-container">
        <svg className="ytd-progress-ring">
          <circle 
            className="ytd-progress-ring-circle-bg" 
            cx="34" 
            cy="34" 
            r="28" 
          />
          <circle 
            className="ytd-progress-ring-circle-fg" 
            cx="34" 
            cy="34" 
            r="28" 
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <button 
          className="ytd-fab" 
          onClick={() => setShowDialog(true)} 
          title="Download Options"
        >
          {isCurrentlyDownloading && currentDownloadStatus === "downloading" ? (
            /* Pulsing download icon when download is active */
            <svg 
              viewBox="0 0 24 24" 
              style={{ animation: "spin 2.5s linear infinite" }}
            >
              <path d="M12 15V3m0 12l-4-4m4 4l4-4M5 20h14" />
            </svg>
          ) : (
            /* Standard material download icon */
            <svg viewBox="0 0 24 24">
              <path d="M12 15V3m0 12l-4-4m4 4l4-4M5 20h14" />
            </svg>
          )}
        </button>
      </div>

      {/* Modal Dialog Popup */}
      {showDialog && (
        <div className="ytd-backdrop" onClick={() => setShowDialog(false)}>
          <div className="ytd-dialog" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="ytd-dialog-header">
              <div className="ytd-dialog-title-area">
                <h3 className="ytd-dialog-title">
                  {videoInfo ? videoInfo.title : "Extracting Video Streams"}
                </h3>
                <p className="ytd-dialog-subtitle">
                  {videoInfo ? `by ${videoInfo.author}` : "Please wait..."}
                </p>
              </div>
              <button className="ytd-close-btn" onClick={() => setShowDialog(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Video Detail Card */}
            {videoInfo && (
              <div className="ytd-detail-card">
                <img 
                  className="ytd-thumb" 
                  src={videoInfo.thumbnail} 
                  alt="Video Thumbnail" 
                />
                <div className="ytd-detail-meta">
                  <span className="ytd-meta-title">{videoInfo.title}</span>
                  <span className="ytd-meta-channel">{videoInfo.author}</span>
                  <span className="ytd-duration-badge">
                    {formatTime(parseInt(videoInfo.lengthSeconds, 10))}
                  </span>
                </div>
              </div>
            )}

            {/* Loader State */}
            {loading && (
              <div className="ytd-loader-wrapper">
                <div className="ytd-spinner"></div>
                <span>Parsing InnerTube streaming configuration...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="ytd-error">
                <div>{error}</div>
                <button className="ytd-error-btn" onClick={() => fetchInfo(videoId)}>
                  Retry
                </button>
              </div>
            )}

            {/* Loaded Options Area */}
            {videoInfo && (
              <>
                {/* Tabs Capsule */}
                <div className="ytd-tabs">
                  <button 
                    className={`ytd-tab-btn ${activeTab === "video" ? "active" : ""}`}
                    onClick={() => setActiveTab("video")}
                  >
                    Video
                  </button>
                  <button 
                    className={`ytd-tab-btn ${activeTab === "audio" ? "active" : ""}`}
                    onClick={() => setActiveTab("audio")}
                  >
                    Audio
                  </button>
                  <button 
                    className={`ytd-tab-btn ${activeTab === "adaptive" ? "active" : ""}`}
                    onClick={() => setActiveTab("adaptive")}
                  >
                    Video Only
                  </button>
                </div>

                {/* Lists Area */}
                <div className="ytd-stream-list">
                  {activeTab === "video" &&
                    videoInfo.formats.map((stream) => {
                      const isDownloading = downloads.some(
                        (d) => d.url === stream.url && (d.status === "downloading" || d.status === "paused")
                      );
                      return (
                        <div className="ytd-stream-row" key={stream.itag}>
                          <div className="ytd-stream-info">
                            <span className="ytd-stream-label">
                              MP4 Progressive ({stream.qualityLabel || "Progressive"})
                            </span>
                            <span className="ytd-stream-meta">
                              {formatBytes(stream.contentLength)} • Video + Audio
                            </span>
                          </div>
                          <button 
                            className="ytd-download-icon-btn"
                            disabled={isDownloading}
                            onClick={() => handleDownload(stream, "video")}
                          >
                            {isDownloading ? (
                              /* Small micro-spinner */
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: "spin 0.8s linear infinite" }}>
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                              </svg>
                            ) : (
                              /* Down Arrow */
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14M19 12l-7 7-7-7" />
                              </svg>
                            )}
                          </button>
                        </div>
                      );
                    })
                  }

                  {activeTab === "audio" &&
                    videoInfo.adaptiveFormats
                      .filter((f) => f.mimeType.startsWith("audio/"))
                      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
                      .map((stream) => {
                        const isOpus = stream.mimeType.includes("opus");
                        const ext = isOpus ? "webm" : "m4a";
                        const kbps = Math.round((stream.bitrate || 0) / 1000);
                        const isDownloading = downloads.some(
                          (d) => d.url === stream.url && (d.status === "downloading" || d.status === "paused")
                        );
                        return (
                          <div className="ytd-stream-row" key={stream.itag}>
                            <div className="ytd-stream-info">
                              <span className="ytd-stream-label">
                                {ext.toUpperCase()} Audio ({kbps} kbps)
                              </span>
                              <span className="ytd-stream-meta">
                                {formatBytes(stream.contentLength)} • {isOpus ? "Opus" : "AAC"}
                              </span>
                            </div>
                            <button 
                              className="ytd-download-icon-btn"
                              disabled={isDownloading}
                              onClick={() => handleDownload(stream, "audio")}
                            >
                              {isDownloading ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: "spin 0.8s linear infinite" }}>
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 5v14M19 12l-7 7-7-7" />
                                </svg>
                              )}
                            </button>
                          </div>
                        );
                      })
                  }

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
                        const isDownloading = downloads.some(
                          (d) => d.url === stream.url && (d.status === "downloading" || d.status === "paused")
                        );
                        return (
                          <div className="ytd-stream-row" key={stream.itag}>
                            <div className="ytd-stream-info">
                              <span className="ytd-stream-label">
                                {isWebm ? "WEBM" : "MP4"} Video ({stream.qualityLabel})
                              </span>
                              <span className="ytd-stream-meta">
                                {formatBytes(stream.contentLength)} • Video Only
                              </span>
                            </div>
                            <button 
                              className="ytd-download-icon-btn"
                              disabled={isDownloading}
                              onClick={() => handleDownload(stream, "adaptive")}
                            >
                              {isDownloading ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: "spin 0.8s linear infinite" }}>
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 5v14M19 12l-7 7-7-7" />
                                </svg>
                              )}
                            </button>
                          </div>
                        );
                      })
                  }
                </div>
              </>
            )}

            {/* Mini Dashboard of All Active Downloads */}
            {activeJobs.length > 0 && (
              <div style={{ marginTop: "20px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "16px" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "12px", fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Active Downloads ({activeJobs.length})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "160px", overflowY: "auto", paddingRight: "4px" }}>
                  {activeJobs.map((job) => (
                    <div className="ytd-progress-card" key={job.id} style={{ margin: 0, padding: "10px 12px" }}>
                      <div className="ytd-progress-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "#e4e4e7", maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                              padding: 0,
                              display: "flex",
                              alignItems: "center"
                            }}
                          >
                            {job.status === "paused" ? (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            ) : (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="4" y="4" width="4" height="16" />
                                <rect x="16" y="4" width="4" height="16" />
                              </svg>
                            )}
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
                              padding: 0,
                              display: "flex",
                              alignItems: "center"
                            }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="ytd-progress-bar-bg" style={{ margin: "4px 0", height: "3.5px" }}>
                        <div 
                          className="ytd-progress-bar-fg" 
                          style={{
                            width: `${job.percent}%`,
                            background: job.status === "paused" ? "#fbbf24" : "linear-gradient(90deg, #f43f5e 0%, #8b5cf6 100%)"
                          }}
                        />
                      </div>
                      <div className="ytd-progress-details" style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#a1a1aa" }}>
                        <span>
                          {job.status === "paused" ? "Paused" : `${formatBytes(job.speed)}/s`}
                        </span>
                        <span>{job.percent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
