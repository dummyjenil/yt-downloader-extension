import React from "react"

import { useTheme } from "../../context/ThemeContext"

interface PlaylistHeaderProps {
  playlistTitle?: string
  playlistAuthor?: string
  videoCount: number
  selectedCount: number
  defaultDirName: string | null
  dirPermission: string | null
  globalPreset: "1080p" | "720p" | "480p" | "audio"
  batchStarting: boolean
  onSelectDirectory: () => void
  onClearDirectory: () => void
  onToggleSelectAll: (select: boolean) => void
  onApplyGlobalPreset: (preset: "1080p" | "720p" | "480p" | "audio") => void
  onStartBatchDownload: () => void
}

export const PlaylistHeader: React.FC<PlaylistHeaderProps> = ({
  playlistTitle,
  playlistAuthor,
  videoCount,
  selectedCount,
  defaultDirName,
  dirPermission,
  globalPreset,
  batchStarting,
  onSelectDirectory,
  onClearDirectory,
  onToggleSelectAll,
  onApplyGlobalPreset,
  onStartBatchDownload
}) => {
  const { themeConfig } = useTheme()

  return (
    <div
      className={`flex flex-col gap-5 ${themeConfig.card} ${themeConfig.radius} p-6 shadow-2xl mb-6 border ${themeConfig.border}`}>
      {/* Playlist Meta Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <span
            className={`text-xs uppercase tracking-wider font-extrabold ${themeConfig.accentText}`}>
            Playlist Batch Downloader
          </span>
          <h1 className="text-xl sm:text-2xl font-black m-0 mt-1 leading-snug">
            {playlistTitle || "YouTube Playlist"}
          </h1>
          <p
            className={`text-xs sm:text-sm ${themeConfig.mutedText} font-semibold m-0 mt-1`}>
            {playlistAuthor ? `by ${playlistAuthor} • ` : ""}
            {videoCount} Videos total
          </p>
        </div>

        {/* Directory Selector Area */}
        <div
          className={`flex items-center gap-3 ${themeConfig.navContainer} ${themeConfig.radius} p-2.5 px-4`}>
          <div className="flex flex-col">
            <span
              className={`text-[10px] uppercase font-bold ${themeConfig.mutedText}`}>
              Target Save Folder
            </span>
            <span className="text-xs font-bold truncate max-w-[200px]">
              {defaultDirName && dirPermission === "granted"
                ? `📁 ${defaultDirName}`
                : "⚠️ No folder selected"}
            </span>
          </div>

          <button
            onClick={onSelectDirectory}
            className={`py-2 px-3 text-xs font-bold ${themeConfig.radius} ${themeConfig.secondaryBtn} cursor-pointer transition-all`}>
            {defaultDirName ? "Change Folder" : "Select Folder"}
          </button>
        </div>
      </div>

      {/* Global Controls & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Bulk Selection Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggleSelectAll(true)}
            className={`text-xs font-extrabold ${themeConfig.accentText} hover:underline cursor-pointer`}>
            Select All ({videoCount})
          </button>
          <span className="text-white/20">•</span>
          <button
            onClick={() => onToggleSelectAll(false)}
            className={`text-xs font-semibold ${themeConfig.mutedText} hover:underline cursor-pointer`}>
            Deselect All
          </button>
        </div>

        {/* Global Format Selector */}
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold ${themeConfig.mutedText}`}>
            Global Quality Preset:
          </span>
          <select
            value={globalPreset}
            onChange={(e) => onApplyGlobalPreset(e.target.value as any)}
            className={`appearance-none ${themeConfig.input} ${themeConfig.radius} px-3 py-1.5 text-xs font-bold outline-none cursor-pointer`}>
            <option value="1080p" className="bg-zinc-900 text-zinc-100">
              1080p Full HD MP4
            </option>
            <option value="720p" className="bg-zinc-900 text-zinc-100">
              720p HD MP4
            </option>
            <option value="480p" className="bg-zinc-900 text-zinc-100">
              480p SD MP4
            </option>
            <option value="audio" className="bg-zinc-900 text-zinc-100">
              Audio Only (M4A)
            </option>
          </select>
        </div>

        {/* Start Batch Download Button */}
        <button
          onClick={onStartBatchDownload}
          disabled={selectedCount === 0 || batchStarting}
          className={`py-3 px-6 text-xs font-black ${themeConfig.radius} ${themeConfig.primaryBtn} shadow-lg cursor-pointer disabled:opacity-50 flex items-center gap-2`}>
          {batchStarting ? (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
              </svg>
              Preparing Batch...
            </>
          ) : (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
              Download Selected ({selectedCount})
            </>
          )}
        </button>
      </div>
    </div>
  )
}
