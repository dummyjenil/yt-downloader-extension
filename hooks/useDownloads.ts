import { useEffect, useState } from "react"

import type {
  CaptionTrack,
  StreamFormat,
  TrimRange,
  VideoInfo
} from "../types/youtube"
import { resolveDownloadParams } from "../utils/downloadHelpers"

export function useDownloads() {
  const [downloads, setDownloads] = useState<any[]>([])
  const [historyList, setHistoryList] = useState<any[]>([])

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.storage.local.get(["downloadHistory"], (res) => {
        if (res.downloadHistory) setHistoryList(res.downloadHistory as any[])
      })

      chrome.runtime.sendMessage(
        { type: "GET_ACTIVE_DOWNLOADS" },
        (response) => {
          if (response && response.downloads) {
            setDownloads(response.downloads)
          }
        }
      )

      const listener = (message: any) => {
        if (message.type === "DOWNLOADS_UPDATED") {
          setDownloads(message.downloads)
        }
      }

      chrome.runtime.onMessage.addListener(listener)
      return () => chrome.runtime.onMessage.removeListener(listener)
    }
  }, [])

  const handleDownload = (
    videoInfo: VideoInfo | null,
    stream: StreamFormat,
    category: "video" | "audio" | "adaptive" | "fusion" | "subtitle",
    trimRange?: TrimRange | null,
    customAudioStream?: StreamFormat,
    selectedSubtitles?: CaptionTrack[],
    onSuccess?: () => void
  ) => {
    if (!videoInfo) return

    const params = resolveDownloadParams(
      stream,
      category,
      customAudioStream,
      trimRange,
      videoInfo.lengthSeconds,
      videoInfo.title
    )

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: "ADD_DOWNLOAD_JOB",
        url: stream.url,
        title: params.filename,
        ext: params.ext,
        contentLength: params.scaledContentLength,
        audioUrl: params.audioUrl,
        audioSize: params.audioSize,
        audioExt: params.audioExt,
        initRange: stream.initRange,
        indexRange: stream.indexRange,
        audioInitRange: customAudioStream?.initRange,
        audioIndexRange: customAudioStream?.indexRange,
        trimRange: trimRange && trimRange.enabled ? trimRange : undefined,
        selectedSubtitles: selectedSubtitles
      })
    }

    if (onSuccess) {
      onSuccess()
    }
  }

  const clearHistory = () => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ downloadHistory: [] }, () => {
        setHistoryList([])
      })
    }
  }

  const activeDownloads = downloads.filter(
    (d) => d.status === "downloading" || d.status === "paused"
  )

  return {
    downloads,
    activeDownloads,
    historyList,
    handleDownload,
    clearHistory
  }
}
