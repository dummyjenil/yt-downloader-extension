import React from "react";
import type { VideoInfo, StreamFormat, TrimRange, CaptionTrack } from "../../types/youtube";
import { formatBytes } from "../../utils/youtube";
import { CustomFusionSelector } from "../../components/CustomFusionSelector";
import { RangeSelector } from "../../components/RangeSelector";

interface VideoOptionsProps {
  videoInfo: VideoInfo;
  activeTab: "video" | "audio" | "adaptive" | "fusion" | "subtitle";
  setActiveTab: (tab: "video" | "audio" | "adaptive" | "fusion" | "subtitle") => void;
  downloads: any[];
  onRangeChange?: (range: TrimRange) => void;
  handleDownload: (
    stream: StreamFormat,
    category: "video" | "audio" | "adaptive" | "fusion" | "subtitle",
    customAudioStream?: StreamFormat,
    selectedSubtitles?: CaptionTrack[]
  ) => void;
}

export const VideoOptions: React.FC<VideoOptionsProps> = ({
  videoInfo,
  activeTab,
  setActiveTab,
  downloads,
  onRangeChange,
  handleDownload
}) => {
  const totalSec = parseInt(videoInfo.lengthSeconds || "0", 10);

  return (
    <>
      {/* Range Trimmer Component */}
      {onRangeChange && (
        <RangeSelector totalDurationSec={totalSec} onChange={onRangeChange} />
      )}

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
        <button 
          className={`ytd-tab-btn ${activeTab === "subtitle" ? "active" : ""}`}
          onClick={() => setActiveTab("subtitle")}
        >
          Subtitles (SRT)
        </button>
        <button 
          className={`ytd-tab-btn ${activeTab === "fusion" ? "active" : ""}`}
          onClick={() => setActiveTab("fusion")}
        >
          Custom Fusion
        </button>
      </div>

      {/* Lists Area */}
      <div className="ytd-stream-list">
        {activeTab === "fusion" && (
          <CustomFusionSelector
            videoInfo={videoInfo}
            downloads={downloads}
            handleDownload={handleDownload as any}
          />
        )}

        {activeTab === "subtitle" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(!videoInfo.captionTracks || videoInfo.captionTracks.length === 0) ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#71717a", fontSize: "12px" }}>
                No caption tracks available for this video.
              </div>
            ) : (
              videoInfo.captionTracks.map((track, idx) => {
                const isDownloading = downloads.some(
                  (d) => d.url === track.baseUrl && (d.status === "downloading" || d.status === "paused")
                );
                const subtitleStream: StreamFormat = {
                  itag: 99000 + idx,
                  url: track.baseUrl,
                  mimeType: "text/srt",
                  qualityLabel: track.name
                };

                return (
                  <div className="ytd-stream-row" key={track.baseUrl + idx}>
                    <div className="ytd-stream-info">
                      <span className="ytd-stream-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        💬 {track.name}
                        <span style={{ fontSize: "10px", background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", padding: "1px 6px", borderRadius: "4px", border: "1px solid rgba(168, 85, 247, 0.3)" }}>
                          [{track.code}]
                        </span>
                      </span>
                      <span className="ytd-stream-meta">
                        Word-level SRT Format • Subtitle Track
                      </span>
                    </div>
                    <button 
                      className="ytd-download-icon-btn"
                      disabled={isDownloading}
                      onClick={() => handleDownload(subtitleStream, "subtitle")}
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
            )}
          </div>
        )}

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

        {activeTab === "audio" &&
          videoInfo.adaptiveFormats
            .filter((f) => f.mimeType.startsWith("audio/"))
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
            .map((stream) => {
              const isOpus = stream.mimeType.includes("opus");
              const ext = isOpus ? "webm" : "m4a";
              const kbps = Math.round((stream.bitrate || 0) / 1000);
              const langTag = stream.displayName || (stream.langCode ? `Language: ${stream.langCode}` : "Default Audio");
              const isDownloading = downloads.some(
                (d) => d.url === stream.url && (d.status === "downloading" || d.status === "paused")
              );
              return (
                <div className="ytd-stream-row" key={`${stream.itag}_${stream.langCode || "def"}`}>
                  <div className="ytd-stream-info">
                    <span className="ytd-stream-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      🎵 {ext.toUpperCase()} Audio ({kbps} kbps)
                      {stream.langCode && (
                        <span style={{ fontSize: "10px", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", padding: "1px 6px", borderRadius: "4px", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
                          [{stream.langCode}]
                        </span>
                      )}
                    </span>
                    <span className="ytd-stream-meta">
                      {formatBytes(stream.contentLength)} • {langTag} • {isOpus ? "Opus" : "AAC"}
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
  );
};

