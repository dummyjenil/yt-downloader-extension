import type { PlasmoCSConfig } from "plasmo";
import React, { useEffect, useState } from "react";
import type { VideoInfo, StreamFormat } from "../types/youtube";
import { extractVideoId, extractPlaylistId } from "../utils/youtube";

// Subcomponents and Styles
import { YOUTUBE_OVERLAY_STYLES } from "./youtube/youtube-styles";
import { FAB } from "./youtube/FAB";
import { VideoDetailCard } from "./youtube/VideoDetailCard";
import { PlaylistDetailCard } from "./youtube/PlaylistDetailCard";
import { ActiveDownloads } from "./youtube/ActiveDownloads";
import { VideoOptions } from "./youtube/VideoOptions";
import { PlaylistOptions } from "./youtube/PlaylistOptions";

// Content Script Configuration to run on all YouTube domains
export const config: PlasmoCSConfig = {
  matches: ["*://*.youtube.com/*"]
};

export default function YoutubeOverlay() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [playlistInfo, setPlaylistInfo] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"video" | "audio" | "adaptive">("video");

  // Playlist state variables
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<"default" | "title-asc" | "title-desc" | "duration-asc" | "duration-desc">("default");
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [rangeStart, setRangeStart] = useState("1");
  const [rangeEnd, setRangeEnd] = useState("10");
  const [playlistBatchSize, setPlaylistBatchSize] = useState(3);

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
      const listId = extractPlaylistId(url);
      
      if (window.location.pathname.startsWith("/playlist")) {
        setVideoId(null);
        setPlaylistId(listId);
      } else {
        setVideoId(id);
        setPlaylistId(null);
      }
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

  // Whenever playlistId changes, fetch playlist data
  useEffect(() => {
    if (playlistId) {
      fetchPlaylistData(playlistId);
    } else {
      setPlaylistInfo(null);
      setError(null);
      setLoading(false);
      setShowDialog(false);
    }
  }, [playlistId]);

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

  const fetchPlaylistData = (id: string) => {
    setLoading(true);
    setError(null);
    setPlaylistInfo(null);

    chrome.runtime.sendMessage(
      { type: "GET_PLAYLIST_INFO", playlistId: id },
      (response) => {
        setLoading(false);
        if (chrome.runtime.lastError) {
          setError("Failed to communicate with YouTube Downloader background.");
        } else if (response && response.success) {
          setPlaylistInfo(response.info);
          const ids = new Set<string>(response.info.videos.map((v: any) => v.videoId));
          setSelectedVideoIds(ids);
          setRangeEnd(String(response.info.videos.length));
        } else {
          setError(response?.error || "Unable to extract playlist details.");
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

  const handlePlaylistDownload = () => {
    if (!playlistInfo) return;
    const selectedVideos = playlistInfo.videos.filter((v: any) => selectedVideoIds.has(v.videoId));
    if (selectedVideos.length === 0) {
      alert("Please select at least one video to download.");
      return;
    }

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.storage.local.set({ maxConcurrentJobs: playlistBatchSize }, () => {
        chrome.runtime.sendMessage({
          type: "ADD_PLAYLIST_JOBS",
          videos: selectedVideos.map((v: any) => ({
            videoId: v.videoId,
            title: v.title
          })),
          playlistName: playlistInfo.title
        }).then(() => {
          setShowDialog(false);
        }).catch((e) => {
          console.error("Failed to add playlist jobs:", e);
          alert("Failed to start playlist downloader.");
        });
      });
    }
  };

  // If we're not on a watch or playlist page, render nothing
  if (!videoId && !playlistId) return null;

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
        onClick={() => setShowDialog(true)}
        isCurrentlyDownloading={isCurrentlyDownloading}
        currentDownloadStatus={currentDownloadStatus}
        circumference={circumference}
        strokeDashoffset={strokeDashoffset}
      />

      {/* Modal Dialog Popup */}
      {showDialog && (
        <div className="ytd-backdrop" onClick={() => setShowDialog(false)}>
          <div className="ytd-dialog" style={{ maxWidth: playlistId ? "520px" : "420px" }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="ytd-dialog-header">
              <div className="ytd-dialog-title-area">
                <h3 className="ytd-dialog-title">
                  {playlistId 
                    ? (playlistInfo ? playlistInfo.title : "Extracting Playlist Details")
                    : (videoInfo ? videoInfo.title : "Extracting Video Streams")
                  }
                </h3>
                <p className="ytd-dialog-subtitle">
                  {playlistId
                    ? (playlistInfo ? `by ${playlistInfo.author}` : "Please wait...")
                    : (videoInfo ? `by ${videoInfo.author}` : "Please wait...")
                  }
                </p>
              </div>
              <button className="ytd-close-btn" onClick={() => setShowDialog(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Detail Card (Video or Playlist) */}
            {!playlistId && videoInfo && (
              <VideoDetailCard videoInfo={videoInfo} />
            )}

            {playlistId && playlistInfo && (
              <PlaylistDetailCard playlistInfo={playlistInfo} />
            )}

            {/* Loader State */}
            {loading && (
              <div className="ytd-loader-wrapper">
                <div className="ytd-spinner"></div>
                <span>{playlistId ? "Parsing YouTube playlist database..." : "Parsing InnerTube streaming configuration..."}</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="ytd-error">
                <div>{error}</div>
                <button className="ytd-error-btn" onClick={() => playlistId ? fetchPlaylistData(playlistId) : fetchInfo(videoId!)}>
                  Retry
                </button>
              </div>
            )}

            {/* Playlist Options Area */}
            {playlistId && playlistInfo && (
              <PlaylistOptions
                playlistInfo={playlistInfo}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                sortOption={sortOption}
                setSortOption={setSortOption}
                selectedVideoIds={selectedVideoIds}
                setSelectedVideoIds={setSelectedVideoIds}
                rangeStart={rangeStart}
                setRangeStart={setRangeStart}
                rangeEnd={rangeEnd}
                setRangeEnd={setRangeEnd}
                playlistBatchSize={playlistBatchSize}
                setPlaylistBatchSize={setPlaylistBatchSize}
                handlePlaylistDownload={handlePlaylistDownload}
              />
            )}

            {/* Loaded Options Area */}
            {!playlistId && videoInfo && (
              <VideoOptions
                videoInfo={videoInfo}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                downloads={downloads}
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
