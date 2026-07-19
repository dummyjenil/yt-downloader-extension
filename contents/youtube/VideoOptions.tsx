import React, { useState } from "react";
import type { VideoInfo, StreamFormat, TrimRange, CaptionTrack } from "../../types/youtube";
import { formatBytes } from "../../utils/youtube";
import { CustomFusionSelector } from "../../components/CustomFusionSelector";
import { RangeSelector } from "../../components/RangeSelector";

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

  const tabs: { id: "video" | "audio" | "adaptive" | "subtitle" | "fusion"; label: string }[] = [
    { id: "video", label: "Video" },
    { id: "audio", label: "Audio" },
    { id: "adaptive", label: "Video Only" },
    { id: "subtitle", label: "Subtitles (SRT)" },
    { id: "fusion", label: "Custom Fusion" }
  ];

  return (
    <>
      {/* Range Trimmer Component */}
      <RangeSelector totalDurationSec={totalSec} onChange={handleRangeChange} />

      {/* Tabs Capsule */}
      <div className="flex gap-1 bg-white/[0.02] p-1 rounded-2xl border border-white/5 mb-4 overflow-x-auto no-scrollbar font-sans">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === t.id
                ? "bg-white/10 text-purple-300 border border-white/5 shadow-sm"
                : "text-zinc-400 border border-transparent hover:text-zinc-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Lists Area */}
      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1 mb-3 no-scrollbar font-sans">
        {activeTab === "fusion" && (
          <CustomFusionSelector
            videoInfo={videoInfo}
            downloads={downloads}
            trimRange={trimRange}
            handleDownload={handleDownload as any}
          />
        )}

        {activeTab === "subtitle" && (
          <div className="flex flex-col gap-2">
            {(!videoInfo.captionTracks || videoInfo.captionTracks.length === 0) ? (
              <div className="p-5 text-center text-zinc-500 text-xs">
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
                  <div key={track.baseUrl + idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.015] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-2">
                      <span className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5 truncate">
                        💬 {track.name}
                        <span className="text-[10px] bg-purple-500/15 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                          [{track.code}]
                        </span>
                      </span>
                      <span className="text-[10px] text-zinc-400 truncate">
                        Word-level SRT Format {trimRange.enabled ? "• Trimmed Window" : "• Subtitle Track"}
                      </span>
                    </div>
                    <button
                      disabled={isDownloading}
                      onClick={() => handleDownload(subtitleStream, "subtitle")}
                      className="w-8 h-8 rounded-xl bg-white/[0.03] hover:bg-white/10 border border-white/5 hover:border-white/15 text-zinc-200 flex items-center justify-center cursor-pointer transition-all disabled:opacity-50 shrink-0"
                    >
                      {isDownloading ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin text-purple-400">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 5v14M19 12l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                  </div>
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
              <div key={stream.itag} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.015] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 transition-all">
                <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-2">
                  <span className="text-xs font-semibold text-zinc-100 truncate">
                    MP4 Progressive ({stream.qualityLabel || "Progressive"})
                  </span>
                  <span className="text-[10px] text-zinc-400 truncate">
                    {formatBytes(displaySize || stream.contentLength)} • Video + Audio {trimRange.enabled ? "• Trimmed" : ""}
                  </span>
                </div>
                <button
                  disabled={isDownloading}
                  onClick={() => handleDownload(stream, "video")}
                  className="w-8 h-8 rounded-xl bg-white/[0.03] hover:bg-white/10 border border-white/5 hover:border-white/15 text-zinc-200 flex items-center justify-center cursor-pointer transition-all disabled:opacity-50 shrink-0"
                >
                  {isDownloading ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin text-purple-400">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M19 12l-7 7-7-7" />
                    </svg>
                  )}
                </button>
              </div>
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
                <div key={`${stream.itag}_${stream.langCode || "def"}`} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.015] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-2">
                    <span className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5 truncate">
                      🎵 {ext.toUpperCase()} Audio ({kbps} kbps)
                      {stream.langCode && (
                        <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">
                          [{stream.langCode}]
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-zinc-400 truncate">
                      {formatBytes(displaySize || stream.contentLength)} • {langTag} • {isOpus ? "Opus" : "AAC"} {trimRange.enabled ? "• Trimmed" : ""}
                    </span>
                  </div>
                  <button
                    disabled={isDownloading}
                    onClick={() => handleDownload(stream, "audio")}
                    className="w-8 h-8 rounded-xl bg-white/[0.03] hover:bg-white/10 border border-white/5 hover:border-white/15 text-zinc-200 flex items-center justify-center cursor-pointer transition-all disabled:opacity-50 shrink-0"
                  >
                    {isDownloading ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin text-purple-400">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M19 12l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                </div>
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
                <div key={stream.itag} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.015] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-2">
                    <span className="text-xs font-semibold text-zinc-100 truncate">
                      {isWebm ? "WEBM" : "MP4"} Video ({stream.qualityLabel})
                    </span>
                    <span className="text-[10px] text-zinc-400 truncate">
                      {formatBytes(displaySize || stream.contentLength)} • Video Only {trimRange.enabled ? "• Trimmed" : ""}
                    </span>
                  </div>
                  <button
                    disabled={isDownloading}
                    onClick={() => handleDownload(stream, "adaptive")}
                    className="w-8 h-8 rounded-xl bg-white/[0.03] hover:bg-white/10 border border-white/5 hover:border-white/15 text-zinc-200 flex items-center justify-center cursor-pointer transition-all disabled:opacity-50 shrink-0"
                  >
                    {isDownloading ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin text-purple-400">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M19 12l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })
        }
      </div>
    </>
  );
};
