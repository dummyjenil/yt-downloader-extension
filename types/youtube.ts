export interface StreamFormat {
  itag: number;
  url: string;
  mimeType: string;
  qualityLabel?: string;
  contentLength?: string;
  audioQuality?: string;
  bitrate?: number;
}

export interface VideoInfo {
  title: string;
  author: string;
  lengthSeconds: string;
  thumbnail: string;
  formats: StreamFormat[];
  adaptiveFormats: StreamFormat[];
}
