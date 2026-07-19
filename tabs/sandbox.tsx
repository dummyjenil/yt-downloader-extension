import React, { useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";

export default function SandboxPage() {
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Ensure the message is what we expect
      if (!event.data || event.data.type !== "MERGE") return;

      const { videoData, audioData, subtitleBuffers, trimRange, ext, audioExt } = event.data;
      const logs: string[] = [];

      try {
        const ffmpeg = new FFmpeg();

        ffmpeg.on("log", ({ message }) => {
          console.log("Sandbox FFmpeg Log:", message);
          logs.push(message);
        });

        // Create temporary Object URLs from the Blobs sent by the main extension
        const coreJSUrl = URL.createObjectURL(event.data.coreJSBlob);
        const coreWasmUrl = URL.createObjectURL(event.data.coreWASMBlob);
        const workerBlobUrl = event.data.ffmpegWorkerBlob ? URL.createObjectURL(event.data.ffmpegWorkerBlob) : undefined;

        // Backup original Worker
        const OriginalWorker = window.Worker;

        // Intercept Worker to change it to "classic" so importScripts works inside the Blob worker
        window.Worker = class extends OriginalWorker {
          constructor(scriptURL: string | URL, options?: WorkerOptions) {
            super(scriptURL, { ...options, type: "classic" });
          }
        } as any;

        try {
          // Load FFmpeg inside the sandbox where blob: workers are allowed
          await ffmpeg.load({
            coreURL: coreJSUrl,
            wasmURL: coreWasmUrl,
            classWorkerURL: workerBlobUrl
          });
        } finally {
          // Restore original Worker constructor
          window.Worker = OriginalWorker;
        }

        // Clean up Object URLs immediately after load starts
        URL.revokeObjectURL(coreJSUrl);
        URL.revokeObjectURL(coreWasmUrl);
        if (workerBlobUrl) {
          URL.revokeObjectURL(workerBlobUrl);
        }

        const isAudioOnly = ext === "m4a" || ext === "mp3" || ext === "aac" || ext === "wav";
        const videoName = isAudioOnly ? `input_audio.${ext}` : `input_video.${ext}`;
        const outputName = `output.${ext}`;

        // Write primary video/media file
        await ffmpeg.writeFile(videoName, new Uint8Array(videoData));

        let audioName = "";
        const finalAudioExt = audioExt || (ext === "webm" ? "webm" : "m4a");
        if (audioData) {
          audioName = `input_audio.${finalAudioExt}`;
          await ffmpeg.writeFile(audioName, new Uint8Array(audioData));
        }

        // Write optional subtitle tracks if present
        const subFileNames: string[] = [];
        if (subtitleBuffers && subtitleBuffers.length > 0) {
          for (let i = 0; i < subtitleBuffers.length; i++) {
            const sub = subtitleBuffers[i];
            const subName = sub.name || `sub_${i}.srt`;
            await ffmpeg.writeFile(subName, new Uint8Array(sub.data));
            subFileNames.push(subName);
          }
        }

        const ffmpegArgs: string[] = [];
        const isTrimming = trimRange && trimRange.enabled;
        const vSeek = (isTrimming && trimRange.vSeek !== undefined) ? trimRange.vSeek : (isTrimming ? Math.max(0, trimRange.startTimeSec) : 0);
        const aSeek = (isTrimming && trimRange.aSeek !== undefined) ? trimRange.aSeek : (isTrimming ? Math.max(0, trimRange.startTimeSec) : 0);
        const durationSec = isTrimming ? Math.max(0.1, trimRange.endTimeSec - trimRange.startTimeSec) : 0;

        // Input 0: Primary video/audio file (with -ss before -i for fast keyframe alignment)
        if (isTrimming) {
          ffmpegArgs.push("-ss", String(vSeek));
        }
        ffmpegArgs.push("-i", videoName);

        // Input 1: Optional separate audio file
        if (audioName) {
          if (isTrimming) {
            ffmpegArgs.push("-ss", String(aSeek));
          }
          ffmpegArgs.push("-i", audioName);
        }

        // Input 2+: Optional subtitle files (omit -ss before SRT inputs so subtitle timestamps align with video)
        for (const subName of subFileNames) {
          ffmpegArgs.push("-i", subName);
        }

        // Output duration limit
        if (isTrimming) {
          ffmpegArgs.push("-t", String(durationSec));
        }

        // Explicit Stream Mapping
        if (isAudioOnly) {
          ffmpegArgs.push("-map", "0:a:0");
        } else {
          // Map video from input 0
          ffmpegArgs.push("-map", "0:v:0");
          // Map audio from input 1 (if separate audio stream) or input 0 (if embedded)
          if (audioName) {
            ffmpegArgs.push("-map", "1:a:0");
          } else {
            ffmpegArgs.push("-map", "0:a:0?");
          }
          // Map subtitles starting from input 2 (if separate audio was present) or input 1
          const subInputStartIdx = audioName ? 2 : 1;
          for (let i = 0; i < subFileNames.length; i++) {
            ffmpegArgs.push("-map", `${subInputStartIdx + i}:s:0`);
          }
        }

        // Codec & Bitstream configuration
        if (isAudioOnly) {
          if (isTrimming || (ext === "webm" && finalAudioExt !== "webm")) {
            if (ext === "webm") {
              ffmpegArgs.push("-c:a", "libopus");
            } else if (ext === "m4a" || ext === "mp4" || ext === "aac") {
              ffmpegArgs.push("-c:a", "aac");
            } else {
              ffmpegArgs.push("-c:a", "copy");
            }
          } else {
            ffmpegArgs.push("-c:a", "copy");
          }
        } else {
          // Stream copy video without re-encoding whole 1080p stream
          ffmpegArgs.push("-c:v", "copy");

          if (audioData) {
            const isMp4Output = ext === "mp4";
            const isWebmOutput = ext === "webm";
            const isAudioM4a = finalAudioExt === "m4a" || finalAudioExt === "mp4";
            const isAudioWebm = finalAudioExt === "webm";

            if (isMp4Output && isAudioWebm) {
              // WebM/Opus audio converted to AAC for MP4 container compatibility
              ffmpegArgs.push("-c:a", "aac");
            } else if (isWebmOutput && isAudioM4a) {
              // M4A/AAC audio converted to Opus for WebM container compatibility
              ffmpegArgs.push("-c:a", "libopus");
            } else {
              // Stream copy compatible audio formats (MP4+m4a, WebM+webm, MKV) instantly
              ffmpegArgs.push("-c:a", "copy");
            }
          } else {
            ffmpegArgs.push("-c:a", "copy");
          }

          if (ext === "mp4") {
            ffmpegArgs.push("-movflags", "+faststart");
          }
        }

        // Subtitle codecs & metadata
        if (subFileNames.length > 0) {
          const subCodec = ext === "webm" ? "webvtt" : "mov_text";
          ffmpegArgs.push("-c:s", subCodec);

          for (let i = 0; i < subtitleBuffers.length; i++) {
            const langCode = subtitleBuffers[i].code || "eng";
            ffmpegArgs.push(`-metadata:s:s:${i}`, `language=${langCode}`);
          }
        }

        ffmpegArgs.push(outputName);

        console.log("Executing FFmpeg in Sandbox with args:", ffmpegArgs.join(" "));
        await ffmpeg.exec(ffmpegArgs);

        // Read merged output
        const outputData = await ffmpeg.readFile(outputName);

        // Clean up virtual filesystem
        try {
          await ffmpeg.deleteFile(videoName);
          if (audioName) await ffmpeg.deleteFile(audioName);
          for (const subName of subFileNames) {
            await ffmpeg.deleteFile(subName);
          }
          await ffmpeg.deleteFile(outputName);
          ffmpeg.terminate();
        } catch (e) {
          console.warn("Sandbox FFmpeg cleanup failed:", e);
        }

        const outputBuf = outputData instanceof Uint8Array 
          ? (outputData.buffer.slice(outputData.byteOffset, outputData.byteOffset + outputData.byteLength) as ArrayBuffer)
          : (new Uint8Array(outputData as any).buffer as ArrayBuffer);

        // Post output back to parent page, using transferables for performance
        window.parent.postMessage(
          { type: "MERGE_SUCCESS", mergedData: outputBuf },
          "*",
          [outputBuf]
        );
      } catch (err: any) {
        console.error("Sandbox FFmpeg execution failed:", err);
        const lastLogs = logs.slice(-10).join("\n");
        window.parent.postMessage(
          { 
            type: "MERGE_FAILURE", 
            error: `${err.message || "Failed to merge streams in sandbox."}\nFFmpeg Logs:\n${lastLogs}` 
          },
          "*"
        );
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return <div style={{ display: "none" }}>FFmpeg Sandbox</div>;
}

