import { getDirectoryHandle } from "../../utils/storage"
import type { JobState } from "./types"

function getMimeType(ext: string): string {
  const e = (ext || "mp4").toLowerCase()
  if (e === "m4a" || e === "aac") return "audio/mp4"
  if (e === "mp3") return "audio/mpeg"
  if (e === "wav") return "audio/wav"
  if (e === "webm") return "video/webm"
  if (e === "srt") return "text/plain"
  return "video/mp4"
}

export type SaveMode = "directory" | "browser"

export async function setupDestinationStream(
  job: JobState,
  setDirPermission?: (perm: string) => void,
  saveMode: SaveMode = "directory"
): Promise<any> {
  let writableStream: any = null
  const mimeType = getMimeType(job.ext)

  // 1. If saveMode is "directory", attempt to write directly to default directory handle
  if (saveMode === "directory") {
    try {
      const dirHandle = await getDirectoryHandle()
      if (dirHandle) {
        let perm = "granted"
        try {
          perm = await (dirHandle as any).queryPermission({ mode: "readwrite" })
          if (perm !== "granted") {
            perm = await (dirHandle as any).requestPermission({
              mode: "readwrite"
            })
          }
        } catch (_) {}

        if (perm === "granted") {
          if (setDirPermission) setDirPermission("granted")
          const fileHandle = await dirHandle.getFileHandle(
            `${job.title}.${job.ext}`,
            { create: true }
          )
          writableStream = await fileHandle.createWritable()
        }
      }
    } catch (err) {
      console.warn(
        "Directory handle write failed or stale, falling back to browser anchor stream:",
        err
      )
    }
  }

  // 2. Browser Anchor Stream fallback (or default when saveMode === "browser")
  if (!writableStream) {
    console.log(
      `Using Browser Anchor Stream for download (${saveMode} mode):`,
      job.title
    )
    const streamChunks: Uint8Array[] = []
    writableStream = {
      write: async (chunk: ArrayBuffer | Uint8Array) => {
        streamChunks.push(new Uint8Array(chunk))
      },
      close: async () => {
        const blob = new Blob(streamChunks as BlobPart[], { type: mimeType })
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = blobUrl
        a.download = `${job.title}.${job.ext}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
      },
      abort: async () => {
        streamChunks.length = 0
      }
    }
  }

  return writableStream
}
