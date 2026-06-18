import React from "react";
import type { VideoInfo } from "../../types/youtube";
import { formatTime } from "../../utils/youtube";

interface VideoDetailCardProps {
  videoInfo: VideoInfo;
}

export const VideoDetailCard: React.FC<VideoDetailCardProps> = ({ videoInfo }) => {
  return (
    <div className="ytd-detail-card">
      <img 
        className="ytd-thumb" 
        src={videoInfo.thumbnail} 
        alt="Video Thumbnail" 
      />
      <div className="ytd-detail-meta">
        <span className="ytd-meta-title">{videoInfo.title}</span>
        <span className="ytd-meta-channel">{videoInfo.author}</span>
        <span className="ytd-duration-badge">
          {formatTime(parseInt(videoInfo.lengthSeconds, 10))}
        </span>
      </div>
    </div>
  );
};
