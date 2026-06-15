import { useEffect, useState } from "react";
import React from "react";

// Imports from modularized layout
import type { VideoInfo, StreamFormat } from "./types/youtube";
import { extractVideoId, formatBytes } from "./utils/youtube";
import { themeStyles } from "./styles/theme";

// Components
import { Header } from "./components/Header";
import { UrlForm } from "./components/UrlForm";
import { VideoDetails } from "./components/VideoDetails";
import { StreamTabs } from "./components/StreamTabs";
import { StreamRow } from "./components/StreamRow";
import { DownloadStatus } from "./components/DownloadStatus";
import { Placeholder } from "./components/Placeholder";

function IndexPopup() {
  const [urlInput, setUrlInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"video" | "audio" | "adaptive">("video");
  const [downloadingItag, setDownloadingItag] = useState<number | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);

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

  // Check for active downloads and listen to progress updates
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "GET_DOWNLOAD_STATUS" }, (response) => {
        if (response && response.downloading) {
          setDownloadingItag(response.itag);
          setDownloadStatus(response.status);
        }
      });

      const listener = (message: any) => {
        if (message.type === "DOWNLOAD_PROGRESS") {
          setDownloadingItag(message.itag);
          setDownloadPercent(message.percent);
          setDownloadStatus(
            `Downloading: ${message.percent}% (${formatBytes(message.downloaded)} / ${formatBytes(message.total)})`
          );
        } else if (message.type === "DOWNLOAD_COMPLETE") {
          setDownloadingItag(null);
          setDownloadPercent(null);
          setDownloadStatus("Saving file... Check browser downloads.");
          setTimeout(() => setDownloadStatus(null), 5000);
        } else if (message.type === "DOWNLOAD_FAILED") {
          setDownloadingItag(null);
          setDownloadPercent(null);
          setDownloadStatus(`Download failed: ${message.error}`);
          setTimeout(() => setDownloadStatus(null), 6000);
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
    setDownloadStatus(null);

    chrome.runtime.sendMessage(
      { type: "GET_VIDEO_INFO", videoId: id },
      (response) => {
        setLoading(false);
        if (chrome.runtime.lastError) {
          setError(chrome.runtime.lastError.message || "Failed to communicate with service worker.");
        } else if (response && response.success) {
          setVideoInfo(response.info);
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
    setDownloadingItag(stream.itag);
    setDownloadStatus("Starting download...");

    let ext = "mp4";
    if (category === "audio") {
      ext = stream.mimeType.includes("webm") ? "webm" : "m4a";
    } else if (stream.mimeType.includes("webm")) {
      ext = "webm";
    }

    const suffix = stream.qualityLabel ? `_${stream.qualityLabel}` : "";
    const filename = `${videoInfo.title}${suffix}`;

    const downloadPageUrl = chrome.runtime.getURL(
      `tabs/download.html?url=${encodeURIComponent(stream.url)}&title=${encodeURIComponent(filename)}&ext=${ext}&contentLength=${stream.contentLength || ""}`
    );
    chrome.tabs.create({ url: downloadPageUrl });

    setDownloadingItag(null);
    setDownloadStatus(null);
  };

  return (
    <div style={themeStyles.container}>
      {/* Header with App Logo and Status Badge */}
      <Header />

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
          <span style={{ fontSize: "12px", color: "#a1a1aa" }}>Extracting media streams...</span>
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
                  isDownloading={downloadingItag === stream.itag}
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
                      isDownloading={downloadingItag === stream.itag}
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
                      isDownloading={downloadingItag === stream.itag}
                      onDownload={() => handleDownload(stream, "adaptive")}
                    />
                  );
                })}
          </div>
        </>
      )}

      {/* Download Progress & Toast Feedback */}
      <DownloadStatus status={downloadStatus} percent={downloadPercent} />

      {/* Welcome Placeholder */}
      {!videoInfo && !loading && <Placeholder />}
    </div>
  );
}

export default IndexPopup;
