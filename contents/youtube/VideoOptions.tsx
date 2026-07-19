import React, { useState } from "react";
import type { VideoInfo, StreamFormat, TrimRange, CaptionTrack } from "../../types/youtube";
import { formatBytes } from "../../utils/youtube";
import { CustomFusionSelector } from "../../components/CustomFusionSelector";
import { RangeSelector } from "../../components/RangeSelector";
import { StreamTabs } from "../../components/StreamTabs";
import { StreamRow } from "../../components/StreamRow";
import { useTheme } from "../../context/ThemeContext";

interface VideoOptionsProps {
  videoInfo: VideoInfo;
  activeTab: "video" | "audio" | "adaptive" | "fusion" | "subtitle";
  setActiveTab: (tab: "video" | "audio" | "adaptive" | "fusion" | "subtitle") => void;
  downloads: any[];
  onRangeChange?: (range: TrimRange) => void;
  handleDownload: (
    stream: StreamFormat,
    category: "video" | "audio" | "adaptive" | "fusion" | "subtitle",
    customAudioStream?: StreamFormat,
    selectedSubtitles?: CaptionTrack[]
  ) => void;
}

export const VideoOptions: React.FC<VideoOptionsProps> = ({
  videoInfo,
  activeTab,
  setActiveTab,
  downloads,
  onRangeChange,
  handleDownload
}) => {
  const { themeConfig } = useTheme();
  const totalSec = parseInt(videoInfo.lengthSeconds || "0", 10);
  const [trimRange, setTrimRange] = useState<TrimRange>({
    enabled: false,
    startTimeSec: 0,
    endTimeSec: totalSec || 180
  });

  const handleRangeChange = (range: TrimRange) => {
    setTrimRange(range);
    if (onRangeChange) onRangeChange(range);
  };

  const trimmedRatio = (trimRange.enabled && totalSec > 0)
    ? Math.max(0.005, Math.min(1.0, (trimRange.endTimeSec - trimRange.startTimeSec) / totalSec))
    : 1.0;

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
          />
        )}

        {activeTab === "subtitle" && (
          <div className="flex flex-col gap-2.5">
            {(!videoInfo.captionTracks || videoInfo.captionTracks.length === 0) ? (
              <div className={`p-8 text-center ${themeConfig.mutedText} text-sm font-semibold ${themeConfig.card} ${themeConfig.radius}`}>
                No caption tracks available for this video.
              </div>
            ) : (
              videoInfo.captionTracks.map((track, idx) => {
                const isDownloading = downloads.some(
                  (d) => d.url === track.baseUrl && (d.status === "downloading" || d.status === "paused")
                );
                const subtitleStream: StreamFormat = {
                  itag: 99000 + idx,
                  url: track.baseUrl,
                  mimeType: "text/srt",
                  qualityLabel: track.name
                };

                return (
                  <StreamRow
                    key={track.baseUrl + idx}
                    label={`${track.name} [${track.code}]`}
                    meta={`Word-level SRT Format ${trimRange.enabled ? "• Trimmed Window" : "• Subtitle Track"}`}
                    isDownloading={isDownloading}
                    onDownload={() => handleDownload(subtitleStream, "subtitle")}
                  />
                );
              })
            )}
          </div>
        )}

        {activeTab === "video" &&
          videoInfo.formats.map((stream) => {
            const isDownloading = downloads.some(
              (d) => d.url === stream.url && (d.status === "downloading" || d.status === "paused")
            );
            const rawSize = parseInt(stream.contentLength || "0", 10);
            const displaySize = rawSize > 0 ? Math.round(rawSize * trimmedRatio) : 0;
            return (
              <StreamRow
                key={stream.itag}
                label={`MP4 Progressive (${stream.qualityLabel || "Progressive"})`}
                meta={`${formatBytes(displaySize || stream.contentLength)} • Video + Audio ${trimRange.enabled ? "• Trimmed" : ""}`}
                isDownloading={isDownloading}
                onDownload={() => handleDownload(stream, "video")}
              />
            );
          })
        }

        {activeTab === "audio" &&
          videoInfo.adaptiveFormats
            .filter((f) => f.mimeType.startsWith("audio/"))
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
            .map((stream) => {
              const isOpus = stream.mimeType.includes("opus");
              const ext = isOpus ? "webm" : "m4a";
              const kbps = Math.round((stream.bitrate || 0) / 1000);
              const langTag = stream.displayName || (stream.langCode ? `Language: ${stream.langCode}` : "Default Audio");
              const isDownloading = downloads.some(
                (d) => d.url === stream.url && (d.status === "downloading" || d.status === "paused")
              );
              const rawSize = parseInt(stream.contentLength || "0", 10);
              const displaySize = rawSize > 0 ? Math.round(rawSize * trimmedRatio) : 0;
              return (
                <StreamRow
                  key={`${stream.itag}_${stream.langCode || "def"}`}
                  label={`${ext.toUpperCase()} Audio (${kbps} kbps)${stream.langCode ? ` [${stream.langCode}]` : ""}`}
                  meta={`${formatBytes(displaySize || stream.contentLength)} • ${langTag} • ${isOpus ? "Opus" : "AAC"} ${trimRange.enabled ? "• Trimmed" : ""}`}
                  isDownloading={isDownloading}
                  onDownload={() => handleDownload(stream, "audio")}
                />
              );
            })
        }

        {activeTab === "adaptive" &&
          videoInfo.adaptiveFormats
            .filter((f) => f.mimeType.startsWith("video/"))
            .sort((a, b) => {
              const qa = parseInt(a.qualityLabel || "0", 10);
              const qb = parseInt(b.qualityLabel || "0", 10);
              return qb - qa;
            })
            .map((stream) => {
              const isWebm = stream.mimeType.includes("webm");
              const isDownloading = downloads.some(
                (d) => d.url === stream.url && (d.status === "downloading" || d.status === "paused")
              );
              const rawSize = parseInt(stream.contentLength || "0", 10);
              const displaySize = rawSize > 0 ? Math.round(rawSize * trimmedRatio) : 0;
              return (
                <StreamRow
                  key={stream.itag}
                  label={`${isWebm ? "WEBM" : "MP4"} Video (${stream.qualityLabel})`}
                  meta={`${formatBytes(displaySize || stream.contentLength)} • Video Only ${trimRange.enabled ? "• Trimmed" : ""}`}
                  isDownloading={isDownloading}
                  onDownload={() => handleDownload(stream, "adaptive")}
                />
              );
            })
        }
      </div>
    </>
  );
};
