import type { JobState } from "./types";
import { setupDestinationStream, type SaveMode } from "./streamSetup";
import { processSrtDownload } from "./srtProcessor";
import { processAdaptiveDownload } from "./adaptiveDownloader";
import { processSingleStreamDownload } from "./singleStreamDownloader";

export async function setupAndStartJob(
  job: JobState,
  setJobList: (jobs: JobState[]) => void,
  setDirPermission: (perm: string) => void,
  jobsRef: React.MutableRefObject<Map<string, JobState>>,
  chunkSizeRef: React.MutableRefObject<number>,
  concurrencyRef: React.MutableRefObject<number>,
  refreshHistory: () => void,
  processQueue: () => void,
  saveModeRef?: React.MutableRefObject<SaveMode>
): Promise<void> {
  job.status = "downloading";
  setJobList(Array.from(jobsRef.current.values()));

  const currentSaveMode = saveModeRef?.current || "directory";

  try {
    if (job.ext === "srt") {
      await processSrtDownload(job, refreshHistory, processQueue, currentSaveMode);
      return;
    }

    if (!job.url && job.videoId) {
      const info = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "GET_VIDEO_INFO", videoId: job.videoId }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error("Failed to communicate with background."));
          } else if (response && response.success) {
            resolve(response.info);
          } else {
            reject(new Error(response?.error || "Failed to fetch stream details."));
          }
        });
      });

      const format = info.formats?.find((f: any) => f.mimeType.includes("mp4"));
      const bestFormat = format || info.formats?.[0];
      if (!bestFormat) {
        throw new Error("No download link available for this video.");
      }

      job.url = bestFormat.url;
      job.totalSize = parseInt(bestFormat.contentLength || "0", 10);
      if (info.title) {
        job.title = info.title.replace(/[\\/:*?"<>|]/g, "_");
      }
    }

    const writableStream = await setupDestinationStream(job, setDirPermission, currentSaveMode);
    const fetchStreamSize = async (streamUrl: string): Promise<number> => {
      const sep = streamUrl.includes("?") ? "&" : "?";
      const headResponse = await fetch(`${streamUrl}${sep}ext_download=true`, { method: "HEAD" }).catch(() => null);
      const headSize = headResponse?.headers.get("content-length");
      if (headSize) return parseInt(headSize, 10);

      const rangeResponse = await fetch(`${streamUrl}${sep}range=0-0&ext_download=true`).catch(() => null);
      const rangeHeader = rangeResponse?.headers.get("content-range");
      if (rangeHeader) {
        return parseInt(rangeHeader.split("/")[1], 10);
      }
      return 0;
    };

    if (job.audioUrl && (!job.audioSize || job.audioSize === 0)) {
      job.audioSize = await fetchStreamSize(job.audioUrl);
    }

    let videoSize = job.audioUrl && job.audioSize ? Math.max(0, job.totalSize - job.audioSize) : job.totalSize;
    if (!videoSize) {
      videoSize = await fetchStreamSize(job.url);
    }

    if (!videoSize && !job.audioSize) {
      throw new Error("Unable to fetch media stream size from YouTube server.");
    }

    const finalTotalSize = videoSize + (job.audioSize || 0);
    job.totalSize = finalTotalSize;
    job.writableStream = writableStream;

    chrome.runtime.sendMessage({
      type: "TAB_DOWNLOAD_START",
      id: job.id,
      url: job.url,
      title: job.title,
      ext: job.ext,
      total: finalTotalSize
    });

    startJobDownload(
      job,
      chunkSizeRef.current,
      concurrencyRef.current,
      refreshHistory,
      processQueue
    );

  } catch (err: any) {
    console.error(err);
    job.status = "error";
    job.errorMessage = err.message || "Failed to set up destination file.";

    chrome.runtime.sendMessage({
      type: "TAB_DOWNLOAD_FAILED",
      id: job.id,
      error: job.errorMessage
    });

    processQueue();
  }
}

export function startJobDownload(
  job: JobState,
  currentChunkSize: number,
  currentConcurrency: number,
  refreshHistory: () => void,
  processQueue: () => void
): void {
  job.status = "downloading";
  job.startedTime = Date.now();
  job.speedHistory = [{ time: Date.now(), bytes: job.downloadedBytes }];

  if (job.audioUrl) {
    processAdaptiveDownload(job, currentChunkSize, currentConcurrency, refreshHistory, processQueue);
  } else {
    processSingleStreamDownload(job, currentChunkSize, currentConcurrency, refreshHistory, processQueue);
  }
}
