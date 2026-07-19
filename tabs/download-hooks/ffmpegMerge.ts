import { getCachedFile } from "../../utils/ffmpeg-helper";
import type { TrimRange } from "../../types/youtube";

export const ffmpegWorkerUrl = new URL(
  "../../node_modules/@ffmpeg/ffmpeg/dist/umd/814.ffmpeg.js",
  import.meta.url
);

export function mergeChunksToBuffer(
  chunks: Map<number, ArrayBuffer>,
  totalChunks: number
): Uint8Array {
  let totalLength = 0;
  for (let i = 0; i < totalChunks; i++) {
    const chunk = chunks.get(i);
    if (chunk) {
      totalLength += chunk.byteLength;
    }
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (let i = 0; i < totalChunks; i++) {
    const chunk = chunks.get(i);
    if (chunk) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
  }
  return result;
}

export async function runFFmpegMerge(
  videoData: Uint8Array,
  audioData: Uint8Array | null,
  ext: string,
  audioExt?: string,
  trimRange?: TrimRange,
  subtitleBuffers?: { name: string; code: string; data: Uint8Array }[]
): Promise<Uint8Array> {
  // Retrieve cached FFmpeg core Blobs from IndexedDB
  const coreJSBlob = await getCachedFile("ffmpeg-core.js");
  const coreWASMBlob = await getCachedFile("ffmpeg-core.wasm");

  if (!coreJSBlob || !coreWASMBlob) {
    throw new Error("FFmpeg is not installed. Please go to Settings and install it first.");
  }

  // Fetch the bundler's compiled FFmpeg worker file
  let ffmpegWorkerBlob: Blob | null = null;
  try {
    const response = await fetch(ffmpegWorkerUrl.toString());
    if (response.ok) {
      ffmpegWorkerBlob = await response.blob();
    }
  } catch (err) {
    console.warn("Failed to fetch local FFmpeg worker chunk:", err);
  }

  const iframe = document.getElementById("ffmpeg-sandbox") as HTMLIFrameElement;
  if (!iframe || !iframe.contentWindow) {
    throw new Error("FFmpeg sandbox environment is not initialized yet.");
  }

  return new Promise<Uint8Array>((resolve, reject) => {
    const handleResponse = (event: MessageEvent) => {
      if (!event.data) return;

      if (event.data.type === "MERGE_SUCCESS") {
        window.removeEventListener("message", handleResponse);
        resolve(new Uint8Array(event.data.mergedData));
      } else if (event.data.type === "MERGE_FAILURE") {
        window.removeEventListener("message", handleResponse);
        reject(new Error(event.data.error || "Failed to merge streams in sandbox."));
      }
    };

    window.addEventListener("message", handleResponse);

    const videoBuf = videoData.buffer as ArrayBuffer;
    const audioBuf = audioData ? (audioData.buffer as ArrayBuffer) : null;

    const subTransfers: ArrayBuffer[] = [];
    const subPayloads = (subtitleBuffers || []).map((s) => {
      const buf = s.data.buffer as ArrayBuffer;
      subTransfers.push(buf);
      return { name: s.name, code: s.code, data: buf };
    });

    const transferables: Transferable[] = [videoBuf];
    if (audioBuf) transferables.push(audioBuf);
    transferables.push(...subTransfers);

    iframe.contentWindow!.postMessage(
      {
        type: "MERGE",
        videoData: videoBuf,
        audioData: audioBuf,
        subtitleBuffers: subPayloads,
        trimRange,
        coreJSBlob,
        coreWASMBlob,
        ffmpegWorkerBlob,
        ext,
        audioExt
      },
      "*",
      transferables
    );
  });
}
