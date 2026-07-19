export interface StreamFormat {
  itag: number;
  url: string;
  mimeType: string;
  qualityLabel?: string;
  contentLength?: string;
  audioQuality?: string;
  bitrate?: number;
  langCode?: string;
  displayName?: string;
  audioTrackId?: string;
  isDefaultAudio?: boolean;
  initRange?: { start: string; end: string };
  indexRange?: { start: string; end: string };
}

export interface CaptionTrack {
  baseUrl: string;
  name: string;
  code: string;
}

export interface TrimRange {
  enabled: boolean;
  startTimeSec: number;
  endTimeSec: number;
  vSeek?: number;
  aSeek?: number;
}

export interface VideoInfo {
  title: string;
  author: string;
  lengthSeconds: string;
  thumbnail: string;
  formats: StreamFormat[];
  adaptiveFormats: StreamFormat[];
  captionTracks?: CaptionTrack[];
}

