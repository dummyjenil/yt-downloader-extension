import React, { useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";

export default function SandboxPage() {
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Ensure the message is what we expect
      if (!event.data || event.data.type !== "MERGE") return;

      const { videoData, audioData, coreJSBlob, coreWASMBlob, ffmpegWorkerBlob, ext, audioExt } = event.data;
      const logs: string[] = [];

      try {
        const ffmpeg = new FFmpeg();

        ffmpeg.on("log", ({ message }) => {
          console.log("Sandbox FFmpeg Log:", message);
          logs.push(message);
        });

        // Create temporary Object URLs from the Blobs sent by the main extension
        const coreJSUrl = URL.createObjectURL(coreJSBlob);
        const coreWasmUrl = URL.createObjectURL(coreWASMBlob);
        const workerBlobUrl = ffmpegWorkerBlob ? URL.createObjectURL(ffmpegWorkerBlob) : undefined;

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
        const finalAudioExt = audioExt || (ext === "webm" ? "webm" : "m4a");
        const audioName = `input_audio.${finalAudioExt}`;
        const outputName = `output.${ext}`;

        // Write files to virtual filesystem
        await ffmpeg.writeFile(videoName, new Uint8Array(videoData));
        await ffmpeg.writeFile(audioName, new Uint8Array(audioData));

        // Intelligently select codec logic for mismatched formats
        let audioCodec = "copy";
        if (ext === "webm" && finalAudioExt !== "webm") {
          // WebM needs vorbis or opus audio
          audioCodec = "libopus";
        } else if (ext === "mp4" && finalAudioExt === "webm") {
          // MP4 is safest with AAC audio
          audioCodec = "aac";
        }

        // Execute copy-merge
        await ffmpeg.exec([
          "-i", videoName,
          "-i", audioName,
          "-c:v", "copy",
          "-c:a", audioCodec,
          "-map", "0:v:0",
          "-map", "1:a:0",
          outputName
        ]);

        // Read merged output
        const outputData = await ffmpeg.readFile(outputName);

        // Clean up virtual filesystem
        try {
          await ffmpeg.deleteFile(videoName);
          await ffmpeg.deleteFile(audioName);
          await ffmpeg.deleteFile(outputName);
          ffmpeg.terminate();
        } catch (e) {
          console.warn("Sandbox FFmpeg cleanup failed:", e);
        }

        const outputBuf = outputData instanceof Uint8Array 
          ? outputData.buffer 
          : new Uint8Array(outputData as any).buffer;

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
