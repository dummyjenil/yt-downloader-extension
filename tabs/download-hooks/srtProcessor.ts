import { setupDestinationStream, type SaveMode } from "./streamSetup";
import { jsonToWordSrt } from "../../utils/subtitle";
import type { JobState } from "./types";

export async function processSrtDownload(
  job: JobState,
  refreshHistory: () => void,
  processQueue: () => void,
  saveMode: SaveMode = "directory"
): Promise<void> {
  const writableStream = await setupDestinationStream(job, undefined, saveMode);
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
