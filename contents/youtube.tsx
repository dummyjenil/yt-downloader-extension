import type { PlasmoCSConfig } from "plasmo";
import React, { useEffect, useState } from "react";
import type { VideoInfo, StreamFormat, TrimRange, CaptionTrack } from "../types/youtube";
import { extractVideoId } from "../utils/youtube";

// Subcomponents and Styles
import { YOUTUBE_OVERLAY_STYLES } from "./youtube/youtube-styles";
import { FAB } from "./youtube/FAB";
import { VideoDetailCard } from "./youtube/VideoDetailCard";
import { ActiveDownloads } from "./youtube/ActiveDownloads";
import { VideoOptions } from "./youtube/VideoOptions";

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
  const [activeTab, setActiveTab] = useState<"video" | "audio" | "adaptive" | "fusion" | "subtitle">("video");
  const [trimRange, setTrimRange] = useState<TrimRange | null>(null);

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

  // Whenever videoId changes, reset video states (do NOT auto-fetch)
  useEffect(() => {
    setVideoInfo(null);
    setError(null);
    setLoading(false);
    setShowDialog(false);
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
      // Direct pure video track download from YouTube server without auto audio fusion
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

    // Send command to background to add download job
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: "ADD_DOWNLOAD_JOB",
        url: stream.url,
        title: filename,
        ext: ext,
        contentLength: scaledContentLength || "",
        audioUrl: audioUrl,
        audioSize: audioSize ? String(audioSize) : "",
        audioExt: audioExt || "",
        trimRange: trimRange && trimRange.enabled ? trimRange : undefined,
        selectedSubtitles: selectedSubtitles
      }).catch((e) => {
        console.error("Failed to add download job:", e);
        alert("Failed to initiate background downloader.");
      });
    }
  };

  // If we're not on a watch page, render nothing
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
      <style>{YOUTUBE_OVERLAY_STYLES}</style>

      {/* Floating Action Button (FAB) + Progress Circle */}
      <FAB
        onClick={() => {
          setShowDialog(true);
          if (videoId) {
            if (!videoInfo && !loading) {
              fetchInfo(videoId);
            }
          }
        }}
        isCurrentlyDownloading={isCurrentlyDownloading}
        currentDownloadStatus={currentDownloadStatus}
        circumference={circumference}
        strokeDashoffset={strokeDashoffset}
      />

      {/* Modal Dialog Popup */}
      {showDialog && (
        <div className="ytd-backdrop" onClick={() => setShowDialog(false)}>
          <div className="ytd-dialog" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
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

            {/* Detail Card (Video) */}
            {videoInfo && (
              <VideoDetailCard videoInfo={videoInfo} />
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
                <button className="ytd-error-btn" onClick={() => fetchInfo(videoId!)}>
                  Retry
                </button>
              </div>
            )}

            {/* Loaded Options Area */}
            {videoInfo && (
              <VideoOptions
                videoInfo={videoInfo}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                downloads={downloads}
                onRangeChange={setTrimRange}
                handleDownload={handleDownload}
              />
            )}

            {/* Mini Dashboard of All Active Downloads */}
            <ActiveDownloads activeJobs={activeJobs} />
          </div>
        </div>
      )}
    </div>
  );
}
