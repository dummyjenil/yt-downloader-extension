import type { StreamFormat, TrimRange } from "../types/youtube";

export interface ResolvedDownloadParams {
  filename: string;
  ext: string;
  scaledContentLength: string;
  audioUrl?: string;
  audioSize: string;
  audioExt: string;
}

/**
 * Calculates download parameters including format extension, audio stream info,
 * trimmed length scaling, and sanitized filename creation.
 */
export function resolveDownloadParams(
  stream: StreamFormat,
  category: "video" | "audio" | "adaptive" | "fusion" | "subtitle",
  customAudioStream?: StreamFormat,
  trimRange?: TrimRange | null,
  videoLengthSeconds?: string,
  videoTitle?: string
): ResolvedDownloadParams {
  let ext = "mp4";
  let audioUrl: string | undefined = undefined;
  let audioSize: number | undefined = undefined;
  let audioExt: string | undefined = undefined;

  if (category === "subtitle") {
    ext = "srt";
  } else if (category === "audio") {
    ext = stream.mimeType.includes("webm") ? "webm" : "m4a";
  } else if (category === "fusion" && customAudioStream) {
    audioUrl = customAudioStream.url;
    audioSize = parseInt(customAudioStream.contentLength || "0", 10);
    audioExt = customAudioStream.mimeType.includes("webm") ? "webm" : "m4a";
    ext = stream.mimeType.includes("webm") ? "webm" : "mp4";
  } else if (category === "adaptive") {
    ext = stream.mimeType.includes("webm") ? "webm" : "mp4";
  } else if (stream.mimeType.includes("webm")) {
    ext = "webm";
  }

  const totalSec = parseInt(videoLengthSeconds || "0", 10);
  const isTrimmed = Boolean(trimRange && trimRange.enabled && totalSec > 0);
  const trimmedRatio = isTrimmed && trimRange
    ? Math.max(0.005, Math.min(1.0, (trimRange.endTimeSec - trimRange.startTimeSec) / totalSec))
    : 1.0;

  let scaledContentLength = stream.contentLength;
  if (stream.contentLength && isTrimmed) {
    scaledContentLength = String(Math.round(parseInt(stream.contentLength, 10) * trimmedRatio));
  }

  if (audioSize && isTrimmed) {
    audioSize = Math.round(audioSize * trimmedRatio);
  }

  const trimSuffix = isTrimmed && trimRange ? `_trimmed_${trimRange.startTimeSec}s-${trimRange.endTimeSec}s` : "";
  const suffix = stream.qualityLabel ? `_${stream.qualityLabel}${trimSuffix}` : trimSuffix;
  const cleanTitle = (videoTitle || "video").replace(/[\\/:*?"<>|]/g, "_");
  const filename = `${cleanTitle}${suffix}`;

  return {
    filename,
    ext,
    scaledContentLength: scaledContentLength || "",
    audioUrl,
    audioSize: audioSize ? String(audioSize) : "",
    audioExt: audioExt || ""
  };
}
