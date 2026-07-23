import { useEffect, useState } from "react";
import type { VideoInfo, TrimRange } from "../types/youtube";
import { extractVideoId, extractPlaylistId } from "../utils/youtube";

export function useVideoInfo() {
  const [urlInput, setUrlInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"video" | "audio" | "adaptive" | "fusion" | "subtitle">("video");
  const [trimRange, setTrimRange] = useState<TrimRange | null>(null);

  // Auto detect active YouTube tab video ID and playlist ID
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeBrowserTab = tabs[0];
        if (activeBrowserTab && activeBrowserTab.url) {
          const id = extractVideoId(activeBrowserTab.url);
          const pId = extractPlaylistId(activeBrowserTab.url);
          if (pId) setPlaylistId(pId);
          if (id) {
            setVideoId(id);
            fetchInfo(id);
          }
        }
      });
    }
  }, []);

  const openPlaylistTab = (pId?: string) => {
    const targetId = pId || playlistId;
    if (targetId && typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "OPEN_PLAYLIST_TAB", playlistId: targetId });
    }
  };

  const fetchInfo = (id: string) => {
    setLoading(true);
    setError(null);
    setVideoInfo(null);

    if (typeof chrome !== "undefined" && chrome.runtime) {
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
    } else {
      setLoading(false);
      setError("Chrome runtime unavailable.");
    }
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

  return {
    urlInput,
    setUrlInput,
    videoId,
    playlistId,
    openPlaylistTab,
    loading,
    error,
    videoInfo,
    activeTab,
    setActiveTab,
    trimRange,
    setTrimRange,
    fetchInfo,
    handleManualSubmit
  };
}
