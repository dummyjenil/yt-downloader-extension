import { getDirectoryHandle } from "../../utils/storage";
import { jsonToWordSrt } from "../../utils/subtitle";
import type { JobState } from "./types";

export async function processSrtDownload(
  job: JobState,
  refreshHistory: () => void,
  processQueue: () => void
): Promise<void> {
  let writableStream: any = null;
  try {
    const dirHandle = await getDirectoryHandle();
    if (dirHandle) {
      const fileHandle = await dirHandle.getFileHandle(`${job.title}.${job.ext}`, { create: true });
      writableStream = await fileHandle.createWritable();
    }
  } catch (_) {}

  if (!writableStream) {
    if ((window as any).showSaveFilePicker) {
      const pickerOptions = {
        suggestedName: `${job.title}.${job.ext}`,
        types: [{ description: "SRT Subtitle File", accept: { "text/plain": [".srt"] } }]
      };
      const fileHandle = await (window as any).showSaveFilePicker(pickerOptions);
      writableStream = await fileHandle.createWritable();
    }
  }

  if (!writableStream) throw new Error("Could not initialize destination file stream");
  job.writableStream = writableStream;

  let jsonUrl = job.url;
  if (jsonUrl.includes("fmt=")) {
    jsonUrl = jsonUrl.replace(/fmt=[^&]+/, "fmt=json3");
  } else {
    jsonUrl = `${jsonUrl}&fmt=json3`;
  }

  const res = await fetch(jsonUrl);
  if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
  const jsonCaptions = await res.json();

  const srtContent = jsonToWordSrt(jsonCaptions, job.trimRange);
  const encoded = new TextEncoder().encode(srtContent);

  await job.writableStream.write(encoded);
  await job.writableStream.close();

  job.status = "complete";
  job.percent = 100;
  job.downloadedBytes = encoded.byteLength;

  chrome.runtime.sendMessage({
    type: "TAB_DOWNLOAD_COMPLETE",
    id: job.id
  });

  refreshHistory();
  processQueue();
}
