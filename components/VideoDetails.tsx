import React from "react";
import type { VideoInfo } from "../types/youtube";
import { formatDuration } from "../utils/youtube";
import { themeStyles } from "../styles/theme";

interface VideoDetailsProps {
  videoInfo: VideoInfo;
}

export const VideoDetails: React.FC<VideoDetailsProps> = ({ videoInfo }) => {
  return (
    <div style={themeStyles.glassCard}>
      <div style={themeStyles.thumbnailWrapper}>
        <img src={videoInfo.thumbnail} alt={videoInfo.title} style={themeStyles.thumbnail} />
        <div style={themeStyles.durationBadge}>{formatDuration(videoInfo.lengthSeconds)}</div>
      </div>
      <h3 style={themeStyles.title}>{videoInfo.title}</h3>
      <div style={themeStyles.author}>
        {/* Minimal video play icon inline */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.8 }}
        >
          <circle cx="12" cy="12" r="10"></circle>
          <polygon points="10 8 16 12 10 16 10 8"></polygon>
        </svg>
        <span>{videoInfo.author}</span>
      </div>
    </div>
  );
};
