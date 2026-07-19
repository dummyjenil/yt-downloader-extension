import type { PlasmoCSConfig } from "plasmo";
import React, { useEffect, useState } from "react";
import styleText from "data-text:../styles/globals.css";
import type { VideoInfo, StreamFormat, TrimRange, CaptionTrack } from "../types/youtube";
import { extractVideoId } from "../utils/youtube";

// Subcomponents
import { FAB } from "./youtube/FAB";
import { VideoDetailCard } from "./youtube/VideoDetailCard";
import { ActiveDownloads } from "./youtube/ActiveDownloads";
import { VideoOptions } from "./youtube/VideoOptions";

// Content Script Configuration to run on all YouTube domains
export const config: PlasmoCSConfig = {
  matches: ["*://*.youtube.com/*"]
};

export const getStyle = () => {
  const style = document.createElement("style");
  style.textContent = styleText;
  return style;
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

  if (!videoId) return null;

  const activeJobs = downloads.filter((d) => d.status === "downloading" || d.status === "paused");
  const cleanTitleForMatch = videoInfo ? videoInfo.title.replace(/[\\/:*?"<>|]/g, "_") : "";
  const currentVideoJob = activeJobs.find(
    (d) => d.title.includes(cleanTitleForMatch) || cleanTitleForMatch.includes(d.title)
  );

  const isCurrentlyDownloading = currentVideoJob !== undefined;
  const currentDownloadPercent = currentVideoJob ? currentVideoJob.percent : null;
  const currentDownloadStatus = currentVideoJob ? currentVideoJob.status : null;

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = currentDownloadPercent !== null
    ? circumference - (circumference * currentDownloadPercent) / 100
    : circumference;

  return (
    <div className="font-sans text-zinc-100">
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
        <div className="fixed inset-0 bg-black/65 backdrop-blur-md flex items-center justify-center z-[99999999] animate-fadeIn" onClick={() => setShowDialog(false)}>
          <div className="w-[90%] max-w-[420px] bg-zinc-900/95 border border-white/10 rounded-3xl shadow-2xl p-6 flex flex-col box-border overflow-hidden animate-slideUp" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-start mb-5">
              <div className="flex-1 pr-3">
                <h3 className="text-sm font-bold m-0 mb-1 leading-snug text-zinc-100 line-clamp-2">
                  {videoInfo ? videoInfo.title : "Extracting Video Streams"}
                </h3>
                <p className="text-[11px] text-zinc-400 m-0 font-medium">
                  {videoInfo ? `by ${videoInfo.author}` : "Please wait..."}
                </p>
              </div>
              <button
                className="w-8 h-8 rounded-full bg-white/[0.03] hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-zinc-100 flex items-center justify-center cursor-pointer transition-all hover:rotate-90 p-0 shrink-0"
                onClick={() => setShowDialog(false)}
              >
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
              <div className="flex flex-col items-center justify-center py-8 text-zinc-400 text-xs">
                <div className="w-6 h-6 border-2 border-white/5 border-t-purple-400 rounded-full animate-spin mb-3"></div>
                <span>Parsing InnerTube streaming configuration...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="text-xs text-rose-400 leading-relaxed p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl mt-2 text-center">
                <div>{error}</div>
                <button
                  className="mt-2.5 bg-rose-500 hover:bg-rose-600 text-white px-3.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer"
                  onClick={() => fetchInfo(videoId!)}
                >
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
