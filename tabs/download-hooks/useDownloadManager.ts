import { useEffect, useRef, useState } from "react"

import type { CaptionTrack, TrimRange } from "../../types/youtube"
import {
  clearDirectoryHandle,
  getDirectoryHandle,
  storeDirectoryHandle
} from "../../utils/storage"
import { setupAndStartJob, startJobDownload } from "./jobRunner"
import type { JobState } from "./types"

export type { JobState }

export function useDownloadManager() {
  const [jobList, setJobList] = useState<JobState[]>([])
  const [chunkSize, setChunkSize] = useState<number>(5 * 1024 * 1024)
  const [concurrency, setConcurrency] = useState<number>(3)
  const [maxConcurrentJobs, setMaxConcurrentJobs] = useState<number>(3)
  const [saveMode, setSaveMode] = useState<SaveMode>("directory")
  const [defaultDirName, setDefaultDirName] = useState<string | null>(null)
  const [dirPermission, setDirPermission] = useState<string | null>(null)
  const [historyList, setHistoryList] = useState<any[]>([])

  const jobsRef = useRef<Map<string, JobState>>(new Map())
  const chunkSizeRef = useRef(chunkSize)
  const concurrencyRef = useRef(concurrency)
  const maxConcurrentJobsRef = useRef(maxConcurrentJobs)
  const saveModeRef = useRef(saveMode)

  useEffect(() => {
    chunkSizeRef.current = chunkSize
  }, [chunkSize])
  useEffect(() => {
    concurrencyRef.current = concurrency
  }, [concurrency])
  useEffect(() => {
    maxConcurrentJobsRef.current = maxConcurrentJobs
  }, [maxConcurrentJobs])
  useEffect(() => {
    saveModeRef.current = saveMode
  }, [saveMode])

  // Load Settings and History on mount
  useEffect(() => {
    chrome.storage.local.get(
      [
        "chunkSize",
        "concurrency",
        "maxConcurrentJobs",
        "saveMode",
        "downloadHistory"
      ],
      (res) => {
        if (res.chunkSize) setChunkSize(res.chunkSize as number)
        if (res.concurrency) setConcurrency(res.concurrency as number)
        if (res.maxConcurrentJobs)
          setMaxConcurrentJobs(res.maxConcurrentJobs as number)
        if (res.saveMode) setSaveMode(res.saveMode as SaveMode)
        if (res.downloadHistory) setHistoryList(res.downloadHistory as any[])
      }
    )

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

    const uiInterval = setInterval(() => {
      setJobList(Array.from(jobsRef.current.values()))
    }, 400)

    return () => clearInterval(uiInterval)
  }, [])

  // Listen for background relay commands
  useEffect(() => {
    const messageListener = (message: any, sender: any, sendResponse: any) => {
      if (message.type === "PAUSE_DOWNLOAD") {
        pauseJob(message.id)
        sendResponse({ success: true })
      } else if (message.type === "RESUME_DOWNLOAD") {
        resumeJob(message.id)
        sendResponse({ success: true })
      } else if (message.type === "CANCEL_DOWNLOAD") {
        cancelJob(message.id)
        sendResponse({ success: true })
      } else if (message.type === "NEW_DOWNLOAD_JOB") {
        const {
          url,
          videoId,
          title,
          ext,
          contentLength,
          audioUrl,
          audioSize,
          audioExt,
          initRange,
          indexRange,
          audioInitRange,
          audioIndexRange,
          trimRange,
          selectedSubtitles,
          embedThumbnail,
          embedChapters
        } = message
        addNewJob(
          url,
          title,
          ext,
          contentLength ? parseInt(contentLength, 10) : 0,
          audioUrl,
          audioSize ? parseInt(audioSize, 10) : undefined,
          audioExt,
          initRange,
          indexRange,
          audioInitRange,
          audioIndexRange,
          trimRange,
          selectedSubtitles,
          videoId,
          embedThumbnail,
          embedChapters
        )
        sendResponse({ success: true })
      }
    }
    chrome.runtime.onMessage.addListener(messageListener)
    return () => chrome.runtime.onMessage.removeListener(messageListener)
  }, [])

  // Handle pending download job from storage or URL parameters on initial tab load
  useEffect(() => {
    chrome.storage.local.get(["pendingDownloadJob"], (res) => {
      if (res.pendingDownloadJob) {
        const p = res.pendingDownloadJob
        chrome.storage.local.remove(["pendingDownloadJob"])
        setTimeout(() => {
          addNewJob(
            p.url,
            p.title,
            p.ext,
            p.contentLength ? parseInt(p.contentLength, 10) : 0,
            p.audioUrl,
            p.audioSize ? parseInt(p.audioSize, 10) : undefined,
            p.audioExt,
            p.initRange,
            p.indexRange,
            p.audioInitRange,
            p.audioIndexRange,
            p.trimRange,
            p.selectedSubtitles
          )
        }, 300)
        return
      }

      // Fallback for direct URL parameter navigation
      const urlParams = new URLSearchParams(window.location.search)
      const url = urlParams.get("url") || ""
      const title = urlParams.get("title") || "video"
      const ext = urlParams.get("ext") || "mp4"
      const contentLengthStr = urlParams.get("contentLength") || "0"
      const totalSize = parseInt(contentLengthStr, 10)
      const audioUrl = urlParams.get("audioUrl") || undefined
      const audioSizeStr = urlParams.get("audioSize") || ""
      const audioSize = audioSizeStr ? parseInt(audioSizeStr, 10) : undefined
      const audioExt = urlParams.get("audioExt") || undefined
      const trimStart = urlParams.get("trimStart")
      const trimEnd = urlParams.get("trimEnd")
      const trimRange =
        trimStart && trimEnd
          ? {
              enabled: true,
              startTimeSec: parseFloat(trimStart),
              endTimeSec: parseFloat(trimEnd)
            }
          : undefined
      const subtitlesStr = urlParams.get("subtitles")
      let selectedSubtitles: CaptionTrack[] | undefined = undefined
      if (subtitlesStr) {
        try {
          selectedSubtitles = JSON.parse(subtitlesStr)
        } catch (e) {
          console.warn("Failed to parse subtitles query parameter:", e)
        }
      }

      const initRangeStr = urlParams.get("initRange")
      const indexRangeStr = urlParams.get("indexRange")
      const audioInitRangeStr = urlParams.get("audioInitRange")
      const audioIndexRangeStr = urlParams.get("audioIndexRange")

      const initRange = initRangeStr ? JSON.parse(initRangeStr) : undefined
      const indexRange = indexRangeStr ? JSON.parse(indexRangeStr) : undefined
      const audioInitRange = audioInitRangeStr
        ? JSON.parse(audioInitRangeStr)
        : undefined
      const audioIndexRange = audioIndexRangeStr
        ? JSON.parse(audioIndexRangeStr)
        : undefined

      if (url) {
        setTimeout(() => {
          addNewJob(
            url,
            title,
            ext,
            totalSize,
            audioUrl,
            audioSize,
            audioExt,
            initRange,
            indexRange,
            audioInitRange,
            audioIndexRange,
            trimRange,
            selectedSubtitles
          )
        }, 300)
      }
    })
  }, [])

  const requestDirPermission = async () => {
    try {
      const handle = await getDirectoryHandle()
      if (handle) {
        const perm = await (handle as any).requestPermission({
          mode: "readwrite"
        })
        setDirPermission(perm)
        if (perm === "granted") {
          processQueue()
        }
      }
    } catch (err: any) {
      console.error("Failed to request directory permission:", err)
      alert("Failed to grant permission: " + err.message)
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
      alert("Failed to select directory: " + err.message)
    }
  }

  const handleClearDirectory = async () => {
    await clearDirectoryHandle()
    setDefaultDirName(null)
    setDirPermission(null)
  }

  const addNewJob = async (
    url: string,
    title: string,
    ext: string,
    totalSize: number,
    audioUrl?: string,
    audioSize?: number,
    audioExt?: string,
    initRange?: { start: string; end: string },
    indexRange?: { start: string; end: string },
    audioInitRange?: { start: string; end: string },
    audioIndexRange?: { start: string; end: string },
    trimRange?: TrimRange,
    selectedSubtitles?: CaptionTrack[],
    videoId?: string,
    embedThumbnail?: boolean,
    embedChapters?: boolean
  ) => {
    const cleanTitle = title.replace(/[\\/:*?"<>|]/g, "_")
    const jobId = `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`

    const newJob: JobState = {
      id: jobId,
      url,
      videoId,
      title: cleanTitle,
      ext,
      totalSize: (totalSize || 0) + (audioUrl ? audioSize || 0 : 0),
      downloadedBytes: 0,
      percent: 0,
      speed: 0,
      eta: 9999,
      status: "idle",
      paused: false,
      cancelled: false,
      writableStream: null,
      nextChunkToWrite: 0,
      downloadedChunks: new Map(),
      activeFetches: new Set(),
      startedTime: Date.now(),
      speedHistory: [],
      launchedChunks: 0,
      audioUrl,
      audioSize,
      audioExt,
      initRange,
      indexRange,
      audioInitRange,
      audioIndexRange,
      trimRange,
      selectedSubtitles,
      embedThumbnail: embedThumbnail !== undefined ? embedThumbnail : true,
      embedChapters: embedChapters !== undefined ? embedChapters : true
    }

    jobsRef.current.set(jobId, newJob)
    setJobList(Array.from(jobsRef.current.values()))

    processQueue()
  }

  const processQueue = async () => {
    const jobs = Array.from(jobsRef.current.values())
    const downloadingCount = jobs.filter(
      (j) => j.status === "downloading"
    ).length

    const limit = maxConcurrentJobsRef.current
    if (downloadingCount < limit) {
      const nextJob = jobs.find(
        (j) => j.status === "idle" && !j.paused && !j.cancelled
      )
      if (nextJob) {
        startSetup(nextJob.id)
      }
    }
  }

  const startSetup = async (jobId: string) => {
    const job = jobsRef.current.get(jobId)
    if (!job) return

    setupAndStartJob(
      job,
      setJobList,
      setDirPermission,
      jobsRef,
      chunkSizeRef,
      concurrencyRef,
      refreshHistory,
      processQueue,
      saveModeRef
    )
  }

  const pauseJob = (jobId: string) => {
    const job = jobsRef.current.get(jobId)
    if (job && job.status === "downloading") {
      job.paused = true
      job.status = "paused"
      chrome.runtime.sendMessage({
        type: "TAB_DOWNLOAD_PAUSE_STATE",
        id: jobId,
        isPaused: true
      })
      processQueue()
    }
  }

  const resumeJob = (jobId: string) => {
    const job = jobsRef.current.get(jobId)
    if (job && job.status === "paused") {
      job.paused = false
      job.status = "downloading"
      job.startedTime = Date.now()
      job.speedHistory = [{ time: Date.now(), bytes: job.downloadedBytes }]
      chrome.runtime.sendMessage({
        type: "TAB_DOWNLOAD_PAUSE_STATE",
        id: jobId,
        isPaused: false
      })
      startJobDownload(
        job,
        chunkSizeRef.current,
        concurrencyRef.current,
        refreshHistory,
        processQueue
      )
    }
  }

  const cancelJob = async (jobId: string) => {
    const job = jobsRef.current.get(jobId)
    if (job) {
      job.cancelled = true
      try {
        await job.writableStream.abort()
      } catch (_) {}
      chrome.runtime.sendMessage({ type: "TAB_DOWNLOAD_CANCELLED", id: jobId })
      jobsRef.current.delete(jobId)
      setJobList(Array.from(jobsRef.current.values()))
      processQueue()
    }
  }

  const refreshHistory = () => {
    chrome.storage.local.get(["downloadHistory"], (res) => {
      if (res.downloadHistory) setHistoryList(res.downloadHistory as any[])
    })
  }

  const clearHistory = () => {
    chrome.storage.local.set({ downloadHistory: [] }, () => {
      setHistoryList([])
    })
  }

  const updateSetting = (
    key: "chunkSize" | "concurrency" | "maxConcurrentJobs" | "saveMode",
    val: any
  ) => {
    if (key === "chunkSize") {
      setChunkSize(val)
    } else if (key === "concurrency") {
      setConcurrency(val)
    } else if (key === "maxConcurrentJobs") {
      setMaxConcurrentJobs(val)
    } else if (key === "saveMode") {
      setSaveMode(val)
    }
    chrome.storage.local.set({ [key]: val })
  }

  const clearJob = (jobId: string) => {
    jobsRef.current.delete(jobId)
    setJobList(Array.from(jobsRef.current.values()))
    chrome.runtime.sendMessage({ type: "CLEAR_DOWNLOAD", id: jobId })
  }

  return {
    jobList,
    chunkSize,
    concurrency,
    maxConcurrentJobs,
    saveMode,
    defaultDirName,
    dirPermission,
    historyList,
    clearJob,
    requestDirPermission,
    handleSelectDirectory,
    handleClearDirectory,
    startSetup,
    pauseJob,
    resumeJob,
    cancelJob,
    clearHistory,
    updateSetting
  }
}
