import type { TrimRange, CaptionTrack } from "../../types/youtube";
import type { SidxRangeResult } from "../../utils/sidx";

export interface JobState {
  id: string;
  url: string;
  videoId?: string;
  playlistName?: string;
  title: string;
  ext: string;
  totalSize: number;
  downloadedBytes: number;
  percent: number;
  speed: number;
  eta: number;
  status: "idle" | "downloading" | "paused" | "complete" | "error";
  errorMessage?: string;
  paused: boolean;
  cancelled: boolean;
  writableStream: any;
  nextChunkToWrite: number;
  downloadedChunks: Map<number, ArrayBuffer>;
  activeFetches: Set<number>;
  startedTime: number;
  speedHistory: { time: number; bytes: number }[];
  launchedChunks: number;

  // Adaptive merging properties
  audioUrl?: string;
  audioSize?: number;
  audioExt?: string;
  adaptiveVideoChunks?: Map<number, ArrayBuffer>;
  adaptiveAudioChunks?: Map<number, ArrayBuffer>;
  launchedVideoChunks?: number;
  launchedAudioChunks?: number;
  videoDownloadedBytes?: number;
  audioDownloadedBytes?: number;

  // Trim range & multi-subtitle fusion properties
  trimRange?: TrimRange;
  selectedSubtitles?: CaptionTrack[];

  // SIDX range metadata
  initRange?: { start: string; end: string };
  indexRange?: { start: string; end: string };
  audioInitRange?: { start: string; end: string };
  audioIndexRange?: { start: string; end: string };
  sidxVideoInfo?: SidxRangeResult;
  sidxAudioInfo?: SidxRangeResult;
}
