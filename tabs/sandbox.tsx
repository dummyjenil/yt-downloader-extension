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

        const videoName = `input_video.${ext}`;
        const outputName = `output.${ext}`;

        // Write primary video/media file
        await ffmpeg.writeFile(videoName, new Uint8Array(videoData));

        const ffmpegArgs: string[] = [];
        ffmpegArgs.push("-i", videoName);

        // Write optional audio file if present
        let audioName = "";
        const finalAudioExt = audioExt || (ext === "webm" ? "webm" : "m4a");
        if (audioData) {
          audioName = `input_audio.${finalAudioExt}`;
          await ffmpeg.writeFile(audioName, new Uint8Array(audioData));
          ffmpegArgs.push("-i", audioName);
        }

        // Write optional subtitle tracks if present
        const subFileNames: string[] = [];
        if (subtitleBuffers && subtitleBuffers.length > 0) {
          for (let i = 0; i < subtitleBuffers.length; i++) {
            const sub = subtitleBuffers[i];
            const subName = sub.name || `sub_${i}.srt`;
            await ffmpeg.writeFile(subName, new Uint8Array(sub.data));
            subFileNames.push(subName);
            ffmpegArgs.push("-i", subName);
          }
        }

        // Apply trimming (-ss and -to) if active
        if (trimRange && trimRange.enabled) {
          ffmpegArgs.push("-ss", String(trimRange.startTimeSec));
          ffmpegArgs.push("-to", String(trimRange.endTimeSec));
        }

        // Video codec
        ffmpegArgs.push("-c:v", "copy");

        // Audio codec configuration
        if (audioData) {
          let audioCodec = "copy";
          if (ext === "webm" && finalAudioExt !== "webm") {
            audioCodec = "libopus";
          } else if (ext === "mp4" && finalAudioExt === "webm") {
            audioCodec = "aac";
          }
          ffmpegArgs.push("-c:a", audioCodec);
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

