import React, { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import type { VideoInfo, StreamFormat, CaptionTrack, TrimRange } from "../types/youtube";
import { formatBytes } from "../utils/youtube";

interface CustomFusionSelectorProps {
  videoInfo: VideoInfo;
  downloads: any[];
  trimRange?: TrimRange;
  handleDownload: (
    videoStream: StreamFormat,
    category: "fusion",
    audioStream: StreamFormat,
    selectedSubtitles?: CaptionTrack[]
  ) => void;
}

export const CustomFusionSelector: React.FC<CustomFusionSelectorProps> = ({
  videoInfo,
  downloads,
  trimRange,
  handleDownload
}) => {
  const { themeConfig } = useTheme();

  const videoStreams = videoInfo.adaptiveFormats
    .filter((f) => f.mimeType.startsWith("video/"))
    .sort((a, b) => {
      const qa = parseInt(a.qualityLabel || "0", 10);
      const qb = parseInt(b.qualityLabel || "0", 10);
      return qb - qa;
    });

  const audioStreams = videoInfo.adaptiveFormats
    .filter((f) => f.mimeType.startsWith("audio/"))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  const captionTracks = videoInfo.captionTracks || [];

  const [selectedVideoIdx, setSelectedVideoIdx] = useState<number>(0);
  const [selectedAudioIdx, setSelectedAudioIdx] = useState<number>(0);
  const [selectedSubtitleCodes, setSelectedSubtitleCodes] = useState<string[]>([]);

  const selectedVideo = videoStreams[selectedVideoIdx];
  const selectedAudio = audioStreams[selectedAudioIdx];

  if (!selectedVideo || !selectedAudio) {
    return (
      <div className={`p-4 text-center text-xs ${themeConfig.card} ${themeConfig.radius}`}>
        No adaptive formats available for custom fusion.
      </div>
    );
  }

  const videoMime = selectedVideo.mimeType.toLowerCase();
  const audioMime = selectedAudio.mimeType.toLowerCase();

  const isVideoWebm = videoMime.includes("webm");
  const isAudioWebm = audioMime.includes("webm");
  const containersMatch = isVideoWebm === isAudioWebm;

  const totalSec = parseInt(videoInfo.lengthSeconds || "0", 10);
  const trimmedRatio = (trimRange && trimRange.enabled && totalSec > 0)
    ? Math.max(0.005, Math.min(1.0, (trimRange.endTimeSec - trimRange.startTimeSec) / totalSec))
    : 1.0;

  const rawTotalSize = (parseInt(selectedVideo.contentLength || "0", 10) || 0) +
    (parseInt(selectedAudio.contentLength || "0", 10) || 0);
  const totalSize = Math.round(rawTotalSize * trimmedRatio);

  const isDownloading = downloads.some(
    (d) =>
      d.url === selectedVideo.url &&
      d.audioUrl === selectedAudio.url &&
      (d.status === "downloading" || d.status === "paused")
  );

  const toggleSubtitle = (code: string) => {
    if (selectedSubtitleCodes.includes(code)) {
      setSelectedSubtitleCodes(selectedSubtitleCodes.filter((c) => c !== code));
    } else {
      setSelectedSubtitleCodes([...selectedSubtitleCodes, code]);
    }
  };

  const triggerDownload = () => {
    const chosenSubtitles = captionTracks.filter((t) => selectedSubtitleCodes.includes(t.code));
    handleDownload(selectedVideo, "fusion", selectedAudio, chosenSubtitles);
  };

  const getFormatLabel = (mime: string) => {
    if (mime.includes("webm")) return "WebM";
    if (mime.includes("mp4") || mime.includes("m4a")) return "MP4";
    return "Unknown";
  };

  const getCodecLabel = (mime: string) => {
    const match = mime.match(/codecs="([^"]+)"/);
    return match ? match[1].split(".")[0] : "";
  };

  return (
    <div className={`flex flex-col gap-4 ${themeConfig.card} ${themeConfig.radius} p-4 shadow-xl my-3`}>
      <div className={`flex items-center justify-between pb-3 border-b ${themeConfig.border}`}>
        <span className={`text-sm font-extrabold ${themeConfig.accentText}`}>
          Custom Multi-Stream Fusion
        </span>
        <span className={`${themeConfig.badge} uppercase tracking-wider font-bold`}>
          FFmpeg Engine
        </span>
      </div>

      {/* Video Track Select */}
      <div className="flex flex-col gap-1.5">
        <label className={`text-xs font-semibold ${themeConfig.mutedText} flex justify-between`}>
          <span>Video Track</span>
          <span className="font-mono">{getCodecLabel(selectedVideo.mimeType)}</span>
        </label>
        <div className="relative">
          <select
            value={selectedVideoIdx}
            onChange={(e) => setSelectedVideoIdx(parseInt(e.target.value, 10))}
            className={`w-full appearance-none ${themeConfig.input} ${themeConfig.radius} pl-3 pr-9 py-2.5 text-xs outline-none cursor-pointer font-sans truncate`}
          >
            {videoStreams.map((stream, idx) => {
              const size = formatBytes(stream.contentLength);
              const container = getFormatLabel(stream.mimeType);
              return (
                <option key={stream.itag} value={idx} className="bg-zinc-900 text-zinc-100 py-1">
                  {stream.qualityLabel || "HD"} • {container} ({size})
                </option>
              );
            })}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 opacity-60">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Audio Track Select */}
      <div className="flex flex-col gap-1.5">
        <label className={`text-xs font-semibold ${themeConfig.mutedText} flex justify-between`}>
          <span>Audio Track</span>
          <span>{audioStreams.length} Available</span>
        </label>
        <div className="relative">
          <select
            value={selectedAudioIdx}
            onChange={(e) => setSelectedAudioIdx(parseInt(e.target.value, 10))}
            className={`w-full appearance-none ${themeConfig.input} ${themeConfig.radius} pl-3 pr-9 py-2.5 text-xs outline-none cursor-pointer font-sans truncate`}
          >
            {audioStreams.map((stream, idx) => {
              const size = formatBytes(stream.contentLength);
              const container = getFormatLabel(stream.mimeType);
              const kbps = Math.round((stream.bitrate || 0) / 1000);
              const langLabel = stream.displayName || (stream.langCode ? `[${stream.langCode}]` : "Default Audio");
              return (
                <option key={`${stream.itag}_${stream.langCode || idx}`} value={idx} className="bg-zinc-900 text-zinc-100 py-1">
                  {langLabel} • {kbps} kbps • {container} ({size})
                </option>
              );
            })}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 opacity-60">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Subtitles Multi-Select */}
      {captionTracks.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex justify-between items-center text-xs">
            <span className={`font-semibold ${themeConfig.mutedText}`}>Subtitles (Multi-Select):</span>
            <span className={`font-bold ${themeConfig.accentText}`}>{selectedSubtitleCodes.length} selected</span>
          </div>

          <div className={`flex flex-col gap-1 max-h-28 overflow-y-auto ${themeConfig.input} ${themeConfig.radius} p-2 no-scrollbar`}>
            {captionTracks.map((track) => {
              const isChecked = selectedSubtitleCodes.includes(track.code);
              return (
                <label
                  key={track.code}
                  className={`flex items-center gap-2 px-2.5 py-1.5 ${themeConfig.radius} text-xs cursor-pointer select-none transition-colors ${
                    isChecked ? `${themeConfig.badge} font-bold` : `${themeConfig.mutedText} hover:bg-white/5`
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSubtitle(track.code)}
                    className="accent-violet-500 rounded cursor-pointer w-4 h-4"
                  />
                  <span className="truncate flex-1 font-medium">
                    {track.name}
                  </span>
                  <span className="text-[10px] uppercase font-mono">[{track.code}]</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Format Mismatch Hint */}
      {!containersMatch && (
        <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 leading-relaxed">
          ⚠️ <strong>Format Mismatch:</strong> {getFormatLabel(selectedVideo.mimeType)} video + {getFormatLabel(selectedAudio.mimeType)} audio. Merging matching formats is faster.
        </div>
      )}

      {/* Output Specs & Download Action */}
      <div className={`border ${themeConfig.border} ${themeConfig.radius} p-3 flex items-center justify-between`}>
        <div className="flex flex-col">
          <span className={`text-[10px] ${themeConfig.mutedText} font-medium`}>Est. File Size</span>
          <span className={`text-sm font-bold ${themeConfig.accentText}`}>{formatBytes(totalSize)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-[10px] ${themeConfig.mutedText} font-medium`}>Container Output</span>
          <span className="text-xs font-bold">
            {isVideoWebm ? "WebM Video" : "MP4 Video"}
          </span>
        </div>
      </div>

      <button
        onClick={triggerDownload}
        disabled={isDownloading}
        className={`w-full py-3 px-4 ${themeConfig.radius} ${themeConfig.primaryBtn} text-xs font-bold transition-all flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50`}
      >
        {isDownloading ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
            </svg>
            Downloading & Merging...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
            Fuse & Download
          </>
        )}
      </button>
    </div>
  );
};
