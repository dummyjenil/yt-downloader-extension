import React from "react";
import type { VideoInfo, StreamFormat } from "../../types/youtube";
import { formatBytes } from "../../utils/youtube";
import { CustomFusionSelector } from "../../components/CustomFusionSelector";

interface VideoOptionsProps {
  videoInfo: VideoInfo;
  activeTab: "video" | "audio" | "adaptive" | "fusion";
  setActiveTab: (tab: "video" | "audio" | "adaptive" | "fusion") => void;
  downloads: any[];
  handleDownload: (
    stream: StreamFormat,
    category: "video" | "audio" | "adaptive" | "fusion",
    customAudioStream?: StreamFormat
  ) => void;
}

export const VideoOptions: React.FC<VideoOptionsProps> = ({
  videoInfo,
  activeTab,
  setActiveTab,
  downloads,
  handleDownload
}) => {
  return (
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
  );
};
