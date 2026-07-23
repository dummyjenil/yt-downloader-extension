import { FFmpeg } from "@ffmpeg/ffmpeg"
import React, { useEffect } from "react"

export default function SandboxPage() {
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Ensure the message is what we expect
      if (!event.data || event.data.type !== "MERGE") return

      const {
        videoData,
        audioData,
        subtitleBuffers,
        thumbnailBuffer,
        chapterMetadata,
        metadataInfo,
        trimRange,
        ext,
        audioExt
      } = event.data
      const logs: string[] = []

      console.log("⚡ [SANDBOX RECEIVED MERGE TASK]", {
        videoDataSize: videoData ? videoData.byteLength : 0,
        audioDataSize: audioData ? audioData.byteLength : 0,
        thumbnailSize: thumbnailBuffer ? thumbnailBuffer.byteLength : 0,
        hasChapters: !!chapterMetadata,
        ext,
        audioExt,
        trimRange
      })

      try {
        const ffmpeg = new FFmpeg()

        ffmpeg.on("log", ({ message }) => {
          console.log("⚡ [SANDBOX FFmpeg LOG]", message)
          logs.push(message)
        })

        // Create temporary Object URLs from the Blobs sent by the main extension
        const coreJSUrl = URL.createObjectURL(event.data.coreJSBlob)
        const coreWasmUrl = URL.createObjectURL(event.data.coreWASMBlob)
        const workerBlobUrl = event.data.ffmpegWorkerBlob
          ? URL.createObjectURL(event.data.ffmpegWorkerBlob)
          : undefined

        // Backup original Worker
        const OriginalWorker = window.Worker

        // Intercept Worker to change it to "classic" so importScripts works inside the Blob worker
        window.Worker = class extends OriginalWorker {
          constructor(scriptURL: string | URL, options?: WorkerOptions) {
            super(scriptURL, { ...options, type: "classic" })
          }
        } as any

        try {
          // Load FFmpeg inside the sandbox where blob: workers are allowed
          await ffmpeg.load({
            coreURL: coreJSUrl,
            wasmURL: coreWasmUrl,
            classWorkerURL: workerBlobUrl
          })
          console.log("⚡ [SANDBOX FFmpeg ENGINE LOADED SUCCESSFULLY]")
        } finally {
          // Restore original Worker constructor
          window.Worker = OriginalWorker
        }

        // Clean up Object URLs immediately after load starts
        URL.revokeObjectURL(coreJSUrl)
        URL.revokeObjectURL(coreWasmUrl)
        if (workerBlobUrl) {
          URL.revokeObjectURL(workerBlobUrl)
        }

        const isAudioOnly =
          ext === "m4a" || ext === "mp3" || ext === "aac" || ext === "wav"
        const videoName = isAudioOnly
          ? `input_audio.${ext}`
          : `input_video.${ext}`
        const outputName = `output.${ext}`

        // Write primary video/media file
        await ffmpeg.writeFile(videoName, new Uint8Array(videoData))

        let audioName = ""
        const finalAudioExt = audioExt || (ext === "webm" ? "webm" : "m4a")
        if (audioData) {
          audioName = `input_audio.${finalAudioExt}`
          await ffmpeg.writeFile(audioName, new Uint8Array(audioData))
        }

        // Write optional subtitle tracks if present
        const subFileNames: string[] = []
        if (subtitleBuffers && subtitleBuffers.length > 0) {
          for (let i = 0; i < subtitleBuffers.length; i++) {
            const sub = subtitleBuffers[i]
            const subName = sub.name || `sub_${i}.srt`
            await ffmpeg.writeFile(subName, new Uint8Array(sub.data))
            subFileNames.push(subName)
          }
        }

        // Write chapter metadata if present
        let chapterFileName = ""
        if (chapterMetadata) {
          chapterFileName = "ffmetadata.txt"
          await ffmpeg.writeFile(
            chapterFileName,
            new TextEncoder().encode(chapterMetadata)
          )
        }

        // Write thumbnail cover art if present
        let thumbFileName = ""
        if (thumbnailBuffer) {
          thumbFileName = "thumbnail.jpg"
          await ffmpeg.writeFile(thumbFileName, new Uint8Array(thumbnailBuffer))
        }

        const ffmpegArgs: string[] = []
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

        let inputCount = 0

        // Input 0: Primary video/media file
        if (isTrimming) {
          ffmpegArgs.push("-ss", String(vSeek))
        }
        ffmpegArgs.push("-i", videoName)
        const vInputIdx = inputCount++

        // Input 1: Optional separate audio file
        let aInputIdx = -1
        if (audioName) {
          if (isTrimming) {
            ffmpegArgs.push("-ss", String(aSeek))
          }
          ffmpegArgs.push("-i", audioName)
          aInputIdx = inputCount++
        }

        // Input 2+: Optional subtitle files
        const subInputIndices: number[] = []
        for (const subName of subFileNames) {
          subInputIndices.push(inputCount++)
          ffmpegArgs.push("-i", subName)
        }

        // Input N: Optional chapter metadata file
        let metaInputIdx = -1
        if (chapterFileName) {
          metaInputIdx = inputCount++
          ffmpegArgs.push("-f", "ffmetadata", "-i", chapterFileName)
        }

        // Input N: Optional thumbnail image file
        let thumbInputIdx = -1
        if (thumbFileName) {
          thumbInputIdx = inputCount++
          ffmpegArgs.push("-i", thumbFileName)
        }

        // Output duration limit
        if (isTrimming) {
          ffmpegArgs.push("-t", String(durationSec))
        }

        // Stream Mapping & Codecs
        if (isAudioOnly) {
          ffmpegArgs.push("-map", "0:a:0")
          if (isTrimming || (ext === "webm" && finalAudioExt !== "webm")) {
            if (ext === "webm") {
              ffmpegArgs.push("-c:a", "libopus")
            } else if (ext === "m4a" || ext === "mp4" || ext === "aac") {
              ffmpegArgs.push("-c:a", "aac")
            } else {
              ffmpegArgs.push("-c:a", "copy")
            }
          } else {
            ffmpegArgs.push("-c:a", "copy")
          }
        } else {
          ffmpegArgs.push("-map", `${vInputIdx}:v:0`)
          ffmpegArgs.push("-c:v", "copy")

          if (audioName) {
            ffmpegArgs.push("-map", `${aInputIdx}:a:0`)
            const isMp4Output = ext === "mp4"
            const isWebmOutput = ext === "webm"
            const isAudioM4a =
              finalAudioExt === "m4a" || finalAudioExt === "mp4"
            const isAudioWebm = finalAudioExt === "webm"

            if (isMp4Output && isAudioWebm) {
              ffmpegArgs.push("-c:a", "aac")
            } else if (isWebmOutput && isAudioM4a) {
              ffmpegArgs.push("-c:a", "libopus")
            } else if (isTrimming) {
              if (isMp4Output) {
                ffmpegArgs.push("-c:a", "aac")
              } else if (isWebmOutput) {
                ffmpegArgs.push("-c:a", "libopus")
              } else {
                ffmpegArgs.push("-c:a", "copy")
              }
            } else {
              ffmpegArgs.push("-c:a", "copy")
            }
          } else {
            ffmpegArgs.push("-map", `${vInputIdx}:a:0?`)
            if (isTrimming) {
              ffmpegArgs.push("-c:a", "aac")
            } else {
              ffmpegArgs.push("-c:a", "copy")
            }
          }

          if (ext === "mp4") {
            ffmpegArgs.push("-movflags", "+faststart")
          }
        }

        // Subtitle codecs & metadata
        if (subInputIndices.length > 0) {
          for (let i = 0; i < subInputIndices.length; i++) {
            ffmpegArgs.push("-map", `${subInputIndices[i]}:s:0`)
          }
          const subCodec = ext === "webm" ? "webvtt" : "mov_text"
          ffmpegArgs.push("-c:s", subCodec)

          for (let i = 0; i < subtitleBuffers.length; i++) {
            const langCode = subtitleBuffers[i].code || "eng"
            ffmpegArgs.push(`-metadata:s:s:${i}`, `language=${langCode}`)
          }
        }

        // Chapter metadata mapping
        if (metaInputIdx !== -1) {
          ffmpegArgs.push("-map_metadata", String(metaInputIdx))
        }

        // Thumbnail / Cover Art mapping for MP4/M4A containers
        if (thumbInputIdx !== -1 && (ext === "mp4" || ext === "m4a")) {
          ffmpegArgs.push("-map", `${thumbInputIdx}:v:0`)
          ffmpegArgs.push("-c:v:1", "copy")
          ffmpegArgs.push("-disposition:v:1", "attached_pic")
        }

        // General ID3 / Track Metadata tags
        if (metadataInfo) {
          if (metadataInfo.title)
            ffmpegArgs.push("-metadata", `title=${metadataInfo.title}`)
          if (metadataInfo.artist)
            ffmpegArgs.push("-metadata", `artist=${metadataInfo.artist}`)
          ffmpegArgs.push(
            "-metadata",
            `album=${metadataInfo.album || "YouTube Downloads"}`
          )
        }

        ffmpegArgs.push(outputName)

        console.log(
          "⚡ [EXECUTING FFmpeg IN SANDBOX ARGS]",
          ffmpegArgs.join(" ")
        )
        await ffmpeg.exec(ffmpegArgs)

        // Read merged output
        const outputData = await ffmpeg.readFile(outputName)
        console.log(
          "⚡ [SANDBOX READ OUTPUT DATA SIZE]",
          outputData
            ? (outputData as any).byteLength || (outputData as any).length || 0
            : 0
        )

        // Clean up virtual filesystem
        try {
          await ffmpeg.deleteFile(videoName)
          if (audioName) await ffmpeg.deleteFile(audioName)
          for (const subName of subFileNames) {
            await ffmpeg.deleteFile(subName)
          }
          await ffmpeg.deleteFile(outputName)
          ffmpeg.terminate()
        } catch (e) {
          console.warn("Sandbox FFmpeg cleanup failed:", e)
        }

        const outputBuf =
          outputData instanceof Uint8Array
            ? (outputData.buffer.slice(
                outputData.byteOffset,
                outputData.byteOffset + outputData.byteLength
              ) as ArrayBuffer)
            : (new Uint8Array(outputData as any).buffer as ArrayBuffer)

        console.log(
          "⚡ [SANDBOX POSTING MERGE_SUCCESS BACK TO PARENT]",
          outputBuf.byteLength
        )

        // Post output back to parent page, using transferables for performance
        window.parent.postMessage(
          { type: "MERGE_SUCCESS", mergedData: outputBuf },
          "*",
          [outputBuf]
        )
      } catch (err: any) {
        console.error("⚡ [SANDBOX FFmpeg EXECUTION FAILED]", err)
        const lastLogs = logs.slice(-10).join("\n")
        window.parent.postMessage(
          {
            type: "MERGE_FAILURE",
            error: `${err.message || "Failed to merge streams in sandbox."}\nFFmpeg Logs:\n${lastLogs}`
          },
          "*"
        )
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  return <div style={{ display: "none" }}>FFmpeg Sandbox</div>
}
