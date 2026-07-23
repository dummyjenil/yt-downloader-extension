import React, { useState } from "react"

import { CustomFusionSelector } from "../../components/CustomFusionSelector"
import { RangeSelector } from "../../components/RangeSelector"
import { StreamRow } from "../../components/StreamRow"
import { StreamTabs } from "../../components/StreamTabs"
import { useTheme } from "../../context/ThemeContext"
import type {
  AudioLanguage,
  CaptionTrack,
  StreamFormat,
  TrimRange,
  VideoInfo
} from "../../types/youtube"
import { formatBytes } from "../../utils/youtube"

interface VideoOptionsProps {
  videoInfo: VideoInfo
  activeTab: "video" | "audio" | "adaptive" | "fusion" | "subtitle"
  setActiveTab: (
    tab: "video" | "audio" | "adaptive" | "fusion" | "subtitle"
  ) => void
  downloads: any[]
  onRangeChange?: (range: TrimRange) => void
  handleDownload: (
    stream: StreamFormat,
    category: "video" | "audio" | "adaptive" | "fusion" | "subtitle",
    customAudioStream?: StreamFormat,
    selectedSubtitles?: CaptionTrack[]
  ) => void
  selectedLang?: string | null
  setSelectedLang?: (lang: string | null) => void
}

export const VideoOptions: React.FC<VideoOptionsProps> = ({
  videoInfo,
  activeTab,
  setActiveTab,
  downloads,
  onRangeChange,
  handleDownload,
  selectedLang,
  setSelectedLang
}) => {
  const { themeConfig } = useTheme()
  const totalSec = parseInt(videoInfo.lengthSeconds || "0", 10)
  const [trimRange, setTrimRange] = useState<TrimRange>({
    enabled: false,
    startTimeSec: 0,
    endTimeSec: totalSec || 180
  })

  const handleRangeChange = (range: TrimRange) => {
    setTrimRange(range)
    if (onRangeChange) onRangeChange(range)
  }

  const trimmedRatio =
    trimRange.enabled && totalSec > 0
      ? Math.max(
          0.005,
          Math.min(
            1.0,
            (trimRange.endTimeSec - trimRange.startTimeSec) / totalSec
          )
        )
      : 1.0

  return (
    <>
      {/* Range Trimmer Component */}
      <RangeSelector totalDurationSec={totalSec} onChange={handleRangeChange} />

      {/* Tabs Component */}
      <StreamTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Lists Area using shared StreamRow components */}
      <div className="flex flex-col gap-3 min-h-[280px] max-h-[440px] sm:max-h-[500px] overflow-y-auto pr-1.5 pb-2 mb-4 font-sans no-scrollbar">
        {activeTab === "fusion" && (
          <CustomFusionSelector
            videoInfo={videoInfo}
            downloads={downloads}
            trimRange={trimRange}
            handleDownload={handleDownload as any}
            selectedLang={selectedLang}
            setSelectedLang={setSelectedLang}
          />
        )}

        {activeTab === "subtitle" && (
          <div className="flex flex-col gap-2.5">
            {!videoInfo.captionTracks ||
            videoInfo.captionTracks.length === 0 ? (
              <div
                className={`p-8 text-center ${themeConfig.mutedText} text-sm font-semibold ${themeConfig.card} ${themeConfig.radius}`}>
                No caption tracks available for this video.
              </div>
            ) : (
              videoInfo.captionTracks.map((track, idx) => {
                const isDownloading = downloads.some(
                  (d) =>
                    d.url === track.baseUrl &&
                    (d.status === "downloading" || d.status === "paused")
                )
                const subtitleStream: StreamFormat = {
                  itag: 99000 + idx,
                  url: track.baseUrl,
                  mimeType: "text/srt",
                  qualityLabel: track.name
                }

                return (
                  <StreamRow
                    key={track.baseUrl + idx}
                    label={`${track.name} [${track.code}]`}
                    meta={`Word-level SRT Format ${trimRange.enabled ? "• Trimmed Window" : "• Subtitle Track"}`}
                    isDownloading={isDownloading}
                    onDownload={() =>
                      handleDownload(subtitleStream, "subtitle")
                    }
                  />
                )
              })
            )}
          </div>
        )}

        {activeTab === "video" &&
          videoInfo.formats.map((stream) => {
            const isDownloading = downloads.some(
              (d) =>
                d.url === stream.url &&
                (d.status === "downloading" || d.status === "paused")
            )
            const rawSize = parseInt(stream.contentLength || "0", 10)
            const displaySize =
              rawSize > 0 ? Math.round(rawSize * trimmedRatio) : 0
            return (
              <StreamRow
                key={stream.itag}
                label={`MP4 Progressive (${stream.qualityLabel || "Progressive"})`}
                meta={`${formatBytes(displaySize || stream.contentLength)} • Video + Audio ${trimRange.enabled ? "• Trimmed" : ""}`}
                isDownloading={isDownloading}
                onDownload={() => handleDownload(stream, "video")}
              />
            )
          })}

        {activeTab === "audio" && (
          <>
            {videoInfo.hasMultiLanguageAudio &&
              videoInfo.audioLanguages &&
              videoInfo.audioLanguages.length > 1 && (
                <div
                  className={`mb-3 p-3 ${themeConfig.card} ${themeConfig.radius} border ${themeConfig.border}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="text-violet-400">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                      <span
                        className={`text-xs font-bold ${themeConfig.accentText}`}>
                        Multi-Language Audio Detected
                      </span>
                    </div>
                    <span
                      className={`text-[10px] ${themeConfig.badge} font-bold px-2 py-0.5`}>
                      {videoInfo.audioLanguages.length} Languages
                    </span>
                  </div>

                  <div className="relative">
                    <select
                      value={selectedLang || ""}
                      onChange={(e) =>
                        setSelectedLang?.(e.target.value || null)
                      }
                      className={`w-full appearance-none ${themeConfig.input} ${themeConfig.radius} pl-3 pr-9 py-2 text-xs outline-none cursor-pointer font-sans`}>
                      <option value="">All Languages</option>
                      {videoInfo.audioLanguages.map((lang) => (
                        <option
                          key={lang.code}
                          value={lang.code}
                          className="bg-zinc-900 text-zinc-100 py-1">
                          {lang.name} [{lang.code}]
                          {lang.isDefault ? " (Default)" : ""}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 opacity-60">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <button
                      onClick={() => setSelectedLang?.(null)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full cursor-pointer transition-all ${
                        !selectedLang
                          ? "bg-violet-500/30 text-violet-300 border border-violet-500/50"
                          : "bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10"
                      }`}>
                      All
                    </button>
                    {videoInfo.audioLanguages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() =>
                          setSelectedLang?.(
                            selectedLang === lang.code ? null : lang.code
                          )
                        }
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full cursor-pointer transition-all ${
                          selectedLang === lang.code
                            ? "bg-violet-500/30 text-violet-300 border border-violet-500/50"
                            : "bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10"
                        }`}>
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {videoInfo.adaptiveFormats
              .filter((f) => f.mimeType.startsWith("audio/"))
              .filter(
                (f) =>
                  !selectedLang ||
                  f.langCode === selectedLang ||
                  (!f.langCode && selectedLang === "und")
              )
              .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
              .map((stream) => {
                const isOpus = stream.mimeType.includes("opus")
                const ext = isOpus ? "webm" : "m4a"
                const kbps = Math.round((stream.bitrate || 0) / 1000)
                const langTag =
                  stream.displayName ||
                  (stream.langCode
                    ? `Language: ${stream.langCode}`
                    : "Default Audio")
                const isDownloading = downloads.some(
                  (d) =>
                    d.url === stream.url &&
                    (d.status === "downloading" || d.status === "paused")
                )
                const rawSize = parseInt(stream.contentLength || "0", 10)
                const displaySize =
                  rawSize > 0 ? Math.round(rawSize * trimmedRatio) : 0
                return (
                  <StreamRow
                    key={`${stream.itag}_${stream.langCode || "def"}`}
                    label={`${ext.toUpperCase()} Audio (${kbps} kbps)${stream.langCode ? ` [${stream.langCode}]` : ""}`}
                    meta={`${formatBytes(displaySize || stream.contentLength)} • ${langTag} • ${isOpus ? "Opus" : "AAC"} ${trimRange.enabled ? "• Trimmed" : ""}`}
                    isDownloading={isDownloading}
                    onDownload={() => handleDownload(stream, "audio")}
                  />
                )
              })}
          </>
        )}

        {activeTab === "adaptive" &&
          videoInfo.adaptiveFormats
            .filter((f) => f.mimeType.startsWith("video/"))
            .sort((a, b) => {
              const qa = parseInt(a.qualityLabel || "0", 10)
              const qb = parseInt(b.qualityLabel || "0", 10)
              return qb - qa
            })
            .map((stream) => {
              const isWebm = stream.mimeType.includes("webm")
              const isDownloading = downloads.some(
                (d) =>
                  d.url === stream.url &&
                  (d.status === "downloading" || d.status === "paused")
              )
              const rawSize = parseInt(stream.contentLength || "0", 10)
              const displaySize =
                rawSize > 0 ? Math.round(rawSize * trimmedRatio) : 0
              return (
                <StreamRow
                  key={stream.itag}
                  label={`${isWebm ? "WEBM" : "MP4"} Video (${stream.qualityLabel})`}
                  meta={`${formatBytes(displaySize || stream.contentLength)} • Video Only ${trimRange.enabled ? "• Trimmed" : ""}`}
                  isDownloading={isDownloading}
                  onDownload={() => handleDownload(stream, "adaptive")}
                />
              )
            })}
      </div>
    </>
  )
}
