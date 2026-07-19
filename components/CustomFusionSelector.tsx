import React, { useState } from "react";
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
      <div className="p-4 text-center text-zinc-500 text-xs bg-white/[0.02] border border-white/5 rounded-xl">
        No adaptive formats available for custom fusion.
      </div>
    );
  }

  // Calculate container details & trimmed size ratio
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
    <div className="flex flex-col gap-3 bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl p-3.5 shadow-xl my-2">
      {/* Header Badge */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <span className="text-xs font-bold bg-gradient-to-r from-violet-300 via-purple-300 to-rose-300 bg-clip-text text-transparent">
          Custom Multi-Stream Fusion
        </span>
        <span className="text-[9px] font-semibold bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/30 uppercase tracking-wider">
          FFmpeg Engine
        </span>
      </div>

      {/* Video Quality Select */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium text-zinc-400 flex justify-between">
          <span>Video Track</span>
          <span className="text-zinc-500 font-mono">{getCodecLabel(selectedVideo.mimeType)}</span>
        </label>
        <div className="relative">
          <select
            value={selectedVideoIdx}
            onChange={(e) => setSelectedVideoIdx(parseInt(e.target.value, 10))}
            className="w-full appearance-none bg-zinc-900 hover:bg-zinc-850 border border-white/10 hover:border-violet-500/40 rounded-xl text-zinc-100 pl-3 pr-8 py-2 text-xs outline-none focus:ring-2 focus:ring-violet-500/30 transition-all cursor-pointer font-sans truncate"
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
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-zinc-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Audio Quality Select */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium text-zinc-400 flex justify-between">
          <span>Audio Track</span>
          <span className="text-zinc-500">{audioStreams.length} Available</span>
        </label>
        <div className="relative">
          <select
            value={selectedAudioIdx}
            onChange={(e) => setSelectedAudioIdx(parseInt(e.target.value, 10))}
            className="w-full appearance-none bg-zinc-900 hover:bg-zinc-850 border border-white/10 hover:border-violet-500/40 rounded-xl text-zinc-100 pl-3 pr-8 py-2 text-xs outline-none focus:ring-2 focus:ring-violet-500/30 transition-all cursor-pointer font-sans truncate"
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
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-zinc-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Multi-Select Subtitles */}
      {captionTracks.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex justify-between items-center text-[10px]">
            <span className="font-medium text-zinc-400">Subtitles (Multi-Select):</span>
            <span className="text-violet-300 font-semibold">{selectedSubtitleCodes.length} selected</span>
          </div>

          <div className="flex flex-col gap-1 max-h-24 overflow-y-auto bg-zinc-950/80 border border-white/10 rounded-xl p-2 no-scrollbar">
            {captionTracks.map((track) => {
              const isChecked = selectedSubtitleCodes.includes(track.code);
              return (
                <label
                  key={track.code}
                  className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                    isChecked ? "bg-violet-500/15 text-zinc-100 font-medium border border-violet-500/30" : "text-zinc-400 hover:bg-white/5"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSubtitle(track.code)}
                    className="accent-violet-500 rounded cursor-pointer"
                  />
                  <span className="truncate flex-1">
                    {track.name}
                  </span>
                  <span className="text-[9px] text-zinc-500 uppercase font-mono">[{track.code}]</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Mismatched Container Hint */}
      {!containersMatch && (
        <div className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 leading-relaxed">
          ⚠️ <strong>Format Mismatch:</strong> {getFormatLabel(selectedVideo.mimeType)} video + {getFormatLabel(selectedAudio.mimeType)} audio. Merging matching formats is faster.
        </div>
      )}

      {/* Output Specs & Download Action */}
      <div className="bg-zinc-950/60 border border-white/5 rounded-xl p-2.5 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[9px] text-zinc-500 font-medium">Est. File Size</span>
          <span className="text-xs font-bold text-violet-300">{formatBytes(totalSize)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-zinc-500 font-medium">Container Output</span>
          <span className="text-xs font-medium text-zinc-200">
            {isVideoWebm ? "WebM Video" : "MP4 Video"}
          </span>
        </div>
      </div>

      <button
        onClick={triggerDownload}
        disabled={isDownloading}
        className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold transition-all flex justify-center items-center gap-2 ${
          isDownloading
            ? "bg-white/[0.03] border border-white/10 text-zinc-400 cursor-not-allowed"
            : "bg-gradient-to-r from-rose-500 via-purple-600 to-violet-600 hover:from-rose-400 hover:to-violet-500 text-white shadow-lg shadow-purple-900/30 active:scale-95 cursor-pointer"
        }`}
      >
        {isDownloading ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin text-purple-400">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
            </svg>
            Downloading & Merging...
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
            Fuse & Download
          </>
        )}
      </button>
    </div>
  );
};
