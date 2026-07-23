import React from "react"

import { useTheme } from "../../context/ThemeContext"
import { themes, type ThemeId } from "../../styles/themeConfig"

interface PopupSettingsTabProps {
  defaultDirName: string | null
  chunkSize: number
  concurrency: number
  saveMode?: "directory" | "browser"
  handleSelectDirectory: () => void
  handleClearDirectory: () => void
  setChunkSize: (val: number) => void
  setConcurrency: (val: number) => void
  setSaveMode?: (val: "directory" | "browser") => void
}

export const PopupSettingsTab: React.FC<PopupSettingsTabProps> = ({
  defaultDirName,
  chunkSize,
  concurrency,
  saveMode = "directory",
  handleSelectDirectory,
  handleClearDirectory,
  setChunkSize,
  setConcurrency,
  setSaveMode
}) => {
  const { theme, themeConfig, setTheme } = useTheme()

  return (
    <div className="flex flex-col gap-4 flex-1">
      <h3 className="text-sm font-bold">Extension Settings</h3>

      {/* Save Mode Selector */}
      <div
        className={`${themeConfig.card} ${themeConfig.radius} p-3.5 flex flex-col gap-2`}>
        <span className="text-xs font-bold block">File Save Mode</span>
        <div className="flex flex-col gap-1.5 mt-1">
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="radio"
              name="popupSaveMode"
              value="directory"
              checked={saveMode === "directory"}
              onChange={() => setSaveMode && setSaveMode("directory")}
              className="accent-violet-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="font-semibold">
              Direct Folder Save (File System API)
            </span>
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="radio"
              name="popupSaveMode"
              value="browser"
              checked={saveMode === "browser"}
              onChange={() => setSaveMode && setSaveMode("browser")}
              className="accent-violet-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="font-semibold">
              Browser Anchor Download (Chrome Downloads)
            </span>
          </label>
        </div>
      </div>

      {/* Theme Selector */}
      <div
        className={`${themeConfig.card} ${themeConfig.radius} p-3.5 flex flex-col gap-2`}>
        <span className="text-xs font-bold block">Visual Theme</span>
        <span className={`text-xs ${themeConfig.mutedText} block`}>
          Select your favorite UI design theme:
        </span>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemeId)}
          className={`${themeConfig.input} ${themeConfig.radius} p-2.5 text-xs w-full outline-none font-bold cursor-pointer`}>
          {Object.values(themes).map((t) => (
            <option
              key={t.id}
              value={t.id}
              className="bg-zinc-900 text-zinc-100 py-1">
              {t.name} - {t.description}
            </option>
          ))}
        </select>
      </div>

      {/* Directory Access */}
      <div
        className={`${themeConfig.card} ${themeConfig.radius} p-3.5 flex flex-col gap-2`}>
        <span className="text-xs font-bold block">Default Download Folder</span>
        <div className="flex gap-2 items-center">
          <button
            onClick={handleSelectDirectory}
            className={`${themeConfig.primaryBtn} ${themeConfig.radius} px-4 py-2 text-xs font-bold transition-all cursor-pointer`}>
            {defaultDirName ? "Change Folder" : "Choose Folder"}
          </button>
          {defaultDirName && (
            <button
              onClick={handleClearDirectory}
              className={`${themeConfig.dangerBtn} ${themeConfig.radius} px-3 py-2 text-xs font-bold transition-all cursor-pointer`}>
              Clear
            </button>
          )}
        </div>
        {defaultDirName && (
          <span
            className={`text-xs ${themeConfig.accentText} mt-1 block truncate font-medium`}>
            Saving directly to: {defaultDirName}
          </span>
        )}
      </div>

      {/* Chunk Size Selector */}
      <div
        className={`${themeConfig.card} ${themeConfig.radius} p-3.5 flex flex-col gap-2`}>
        <span className="text-xs font-bold block">Chunk Size</span>
        <select
          value={chunkSize}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10)
            setChunkSize(val)
          }}
          className={`${themeConfig.input} ${themeConfig.radius} p-2.5 text-xs w-full outline-none font-bold cursor-pointer`}>
          <option value={1 * 1024 * 1024} className="bg-zinc-900 text-zinc-100">
            1 MB
          </option>
          <option value={2 * 1024 * 1024} className="bg-zinc-900 text-zinc-100">
            2 MB
          </option>
          <option value={5 * 1024 * 1024} className="bg-zinc-900 text-zinc-100">
            5 MB (Default)
          </option>
          <option
            value={10 * 1024 * 1024}
            className="bg-zinc-900 text-zinc-100">
            10 MB
          </option>
          <option
            value={20 * 1024 * 1024}
            className="bg-zinc-900 text-zinc-100">
            20 MB
          </option>
        </select>
      </div>

      {/* Concurrency limit */}
      <div
        className={`${themeConfig.card} ${themeConfig.radius} p-3.5 flex flex-col gap-2`}>
        <span className="text-xs font-bold block">Parallel Chunk Fetches</span>
        <select
          value={concurrency}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10)
            setConcurrency(val)
          }}
          className={`${themeConfig.input} ${themeConfig.radius} p-2.5 text-xs w-full outline-none font-bold cursor-pointer`}>
          <option value={1} className="bg-zinc-900 text-zinc-100">
            1 (Sequential)
          </option>
          <option value={2} className="bg-zinc-900 text-zinc-100">
            2 Parallel Chunks
          </option>
          <option value={3} className="bg-zinc-900 text-zinc-100">
            3 Parallel Chunks
          </option>
          <option value={5} className="bg-zinc-900 text-zinc-100">
            5 Parallel Chunks
          </option>
        </select>
      </div>
    </div>
  )
}
