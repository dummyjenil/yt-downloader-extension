import React from "react"

import { useTheme } from "../context/ThemeContext"
import type { VideoInfo } from "../types/youtube"
import { formatDuration } from "../utils/youtube"

interface VideoDetailsProps {
  videoInfo: VideoInfo
}

export const VideoDetails: React.FC<VideoDetailsProps> = ({ videoInfo }) => {
  const { themeConfig } = useTheme()

  return (
    <div
      className={`${themeConfig.card} ${themeConfig.radius} p-4 mb-5 ${themeConfig.shadow}`}>
      <div
        className={`relative ${themeConfig.radius} overflow-hidden mb-3 border ${themeConfig.border}`}>
        <img
          src={videoInfo.thumbnail}
          alt={videoInfo.title}
          className="w-full block object-cover max-h-[220px]"
        />
        <div className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-bold text-white tracking-wide border border-white/20">
          {formatDuration(videoInfo.lengthSeconds)}
        </div>
      </div>
      <h3 className="text-sm font-bold leading-snug line-clamp-2 mb-2">
        {videoInfo.title}
      </h3>
      <div
        className={`text-xs ${themeConfig.mutedText} flex items-center gap-1.5 font-medium`}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polygon points="10 8 16 12 10 16 10 8"></polygon>
        </svg>
        <span>{videoInfo.author}</span>
      </div>
    </div>
  )
}
