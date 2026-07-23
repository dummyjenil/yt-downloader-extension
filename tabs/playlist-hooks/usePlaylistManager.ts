import { useEffect, useState } from "react"

import type { PlaylistDetails, PlaylistVideoItem } from "../../utils/playlist"
import {
  clearDirectoryHandle,
  getDirectoryHandle,
  storeDirectoryHandle
} from "../../utils/storage"
import { extractPlaylistId } from "../../utils/youtube"

export interface ConfiguredPlaylistItem extends PlaylistVideoItem {
  selected: boolean
  formatOption: "1080p" | "720p" | "480p" | "audio" | "fusion"
  embedThumbnail: boolean
  embedChapters: boolean
  status: "idle" | "fetching_info" | "queued" | "error"
  errorMessage?: string
}

export function usePlaylistManager() {
  const [playlistId, setPlaylistId] = useState<string | null>(null)
  const [playlistDetails, setPlaylistDetails] =
    useState<PlaylistDetails | null>(null)
  const [items, setItems] = useState<ConfiguredPlaylistItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [defaultDirName, setDefaultDirName] = useState<string | null>(null)
  const [dirPermission, setDirPermission] = useState<string | null>(null)
  const [globalPreset, setGlobalPreset] = useState<
    "1080p" | "720p" | "480p" | "audio"
  >("1080p")
  const [batchStarting, setBatchStarting] = useState(false)

  useEffect(() => {
    // Check directory handle on mount
    getDirectoryHandle()
      .then((handle) => {
        if (handle) {
          setDefaultDirName(handle.name)
          ;(handle as any)
            .queryPermission({ mode: "readwrite" })
            .then((perm: string) => {
              setDirPermission(perm)
            })
            .catch(console.error)
        }
      })
      .catch(console.error)

    // Get playlist ID from URL query parameters
    const params = new URLSearchParams(window.location.search)
    const list = params.get("list") || extractPlaylistId(window.location.href)
    if (list) {
      setPlaylistId(list)
      fetchPlaylist(list)
    }
  }, [])

  const fetchPlaylist = (id: string) => {
    setLoading(true)
    setError(null)

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage(
        { type: "GET_PLAYLIST_DETAILS", playlistId: id },
        (res) => {
          setLoading(false)
          if (chrome.runtime.lastError) {
            setError(
              chrome.runtime.lastError.message ||
                "Failed to communicate with service worker."
            )
          } else if (res && res.success && res.details) {
            setPlaylistDetails(res.details)
            const initialItems: ConfiguredPlaylistItem[] =
              res.details.videos.map((v: PlaylistVideoItem) => ({
                ...v,
                selected: true,
                formatOption: "1080p",
                embedThumbnail: true,
                embedChapters: true,
                status: "idle"
              }))
            setItems(initialItems)
          } else {
            setError(res?.error || "Unable to extract playlist videos.")
          }
        }
      )
    } else {
      setLoading(false)
      setError("Chrome extension runtime unavailable.")
    }
  }

  const handleSelectDirectory = async () => {
    try {
      if (!(window as any).showDirectoryPicker) {
        alert(
          "Your browser does not support directory picking. Please use Google Chrome."
        )
        return
      }
      const handle = await (window as any).showDirectoryPicker({
        mode: "readwrite"
      })
      await storeDirectoryHandle(handle)
      setDefaultDirName(handle.name)
      setDirPermission("granted")
    } catch (err: any) {
      console.error(err)
    }
  }

  const handleClearDirectory = async () => {
    await clearDirectoryHandle()
    setDefaultDirName(null)
    setDirPermission(null)
  }

  const toggleSelectAll = (select: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: select })))
  }

  const updateItem = (
    videoId: string,
    updates: Partial<ConfiguredPlaylistItem>
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.videoId === videoId ? { ...item, ...updates } : item
      )
    )
  }

  const applyGlobalPreset = (preset: "1080p" | "720p" | "480p" | "audio") => {
    setGlobalPreset(preset)
    setItems((prev) => prev.map((item) => ({ ...item, formatOption: preset })))
  }

  const startBatchDownload = async () => {
    if (!defaultDirName || dirPermission !== "granted") {
      alert(
        "Please select a target destination folder before starting batch download."
      )
      await handleSelectDirectory()
      return
    }

    const selectedItems = items.filter((i) => i.selected)
    if (selectedItems.length === 0) {
      alert("Please select at least one video to download.")
      return
    }

    setBatchStarting(true)

    for (const item of selectedItems) {
      updateItem(item.videoId, { status: "fetching_info" })

      try {
        const infoRes = await new Promise<any>((resolve, reject) => {
          chrome.runtime.sendMessage(
            { type: "GET_VIDEO_INFO", videoId: item.videoId },
            (r) => {
              if (r && r.success) resolve(r.info)
              else
                reject(new Error(r?.error || "Failed to fetch stream details"))
            }
          )
        })

        const formats = infoRes.formats || []
        const adaptiveFormats = infoRes.adaptiveFormats || []
        let chosenStream = null
        let chosenAudio = null

        if (item.formatOption === "audio") {
          chosenStream = adaptiveFormats.find((f: any) =>
            f.mimeType.startsWith("audio/")
          )
        } else {
          // Find matching resolution
          chosenStream =
            formats.find((f: any) =>
              f.qualityLabel?.includes(item.formatOption)
            ) ||
            adaptiveFormats.find(
              (f: any) =>
                f.mimeType.startsWith("video/") &&
                f.qualityLabel?.includes(item.formatOption)
            ) ||
            formats[0] ||
            adaptiveFormats[0]

          if (chosenStream?.mimeType?.startsWith("video/")) {
            chosenAudio = adaptiveFormats.find((f: any) =>
              f.mimeType.startsWith("audio/")
            )
          }
        }

        if (!chosenStream) {
          throw new Error("No compatible stream format found for video.")
        }

        const ext = item.formatOption === "audio" ? "m4a" : "mp4"
        const cleanTitle = item.title.replace(/[\\/:*?"<>|]/g, "_")
        const filename = `${cleanTitle}_${item.formatOption}`

        chrome.runtime.sendMessage({
          type: "ADD_DOWNLOAD_JOB",
          url: chosenStream.url,
          title: filename,
          ext,
          contentLength: chosenStream.contentLength || "",
          audioUrl: chosenAudio?.url,
          audioSize: chosenAudio?.contentLength || "",
          audioExt: chosenAudio?.mimeType?.includes("webm") ? "webm" : "m4a"
        })

        updateItem(item.videoId, { status: "queued" })
      } catch (err: any) {
        updateItem(item.videoId, { status: "error", errorMessage: err.message })
      }
    }

    setBatchStarting(false)
    // Redirect to download tab dashboard
    chrome.tabs.create({ url: chrome.runtime.getURL("tabs/download.html") })
  }

  return {
    playlistId,
    setPlaylistId,
    playlistDetails,
    items,
    loading,
    error,
    defaultDirName,
    dirPermission,
    globalPreset,
    batchStarting,
    fetchPlaylist,
    handleSelectDirectory,
    handleClearDirectory,
    toggleSelectAll,
    updateItem,
    applyGlobalPreset,
    startBatchDownload
  }
}
