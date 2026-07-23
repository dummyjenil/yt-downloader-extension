import React from "react";
import { useTheme } from "../../context/ThemeContext";
import type { VideoInfo } from "../../types/youtube";
import { formatTime } from "../../utils/youtube";

interface VideoDetailCardProps {
  videoInfo: VideoInfo;
}

export const VideoDetailCard: React.FC<VideoDetailCardProps> = ({ videoInfo }) => {
  const { themeConfig } = useTheme();

  return (
    <div className={`flex gap-3.5 ${themeConfig.card} ${themeConfig.radius} p-3 mb-3.5 font-sans border ${themeConfig.border} shadow-lg shrink-0`}>
      <img
        src={videoInfo.thumbnail}
        alt="Video Thumbnail"
        className={`w-[130px] h-[75px] object-cover ${themeConfig.radius} border ${themeConfig.border} shrink-0`}
      />
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <span className="text-sm font-extrabold leading-snug line-clamp-2 mb-1">
          {videoInfo.title}
        </span>
        <span className={`text-xs ${themeConfig.mutedText} truncate mb-1.5 font-semibold`}>
          {videoInfo.author}
        </span>
        <span className={`${themeConfig.badge} px-2.5 py-1 text-xs font-bold w-fit`}>
          {formatTime(parseInt(videoInfo.lengthSeconds, 10))}
        </span>
      </div>
    </div>
  );
};
