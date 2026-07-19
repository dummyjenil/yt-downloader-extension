import React from "react";
import type { VideoInfo } from "../types/youtube";
import { formatDuration } from "../utils/youtube";

interface VideoDetailsProps {
  videoInfo: VideoInfo;
}

export const VideoDetails: React.FC<VideoDetailsProps> = ({ videoInfo }) => {
  return (
    <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-3.5 mb-4 shadow-xl">
      <div className="relative rounded-xl overflow-hidden mb-3 border border-white/10">
        <img src={videoInfo.thumbnail} alt={videoInfo.title} className="w-full block" />
        <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-semibold text-white tracking-wide">
          {formatDuration(videoInfo.lengthSeconds)}
        </div>
      </div>
      <h3 className="text-xs font-semibold text-zinc-100 mb-1.5 leading-snug line-clamp-2">
        {videoInfo.title}
      </h3>
      <div className="text-[11px] text-zinc-400 flex items-center gap-1">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-80"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <polygon points="10 8 16 12 10 16 10 8"></polygon>
        </svg>
        <span>{videoInfo.author}</span>
      </div>
    </div>
  );
};
