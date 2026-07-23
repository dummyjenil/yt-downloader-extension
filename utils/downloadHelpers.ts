import type { StreamFormat, TrimRange } from "../types/youtube"
import { extractChapters, generateFFmpegMetadata } from "./chapters"
import { fetchVideoThumbnailBuffer } from "./thumbnail"

export interface ResolvedDownloadParams {
  filename: string
  ext: string
  scaledContentLength: string
  audioUrl?: string
  audioSize: string
  audioExt: string
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
  let ext = "mp4"
  let audioUrl: string | undefined = undefined
  let audioSize: number | undefined = undefined
  let audioExt: string | undefined = undefined

  if (category === "subtitle") {
    ext = "srt"
  } else if (category === "audio") {
    ext = stream.mimeType.includes("webm") ? "webm" : "m4a"
  } else if (category === "fusion" && customAudioStream) {
    audioUrl = customAudioStream.url
    audioSize = parseInt(customAudioStream.contentLength || "0", 10)
    audioExt = customAudioStream.mimeType.includes("webm") ? "webm" : "m4a"
    ext = stream.mimeType.includes("webm") ? "webm" : "mp4"
  } else if (category === "adaptive") {
    ext = stream.mimeType.includes("webm") ? "webm" : "mp4"
  } else if (stream.mimeType.includes("webm")) {
    ext = "webm"
  }

  const totalSec = parseInt(videoLengthSeconds || "0", 10)
  const isTrimmed = Boolean(trimRange && trimRange.enabled && totalSec > 0)
  const trimmedRatio =
    isTrimmed && trimRange
      ? Math.max(
          0.005,
          Math.min(
            1.0,
            (trimRange.endTimeSec - trimRange.startTimeSec) / totalSec
          )
        )
      : 1.0

  let scaledContentLength = stream.contentLength
  if (stream.contentLength && isTrimmed) {
    scaledContentLength = String(
      Math.round(parseInt(stream.contentLength, 10) * trimmedRatio)
    )
  }

  if (audioSize && isTrimmed) {
    audioSize = Math.round(audioSize * trimmedRatio)
  }

  const trimSuffix =
    isTrimmed && trimRange
      ? `_trimmed_${trimRange.startTimeSec}s-${trimRange.endTimeSec}s`
      : ""
  const suffix = stream.qualityLabel
    ? `_${stream.qualityLabel}${trimSuffix}`
    : trimSuffix
  const cleanTitle = (videoTitle || "video").replace(/[\\/:*?"<>|]/g, "_")
  const filename = `${cleanTitle}${suffix}`

  return {
    filename,
    ext,
    scaledContentLength: scaledContentLength || "",
    audioUrl,
    audioSize: audioSize ? String(audioSize) : "",
    audioExt: audioExt || ""
  }
}

export interface AuxData {
  thumbnailBuffer: Uint8Array | null
  chapterMetadata: string | undefined
  metadataInfo: { title: string; artist: string; album: string } | undefined
}

export async function getJobAuxiliaryData(job: any): Promise<AuxData> {
  let thumbnailBuffer: Uint8Array | null = null
  let chapterMetadata: string | undefined = undefined
  let metadataInfo:
    { title: string; artist: string; album: string } | undefined = undefined

  if (job.videoId) {
    if (job.embedThumbnail !== false) {
      try {
        thumbnailBuffer = await fetchVideoThumbnailBuffer(job.videoId)
      } catch (err) {
        console.warn("Failed to fetch video thumbnail buffer:", err)
      }
    }

    try {
      const infoRes = await new Promise<any>((resolve) => {
        if (typeof chrome !== "undefined" && chrome.runtime) {
          chrome.runtime.sendMessage(
            { type: "GET_VIDEO_INFO", videoId: job.videoId },
            (r) => {
              resolve(r && r.success ? r.info : null)
            }
          )
        } else {
          resolve(null)
        }
      })

      if (infoRes) {
        metadataInfo = {
          title: job.title || infoRes.title || "",
          artist: infoRes.author || infoRes.ownerChannelName || "YouTube",
          album: "YouTube Downloads"
        }

        if (job.embedChapters !== false) {
          const durationSec = infoRes.lengthSeconds
            ? parseInt(infoRes.lengthSeconds, 10)
            : 0
          const chapters = extractChapters(
            infoRes,
            infoRes.description || "",
            durationSec
          )
          if (chapters.length > 0) {
            chapterMetadata = generateFFmpegMetadata(
              job.title,
              metadataInfo.artist,
              chapters
            )
          }
        }
      }
    } catch (err) {
      console.warn("Failed to fetch video info for auxiliary data:", err)
    }
  }

  return { thumbnailBuffer, chapterMetadata, metadataInfo }
}
