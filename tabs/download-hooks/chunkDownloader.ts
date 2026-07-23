import { buildChunkUrl } from "../../utils/sidx"
import type { JobState } from "./types"

let isRefreshingToken = false
let tokenRefreshPromise: Promise<void> | null = null

async function refreshJobStreamUrls(job: JobState): Promise<void> {
  if (!job.videoId) return
  if (isRefreshingToken && tokenRefreshPromise) {
    return tokenRefreshPromise
  }

  isRefreshingToken = true
  tokenRefreshPromise = new Promise<void>((resolve, reject) => {
    console.log(
      "🔄 [HTTP 403 DETECTED] Performing InnerTube re-handshake & stream URL token refresh for video:",
      job.videoId
    )
    if (typeof chrome !== "undefined" && chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        { type: "GET_VIDEO_INFO", videoId: job.videoId },
        (response) => {
          isRefreshingToken = false
          if (
            chrome.runtime.lastError ||
            !response ||
            !response.success ||
            !response.info
          ) {
            reject(new Error("Token refresh re-handshake failed."))
            return
          }

          const info = response.info
          const allFormats = [
            ...(info.formats || []),
            ...(info.adaptiveFormats || [])
          ]
          const newVideoFmt = allFormats.find(
            (f: any) =>
              f.url &&
              (f.qualityLabel === job.ext || f.mimeType?.includes(job.ext))
          )
          if (newVideoFmt && newVideoFmt.url) {
            job.url = newVideoFmt.url
          }
          if (job.audioUrl) {
            const newAudioFmt = (info.adaptiveFormats || []).find(
              (f: any) => f.mimeType?.startsWith("audio/") && f.url
            )
            if (newAudioFmt && newAudioFmt.url) {
              job.audioUrl = newAudioFmt.url
            }
          }
          console.log(
            "✅ [HTTP 403 RE-HANDSHAKE SUCCESS] Updated stream URLs cleanly!"
          )
          resolve()
        }
      )
    } else {
      isRefreshingToken = false
      reject(new Error("Chrome runtime unavailable for token refresh."))
    }
  })

  return tokenRefreshPromise
}

export async function fetchChunkWithRetry(
  job: JobState,
  chunkIdx: number,
  totalChunks: number,
  size: number,
  maxStreamSize?: number
): Promise<ArrayBuffer | null> {
  let attempt = 0
  const maxAttempts = 5

  while (attempt < maxAttempts) {
    if (job.paused || job.cancelled) return null

    const limit = maxStreamSize !== undefined ? maxStreamSize : job.totalSize
    const start = chunkIdx * size
    const end = Math.min((chunkIdx + 1) * size, limit) - 1
    const chunkUrl = buildChunkUrl(job.url, start, end)

    try {
      const response = await fetch(chunkUrl)
      if (!response.ok) {
        if (response.status === 403) {
          if (attempt < maxAttempts - 1 && job.videoId) {
            try {
              await refreshJobStreamUrls(job)
              attempt++
              continue
            } catch (_) {}
          }
          throw new Error(
            "HTTP 403 Forbidden: YouTube stream URL expired and re-handshake failed."
          )
        }
        throw new Error(`HTTP Status ${response.status}`)
      }
      return await response.arrayBuffer()
    } catch (err: any) {
      attempt++
      if (err.message && err.message.includes("403")) throw err
      if (attempt >= maxAttempts) throw err
      const delay = 500 * Math.pow(2, attempt - 1)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  return null
}

export async function fetchAudioChunkWithRetry(
  job: JobState,
  chunkIdx: number,
  totalChunks: number,
  size: number
): Promise<ArrayBuffer | null> {
  if (!job.audioUrl) return null

  let attempt = 0
  const maxAttempts = 5

  while (attempt < maxAttempts) {
    if (job.paused || job.cancelled) return null

    const start = chunkIdx * size
    const end = Math.min((chunkIdx + 1) * size, job.audioSize || 0) - 1
    const chunkUrl = buildChunkUrl(job.audioUrl, start, end)

    try {
      const response = await fetch(chunkUrl)
      if (!response.ok) {
        if (response.status === 403) {
          if (attempt < maxAttempts - 1 && job.videoId) {
            try {
              await refreshJobStreamUrls(job)
              attempt++
              continue
            } catch (_) {}
          }
          throw new Error(
            "HTTP 403 Forbidden: YouTube audio stream URL expired and re-handshake failed."
          )
        }
        throw new Error(`HTTP Status ${response.status}`)
      }
      return await response.arrayBuffer()
    } catch (err: any) {
      attempt++
      if (err.message && err.message.includes("403")) throw err
      if (attempt >= maxAttempts) throw err
      const delay = 500 * Math.pow(2, attempt - 1)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  return null
}

export async function downloadRangeInParallel(
  url: string,
  rangeStart: number,
  rangeEnd: number,
  chunkSize: number,
  concurrency: number,
  job: JobState,
  onProgress?: (addedBytes: number) => void
): Promise<Uint8Array> {
  const totalSize = rangeEnd - rangeStart + 1
  const totalChunks = Math.ceil(totalSize / chunkSize)
  const chunks = new Map<number, Uint8Array>()

  let launched = 0
  const activeFetches = new Set<number>()

  return new Promise<Uint8Array>((resolve, reject) => {
    const checkNext = () => {
      if (job.paused || job.cancelled) {
        reject(new Error("Job paused or cancelled."))
        return
      }

      if (chunks.size === totalChunks) {
        const result = new Uint8Array(totalSize)
        let offset = 0
        for (let i = 0; i < totalChunks; i++) {
          const c = chunks.get(i)!
          result.set(c, offset)
          offset += c.byteLength
        }
        resolve(result)
        return
      }

      while (activeFetches.size < concurrency && launched < totalChunks) {
        const chunkIdx = launched++
        activeFetches.add(chunkIdx)

        const start = rangeStart + chunkIdx * chunkSize
        const end = Math.min(
          rangeStart + (chunkIdx + 1) * chunkSize - 1,
          rangeEnd
        )
        const chunkUrl = buildChunkUrl(url, start, end)

        ;(async () => {
          let attempt = 0
          const maxAttempts = 5
          while (attempt < maxAttempts) {
            if (job.paused || job.cancelled)
              throw new Error("Job paused or cancelled.")
            try {
              const res = await fetch(chunkUrl)
              if (!res.ok) throw new Error(`HTTP Status ${res.status}`)
              const ab = await res.arrayBuffer()
              return new Uint8Array(ab)
            } catch (err) {
              attempt++
              if (attempt >= maxAttempts) throw err
              await new Promise((r) =>
                setTimeout(r, 500 * Math.pow(2, attempt - 1))
              )
            }
          }
          throw new Error(`Failed to download range chunk ${chunkIdx}`)
        })()
          .then((buf) => {
            activeFetches.delete(chunkIdx)
            chunks.set(chunkIdx, buf)
            if (onProgress) onProgress(buf.byteLength)
            checkNext()
          })
          .catch((err) => {
            activeFetches.delete(chunkIdx)
            reject(err)
          })
      }
    }

    checkNext()
  })
}
