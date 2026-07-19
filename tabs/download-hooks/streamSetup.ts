import { getDirectoryHandle } from "../../utils/storage";
import type { JobState } from "./types";

export async function setupDestinationStream(
  job: JobState,
  setDirPermission: (perm: string) => void
): Promise<any> {
  let writableStream: any = null;

  // 1. Attempt to write to default directory if configured
  try {
    const dirHandle = await getDirectoryHandle();
    if (dirHandle) {
      const verifyOpts = { mode: "readwrite" };
      let perm = await (dirHandle as any).queryPermission(verifyOpts);
      if (perm !== "granted") {
        perm = await (dirHandle as any).requestPermission(verifyOpts);
      }
      if (perm === "granted") {
        setDirPermission("granted");
        const fileHandle = await dirHandle.getFileHandle(`${job.title}.${job.ext}`, { create: true });
        writableStream = await fileHandle.createWritable();
      }
    }
  } catch (err) {
    console.warn("Failed to write to default folder, falling back to file picker", err);
  }

  // 2. Fallback to manual save file picker
  if (!writableStream && (window as any).showSaveFilePicker) {
    try {
      const pickerOptions = {
        suggestedName: `${job.title}.${job.ext}`,
        types: [
          {
            description: `${job.ext.toUpperCase()} File`,
            accept: {
              [`video/${job.ext === "mp4" ? "mp4" : "webm"}`]: [`.${job.ext}`],
            },
          },
        ],
      };
      const fileHandle = await (window as any).showSaveFilePicker(pickerOptions);
      writableStream = await fileHandle.createWritable();
    } catch (pickerErr) {
      console.warn("Save file picker skipped or unavailable:", pickerErr);
    }
  }

  // 3. In-memory / Blob stream fallback if no disk stream available
  if (!writableStream) {
    console.log("Using in-memory Blob stream fallback for download:", job.title);
    const streamChunks: Uint8Array[] = [];
    writableStream = {
      write: async (chunk: ArrayBuffer | Uint8Array) => {
        streamChunks.push(new Uint8Array(chunk));
      },
      close: async () => {
        const blob = new Blob(streamChunks as BlobPart[], { type: `video/${job.ext === "mp4" ? "mp4" : "webm"}` });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `${job.title}.${job.ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      },
      abort: async () => {
        streamChunks.length = 0;
      }
    };
  }

  return writableStream;
}
