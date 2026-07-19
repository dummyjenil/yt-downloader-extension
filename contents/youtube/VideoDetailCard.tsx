import React from "react";
import type { VideoInfo } from "../../types/youtube";
import { formatTime } from "../../utils/youtube";

interface VideoDetailCardProps {
  videoInfo: VideoInfo;
}

export const VideoDetailCard: React.FC<VideoDetailCardProps> = ({ videoInfo }) => {
  return (
    <div className="flex gap-3 bg-white/[0.02] border border-white/5 rounded-2xl p-3 mb-4 font-sans">
      <img
        src={videoInfo.thumbnail}
        alt="Video Thumbnail"
        className="w-[90px] h-[50px] object-cover rounded-lg border border-white/10 shrink-0"
      />
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <span className="text-xs font-semibold text-zinc-200 truncate mb-0.5">
          {videoInfo.title}
        </span>
        <span className="text-[10px] text-zinc-400 truncate mb-1">
          {videoInfo.author}
        </span>
        <span className="bg-violet-500/10 text-purple-300 px-1.5 py-0.5 rounded text-[9px] font-semibold border border-violet-500/20 w-fit">
          {formatTime(parseInt(videoInfo.lengthSeconds, 10))}
        </span>
      </div>
    </div>
  );
};
