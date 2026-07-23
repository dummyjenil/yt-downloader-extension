import type { TrimRange } from "../../types/youtube"
import { downloadFFmpeg, getCachedFile } from "../../utils/ffmpeg-helper"

export const ffmpegWorkerUrl = new URL(
  "../../node_modules/@ffmpeg/ffmpeg/dist/umd/814.ffmpeg.js",
  import.meta.url
)

export function mergeChunksToBuffer(
  chunks: Map<number, ArrayBuffer>,
  totalChunks: number
): Uint8Array {
  let totalLength = 0
  for (let i = 0; i < totalChunks; i++) {
    const chunk = chunks.get(i)
    if (chunk) {
      totalLength += chunk.byteLength
    }
  }

  const result = new Uint8Array(totalLength)
  let offset = 0
  for (let i = 0; i < totalChunks; i++) {
    const chunk = chunks.get(i)
    if (chunk) {
      result.set(new Uint8Array(chunk), offset)
      offset += chunk.byteLength
    }
  }
  return result
}

export async function runFFmpegMerge(
  videoData: Uint8Array,
  audioData: Uint8Array | null,
  ext: string,
  audioExt?: string,
  trimRange?: TrimRange,
  subtitleBuffers?: { name: string; code: string; data: Uint8Array }[],
  thumbnailBuffer?: Uint8Array | null,
  chapterMetadata?: string,
  metadataInfo?: { title?: string; artist?: string; album?: string }
): Promise<Uint8Array> {
  // Node environment fallback for CLI test runner (verify_ts_downloader.ts)
  if (typeof window === "undefined" || typeof document === "undefined") {
    try {
      const req =
        typeof globalThis !== "undefined" && (globalThis as any).require
          ? (globalThis as any).require
          : eval("require")
      const fs = req("fs")
      const path = req("path")
      const { execSync } = req("child_process")

      const tmpDir = path.join(process.cwd(), "test")
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

      const isAudioOnly =
        ext === "m4a" || ext === "mp3" || ext === "aac" || ext === "wav"
      const vName = path.join(tmpDir, `_node_tmp_v_${Date.now()}.${ext}`)
      const outName = path.join(tmpDir, `_node_tmp_out_${Date.now()}.${ext}`)
      fs.writeFileSync(vName, videoData)

      let aName = ""
      if (audioData) {
        const aExt = audioExt || (ext === "webm" ? "webm" : "m4a")
        aName = path.join(tmpDir, `_node_tmp_a_${Date.now()}.${aExt}`)
        fs.writeFileSync(aName, audioData)
      }

      const args: string[] = []
      const isTrimming = trimRange && trimRange.enabled
      const vSeek =
        isTrimming && trimRange.vSeek !== undefined
          ? trimRange.vSeek
          : isTrimming
            ? Math.max(0, trimRange.startTimeSec)
            : 0
      const aSeek =
        isTrimming && trimRange.aSeek !== undefined
          ? trimRange.aSeek
          : isTrimming
            ? Math.max(0, trimRange.startTimeSec)
            : 0
      const durationSec = isTrimming
        ? Math.max(0.1, trimRange.endTimeSec - trimRange.startTimeSec)
        : 0

      if (isTrimming) args.push("-ss", String(vSeek))
      args.push("-i", vName)

      if (aName) {
        if (isTrimming) args.push("-ss", String(aSeek))
        args.push("-i", aName)
      }

      if (isTrimming) args.push("-t", String(durationSec))

      const subNames: string[] = []
      if (subtitleBuffers && subtitleBuffers.length > 0) {
        for (let i = 0; i < subtitleBuffers.length; i++) {
          const sub = subtitleBuffers[i]
          const subPath = path.join(
            tmpDir,
            `_node_tmp_sub_${i}_${Date.now()}.srt`
          )
          fs.writeFileSync(subPath, sub.data)
          subNames.push(subPath)
          args.push("-i", subPath)
        }
      }

      if (isAudioOnly) {
        args.push("-map", "0:a:0")
        if (isTrimming || ext === "webm") {
          args.push("-c:a", ext === "webm" ? "libopus" : "aac")
        } else {
          args.push("-c:a", "copy")
        }
      } else {
        args.push("-map", "0:v:0", "-c:v", "copy")
        if (ext === "mp4") args.push("-bsf:v", "h264_mp4toannexb")

        if (aName) {
          args.push("-map", "1:a:0")
          if (ext === "mp4") args.push("-c:a", "aac")
          else if (ext === "webm") args.push("-c:a", "libopus")
          else args.push("-c:a", "copy")
        } else {
          args.push("-map", "0:a:0?")
          if (isTrimming) args.push("-c:a", "aac")
          else args.push("-c:a", "copy")
        }

        if (subNames.length > 0) {
          for (let i = 0; i < subNames.length; i++) {
            const subInputIndex = aName ? 2 + i : 1 + i
            args.push("-map", `${subInputIndex}:s:0`)
          }
          const subCodec = ext === "webm" ? "webvtt" : "mov_text"
          args.push("-c:s", subCodec)
        }

        if (ext === "mp4") args.push("-movflags", "+faststart")
      }

      const cmd = `ffmpeg -y -v warning ${args.map((a) => `"${a}"`).join(" ")} "${outName}"`
      execSync(cmd)
      const mergedRes = fs.readFileSync(outName)

      if (fs.existsSync(vName)) fs.unlinkSync(vName)
      if (aName && fs.existsSync(aName)) fs.unlinkSync(aName)
      if (fs.existsSync(outName)) fs.unlinkSync(outName)

      return new Uint8Array(mergedRes)
    } catch (nodeErr) {
      console.warn("Node FFmpeg execution fallback error:", nodeErr)
      throw nodeErr
    }
  }

  // Retrieve cached FFmpeg core Blobs from IndexedDB in Browser environment
  let coreJSBlob = await getCachedFile("ffmpeg-core.js")
  let coreWASMBlob = await getCachedFile("ffmpeg-core.wasm")

  // Auto-download FFmpeg if not cached yet
  if (!coreJSBlob || !coreWASMBlob) {
    console.log(
      "FFmpeg core files not cached in IndexedDB. Downloading on-the-fly..."
    )
    await downloadFFmpeg("0.12.10", () => {})
    coreJSBlob = await getCachedFile("ffmpeg-core.js")
    coreWASMBlob = await getCachedFile("ffmpeg-core.wasm")
  }

  if (!coreJSBlob || !coreWASMBlob) {
    throw new Error(
      "FFmpeg engine is not available. Please check your internet connection."
    )
  }

  // Fetch the bundler's compiled FFmpeg worker file
  let ffmpegWorkerBlob: Blob | null = null
  try {
    const response = await fetch(ffmpegWorkerUrl.toString())
    if (response.ok) {
      ffmpegWorkerBlob = await response.blob()
    }
  } catch (err) {
    console.warn("Failed to fetch local FFmpeg worker chunk:", err)
  }

  const iframe = document.getElementById("ffmpeg-sandbox") as HTMLIFrameElement
  if (!iframe || !iframe.contentWindow) {
    throw new Error("FFmpeg sandbox environment is not initialized yet.")
  }

  return new Promise<Uint8Array>((resolve, reject) => {
    const handleResponse = (event: MessageEvent) => {
      if (!event.data) return

      if (event.data.type === "MERGE_SUCCESS") {
        window.removeEventListener("message", handleResponse)
        resolve(new Uint8Array(event.data.mergedData))
      } else if (event.data.type === "MERGE_FAILURE") {
        window.removeEventListener("message", handleResponse)
        reject(
          new Error(event.data.error || "Failed to merge streams in sandbox.")
        )
      }
    }

    window.addEventListener("message", handleResponse)

    const videoBuf =
      videoData.byteOffset === 0 &&
      videoData.byteLength === videoData.buffer.byteLength
        ? (videoData.buffer as ArrayBuffer)
        : (videoData.buffer.slice(
            videoData.byteOffset,
            videoData.byteOffset + videoData.byteLength
          ) as ArrayBuffer)

    const audioBuf = audioData
      ? audioData.byteOffset === 0 &&
        audioData.byteLength === audioData.buffer.byteLength
        ? (audioData.buffer as ArrayBuffer)
        : (audioData.buffer.slice(
            audioData.byteOffset,
            audioData.byteOffset + audioData.byteLength
          ) as ArrayBuffer)
      : null

    const subTransfers: ArrayBuffer[] = []
    const subPayloads = (subtitleBuffers || []).map((s) => {
      const buf = s.data.buffer as ArrayBuffer
      subTransfers.push(buf)
      return { name: s.name, code: s.code, data: buf }
    })

    const thumbBuf = thumbnailBuffer
      ? thumbnailBuffer.byteOffset === 0 &&
        thumbnailBuffer.byteLength === thumbnailBuffer.buffer.byteLength
        ? (thumbnailBuffer.buffer as ArrayBuffer)
        : (thumbnailBuffer.buffer.slice(
            thumbnailBuffer.byteOffset,
            thumbnailBuffer.byteOffset + thumbnailBuffer.byteLength
          ) as ArrayBuffer)
      : null

    const transferables: Transferable[] = [videoBuf]
    if (audioBuf) transferables.push(audioBuf)
    if (thumbBuf) transferables.push(thumbBuf)
    transferables.push(...subTransfers)

    iframe.contentWindow!.postMessage(
      {
        type: "MERGE",
        videoData: videoBuf,
        audioData: audioBuf,
        subtitleBuffers: subPayloads,
        thumbnailBuffer: thumbBuf,
        chapterMetadata,
        metadataInfo,
        trimRange,
        coreJSBlob,
        coreWASMBlob,
        ffmpegWorkerBlob,
        ext,
        audioExt
      },
      "*",
      transferables
    )
  })
}
