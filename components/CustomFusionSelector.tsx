import React, { useState } from "react";
import type { VideoInfo, StreamFormat } from "../types/youtube";
import { formatBytes } from "../utils/youtube";
import { themeColors, themeStyles } from "../styles/theme";

interface CustomFusionSelectorProps {
  videoInfo: VideoInfo;
  downloads: any[];
  handleDownload: (videoStream: StreamFormat, category: "fusion", audioStream: StreamFormat) => void;
}

export const CustomFusionSelector: React.FC<CustomFusionSelectorProps> = ({
  videoInfo,
  downloads,
  handleDownload
}) => {
  const videoStreams = videoInfo.adaptiveFormats
    .filter((f) => f.mimeType.startsWith("video/"))
    .sort((a, b) => {
      const qa = parseInt(a.qualityLabel || "0", 10);
      const qb = parseInt(b.qualityLabel || "0", 10);
      return qb - qa;
    });

  const audioStreams = videoInfo.adaptiveFormats
    .filter((f) => f.mimeType.startsWith("audio/"))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  const [selectedVideoIdx, setSelectedVideoIdx] = useState<number>(0);
  const [selectedAudioIdx, setSelectedAudioIdx] = useState<number>(0);

  const selectedVideo = videoStreams[selectedVideoIdx];
  const selectedAudio = audioStreams[selectedAudioIdx];

  if (!selectedVideo || !selectedAudio) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "#71717a", fontSize: "12px" }}>
        No adaptive formats available for custom fusion.
      </div>
    );
  }

  // Calculate container details
  const videoMime = selectedVideo.mimeType.toLowerCase();
  const audioMime = selectedAudio.mimeType.toLowerCase();

  const isVideoWebm = videoMime.includes("webm");
  const isAudioWebm = audioMime.includes("webm");
  const containersMatch = isVideoWebm === isAudioWebm;

  const totalSize = (parseInt(selectedVideo.contentLength || "0", 10) || 0) + 
                    (parseInt(selectedAudio.contentLength || "0", 10) || 0);

  const isDownloading = downloads.some(
    (d) =>
      d.url === selectedVideo.url &&
      d.audioUrl === selectedAudio.url &&
      (d.status === "downloading" || d.status === "paused")
  );

  const triggerDownload = () => {
    handleDownload(selectedVideo, "fusion", selectedAudio);
  };

  const getFormatLabel = (mime: string) => {
    if (mime.includes("webm")) return "WebM";
    if (mime.includes("mp4") || mime.includes("m4a")) return "MP4";
    return "Unknown";
  };

  const getCodecLabel = (mime: string) => {
    const match = mime.match(/codecs="([^"]+)"/);
    return match ? match[1].split(".")[0] : "";
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "16px",
        padding: "20px",
        boxSizing: "border-box",
        marginTop: "8px"
      }}
    >
      <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#e4e4e7" }}>
        Custom Audio & Video Fusion
      </h4>

      {/* Video Quality Selection */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontSize: "11px", fontWeight: 500, color: "#a1a1aa" }}>Select Video Track:</span>
        <select
          value={selectedVideoIdx}
          onChange={(e) => setSelectedVideoIdx(parseInt(e.target.value, 10))}
          style={{
            background: "#18181b",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "10px",
            color: "#f4f4f5",
            padding: "10px",
            fontSize: "12px",
            outline: "none",
            width: "100%",
            cursor: "pointer"
          }}
        >
          {videoStreams.map((stream, idx) => {
            const size = formatBytes(stream.contentLength);
            const container = getFormatLabel(stream.mimeType);
            const codec = getCodecLabel(stream.mimeType);
            return (
              <option key={stream.itag} value={idx}>
                {stream.qualityLabel} ({container} • {codec} • {size})
              </option>
            );
          })}
        </select>
      </div>

      {/* Audio Quality Selection */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontSize: "11px", fontWeight: 500, color: "#a1a1aa" }}>Select Audio Track:</span>
        <select
          value={selectedAudioIdx}
          onChange={(e) => setSelectedAudioIdx(parseInt(e.target.value, 10))}
          style={{
            background: "#18181b",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "10px",
            color: "#f4f4f5",
            padding: "10px",
            fontSize: "12px",
            outline: "none",
            width: "100%",
            cursor: "pointer"
          }}
        >
          {audioStreams.map((stream, idx) => {
            const size = formatBytes(stream.contentLength);
            const container = getFormatLabel(stream.mimeType);
            const kbps = Math.round((stream.bitrate || 0) / 1000);
            return (
              <option key={stream.itag} value={idx}>
                {kbps} kbps ({container} • {size})
              </option>
            );
          })}
        </select>
      </div>

      {/* Mismatched Container Hint */}
      {!containersMatch && (
        <div
          style={{
            fontSize: "11px",
            color: "#fbbf24",
            background: "rgba(245, 158, 11, 0.04)",
            border: "1px solid rgba(245, 158, 11, 0.1)",
            borderRadius: "10px",
            padding: "10px 12px",
            lineHeight: 1.4
          }}
        >
          ⚠️ <strong>Format Mismatch:</strong> You've selected an {getFormatLabel(selectedVideo.mimeType)} video with an {getFormatLabel(selectedAudio.mimeType)} audio. FFmpeg will run, but matching formats (e.g. MP4+MP4 or WebM+WebM) merge much faster.
        </div>
      )}

      {/* Summary Box */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(255, 255, 255, 0.015)",
          border: "1px solid rgba(255, 255, 255, 0.04)",
          borderRadius: "10px",
          padding: "10px 12px"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "10px", color: "#71717a" }}>Total Est. Size</span>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#c084fc" }}>
            {formatBytes(totalSize)}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-end" }}>
          <span style={{ fontSize: "10px", color: "#71717a" }}>Container Result</span>
          <span style={{ fontSize: "11px", fontWeight: 500, color: "#e4e4e7" }}>
            {isVideoWebm ? "WebM Video" : "MP4 Video"}
          </span>
        </div>
      </div>

      {/* Download Action Button */}
      <button
        onClick={triggerDownload}
        disabled={isDownloading}
        style={{
          width: "100%",
          background: isDownloading ? "rgba(255, 255, 255, 0.03)" : "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)",
          border: isDownloading ? "1px solid rgba(255, 255, 255, 0.06)" : "none",
          color: isDownloading ? "#a1a1aa" : "white",
          padding: "12px",
          borderRadius: "12px",
          fontSize: "12px",
          fontWeight: 600,
          cursor: isDownloading ? "not-allowed" : "pointer",
          transition: "all 0.2s",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "8px",
          boxShadow: isDownloading ? "none" : "0 4px 15px rgba(124, 58, 237, 0.2)"
        }}
      >
        {isDownloading ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: "spin 0.8s linear infinite" }}>
              <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)"></circle>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
            </svg>
            Downloading & Merging...
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
            FUSE & DOWNLOAD
          </>
        )}
      </button>
    </div>
  );
};
