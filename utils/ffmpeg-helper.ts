import { FFmpeg } from "@ffmpeg/ffmpeg"

const DB_NAME = "ffmpeg-cache"
const STORE_NAME = "files"
const DB_VERSION = 1
const FFMPEG_VERSION = "0.12.10"

// Approximate total size of FFmpeg JS (106KB) and WASM (24.46MB)
export const FFMPEG_TOTAL_BYTES = 106139 + 24465514

export interface FFmpegInstallStatus {
  status: "not_installed" | "downloading" | "installed" | "error"
  progress: number
  error?: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment."))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getCachedFile(key: string): Promise<Blob | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(key)
    request.onsuccess = () => {
      resolve(request.result?.blob || null)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function saveCachedFile(
  key: string,
  blob: Blob,
  version: string
): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put({ blob, version, timestamp: Date.now() }, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function isFFmpegInstalled(
  expectedVersion: string = FFMPEG_VERSION
): Promise<boolean> {
  try {
    const db = await openDb()
    const checkFile = (key: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, "readonly")
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get(key)
        request.onsuccess = () => {
          const val = request.result
          resolve(
            val && val.blob instanceof Blob && val.version === expectedVersion
          )
        }
        request.onerror = () => resolve(false)
      })
    }
    const jsOk = await checkFile("ffmpeg-core.js")
    const wasmOk = await checkFile("ffmpeg-core.wasm")
    return jsOk && wasmOk
  } catch (e) {
    console.error("Failed to check FFmpeg installation status:", e)
    return false
  }
}

async function fetchWithProgress(
  url: string,
  onProgress: (loaded: number) => void
): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download from ${url}: Status ${response.status}`)
  }

  if (!response.body) {
    return await response.blob()
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      loaded += value.length
      onProgress(loaded)
    }
  }

  return new Blob(chunks as any[])
}

export async function downloadFFmpeg(
  version: string = FFMPEG_VERSION,
  onProgress: (percent: number) => void
): Promise<void> {
  const jsUrl = `https://unpkg.com/@ffmpeg/core@${version}/dist/umd/ffmpeg-core.js`
  const wasmUrl = `https://unpkg.com/@ffmpeg/core@${version}/dist/umd/ffmpeg-core.wasm`

  let jsLoaded = 0
  let wasmLoaded = 0

  const updateProgress = () => {
    const totalLoaded = jsLoaded + wasmLoaded
    const pct = Math.round((totalLoaded / FFMPEG_TOTAL_BYTES) * 100)
    onProgress(Math.min(pct, 99)) // Keep at 99% until fully saved to db
  }

  try {
    const jsBlob = await fetchWithProgress(jsUrl, (loaded) => {
      jsLoaded = loaded
      updateProgress()
    })

    const wasmBlob = await fetchWithProgress(wasmUrl, (loaded) => {
      wasmLoaded = loaded
      updateProgress()
    })

    await saveCachedFile("ffmpeg-core.js", jsBlob, version)
    await saveCachedFile("ffmpeg-core.wasm", wasmBlob, version)

    onProgress(100)
  } catch (err) {
    console.error("Error downloading/saving FFmpeg:", err)
    throw err
  }
}

export async function loadFFmpegFromCache(
  ffmpegInstance: FFmpeg,
  version: string = FFMPEG_VERSION
): Promise<void> {
  const jsBlob = await getCachedFile("ffmpeg-core.js")
  const wasmBlob = await getCachedFile("ffmpeg-core.wasm")

  if (!jsBlob || !wasmBlob) {
    throw new Error(
      "FFmpeg core files not found in IndexedDB. Please install FFmpeg first."
    )
  }

  const jsUrl = URL.createObjectURL(jsBlob)
  const wasmUrl = URL.createObjectURL(wasmBlob)

  try {
    await ffmpegInstance.load({
      coreURL: jsUrl,
      wasmURL: wasmUrl
    })
  } catch (err) {
    console.error("Failed to load FFmpeg instance from Blob URLs:", err)
    throw err
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(jsUrl)
      URL.revokeObjectURL(wasmUrl)
    }, 15000)
  }
}
