import type { PlasmoCSConfig } from "plasmo";
import React, { useEffect, useState } from "react";
import styleText from "data-text:../styles/globals.css";
import type { VideoInfo, StreamFormat, TrimRange, CaptionTrack } from "../types/youtube";
import { extractVideoId, extractPlaylistId } from "../utils/youtube";
import { ThemeProvider, useTheme } from "../context/ThemeContext";

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

function YoutubeOverlayContent() {
  const { themeConfig } = useTheme();
  const [videoId, setVideoId] = useState<string | null>(null);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
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
    // Inject Outfit Google Font
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const handleUrlChange = () => {
      const url = window.location.href;
      const id = extractVideoId(url);
      const pId = extractPlaylistId(url);
      setVideoId(id);
      setPlaylistId(pId);
    };

    handleUrlChange();

    window.addEventListener("yt-navigate-finish", handleUrlChange);
    const interval = setInterval(handleUrlChange, 1000);

    return () => {
      window.removeEventListener("yt-navigate-finish", handleUrlChange);
      clearInterval(interval);
    };
  }, []);

  // Sync active downloads registry
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "GET_ACTIVE_DOWNLOADS" }, (response) => {
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
        videoId: videoInfo.videoId || videoId,
        title: filename,
        ext: ext,
        contentLength: scaledContentLength || "",
        audioUrl: audioUrl,
        audioSize: audioSize ? String(audioSize) : "",
        audioExt: audioExt || "",
        trimRange: trimRange && trimRange.enabled ? trimRange : undefined,
        selectedSubtitles: selectedSubtitles,
        embedThumbnail: true,
        embedChapters: true
      }).catch((e) => {
        console.error("Failed to add download job:", e);
        alert("Failed to initiate background downloader.");
      });
    }
  };

  if (!videoId && !playlistId) return null;

  const activeJobs = downloads.filter((d) => d.status === "downloading" || d.status === "paused");
  const cleanTitleForMatch = videoInfo ? videoInfo.title.replace(/[\\/:*?"<>|]/g, "_") : "";
  const currentVideoJob = activeJobs.find(
    (d) => d.title.includes(cleanTitleForMatch) || cleanTitleForMatch.includes(d.title)
  );

  const isCurrentlyDownloading = currentVideoJob !== undefined;
  const currentDownloadPercent = currentVideoJob ? currentVideoJob.percent : null;
  const currentDownloadStatus = currentVideoJob ? currentVideoJob.status : null;

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = currentDownloadPercent !== null
    ? circumference - (circumference * currentDownloadPercent) / 100
    : circumference;

  return (
    <div className="font-sans text-base">
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[99999999] animate-fadeIn p-4 sm:p-5 overflow-y-auto" onClick={() => setShowDialog(false)}>
          <div className={`w-full max-w-[600px] max-h-[85vh] my-auto ${themeConfig.container} ${themeConfig.radius} shadow-2xl p-5 sm:p-6 flex flex-col box-border overflow-y-auto animate-slideUp border-2 ${themeConfig.border}`} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className={`flex justify-between items-start mb-4 pb-3 border-b ${themeConfig.border} shrink-0`}>
              <div className="flex-1 pr-4">
                <h3 className="text-base sm:text-lg font-black m-0 mb-1 leading-snug line-clamp-2">
                  {videoInfo ? videoInfo.title : (playlistId ? "YouTube Playlist Page" : "Extracting Video Streams")}
                </h3>
                <p className={`text-xs sm:text-sm ${themeConfig.mutedText} m-0 font-bold`}>
                  {videoInfo ? `by ${videoInfo.author}` : (playlistId ? "Playlist batch downloader ready" : "Please wait...")}
                </p>
              </div>
              <button
                className={`w-9 h-9 sm:w-10 sm:h-10 ${themeConfig.radius} ${themeConfig.secondaryBtn} flex items-center justify-center cursor-pointer transition-all hover:rotate-90 p-0 shrink-0`}
                onClick={() => setShowDialog(false)}
                title="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Playlist Banner Alert */}
            {playlistId && (
              <div className={`p-4 mb-4 bg-gradient-to-r from-violet-600/30 to-fuchsia-600/30 border border-violet-500/40 ${themeConfig.radius} flex items-center justify-between gap-3 shadow-lg shrink-0`}>
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase text-violet-300 tracking-wider">
                    🎵 Playlist Detected
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white mt-0.5">
                    Batch Download entire playlist with custom video quality & audio settings
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowDialog(false);
                    if (typeof chrome !== "undefined" && chrome.runtime) {
                      chrome.runtime.sendMessage({ type: "OPEN_PLAYLIST_TAB", playlistId });
                    }
                  }}
                  className={`py-2 px-4 text-xs font-black ${themeConfig.radius} ${themeConfig.primaryBtn} shadow-md cursor-pointer shrink-0`}
                >
                  Open Playlist Manager 🚀
                </button>
              </div>
            )}

            {/* Detail Card (Video) */}
            {videoInfo && (
              <VideoDetailCard videoInfo={videoInfo} />
            )}

            {/* Loader State */}
            {loading && (
              <div className={`flex flex-col items-center justify-center py-12 ${themeConfig.mutedText} text-base font-bold`}>
                <div className="w-10 h-10 border-4 border-white/10 border-t-violet-400 rounded-full animate-spin mb-4"></div>
                <span>Parsing YouTube streaming configuration...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="text-base text-rose-400 leading-relaxed p-5 bg-rose-500/10 border border-rose-500/30 rounded-2xl mt-2 text-center font-bold">
                <div>{error}</div>
                <button
                  className={`${themeConfig.dangerBtn} ${themeConfig.radius} mt-4 px-6 py-2.5 text-sm font-black cursor-pointer`}
                  onClick={() => fetchInfo(videoId!)}
                >
                  Retry Extraction
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

export default function YoutubeOverlay() {
  return (
    <ThemeProvider>
      <YoutubeOverlayContent />
    </ThemeProvider>
  );
}
