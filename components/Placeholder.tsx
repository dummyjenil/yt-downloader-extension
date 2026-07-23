import React from "react"

import { useTheme } from "../context/ThemeContext"

export const Placeholder: React.FC = () => {
  const { themeConfig } = useTheme()

  return (
    <div
      className={`flex flex-col items-center justify-center flex-1 py-12 px-4 text-center ${themeConfig.mutedText}`}>
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`mb-4 opacity-50 ${themeConfig.accentText}`}>
        <path d="M23 7 16 12 23 17 23 7z" />
        <rect x="1" y="5" width="15" height="14" rx="3" ry="3" />
      </svg>
      <span className="text-base font-bold text-zinc-100 mb-1.5">
        Ready to Download
      </span>
      <span className="text-xs leading-relaxed max-w-[280px]">
        Open a YouTube video or paste a link above to fetch high-speed streams
        locally.
      </span>
    </div>
  )
}
