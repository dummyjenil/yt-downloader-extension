import { jsonToWordSrt } from "../../utils/subtitle";
import type { TrimRange } from "../../types/youtube";
import { fetchSidxByteRange } from "../../utils/sidx";

import type { JobState } from "./types";
import { runFFmpegMerge, mergeChunksToBuffer } from "./ffmpegMerge";
import {
  fetchChunkWithRetry,
  fetchAudioChunkWithRetry,
  downloadRangeInParallel
} from "./chunkDownloader";

export async function processAdaptiveDownload(
  job: JobState,
  currentChunkSize: number,
  currentConcurrency: number,
  refreshHistory: () => void,
  processQueue: () => void
): Promise<void> {
  if (!job.audioUrl) return;

  // 1. Try SIDX smart byte-range downloading if trimming is enabled
  if (job.trimRange && job.trimRange.enabled) {
    try {
      let vSidx = job.sidxVideoInfo;
      let aSidx = job.sidxAudioInfo;

      if (!vSidx || !aSidx) {
        const [vRes, aRes] = await Promise.all([
          fetchSidxByteRange(job.url, job.trimRange.startTimeSec, job.trimRange.endTimeSec, job.initRange, job.indexRange),
          fetchSidxByteRange(job.audioUrl, job.trimRange.startTimeSec, job.trimRange.endTimeSec, job.audioInitRange, job.audioIndexRange)
        ]);
        vSidx = vRes || undefined;
        aSidx = aRes || undefined;
        job.sidxVideoInfo = vSidx;
        job.sidxAudioInfo = aSidx;
      }

      if (vSidx && aSidx) {
        console.log("Using SIDX Smart Byte-Range Downloader for Adaptive Video + Audio");
        const vRangeSize = vSidx.rangeEnd - vSidx.rangeStart + 1;
        const aRangeSize = aSidx.rangeEnd - aSidx.rangeStart + 1;
        const sidxTotalPayload = vRangeSize + aRangeSize;
        job.totalSize = sidxTotalPayload;

        let sidxDownloaded = 0;
        const updateSidxProgress = (addedBytes: number) => {
          sidxDownloaded += addedBytes;
          job.downloadedBytes = sidxDownloaded;
          job.percent = Math.min(99, Math.round((sidxDownloaded / sidxTotalPayload) * 100));

          const now = Date.now();
          job.speedHistory.push({ time: now, bytes: sidxDownloaded });
          job.speedHistory = job.speedHistory.filter((h) => now - h.time < 4000);

          if (job.speedHistory.length > 1) {
            const first = job.speedHistory[0];
            const elapsed = (now - first.time) / 1000;
            job.speed = elapsed > 0 ? (sidxDownloaded - first.bytes) / elapsed : 0;
          }

          const remaining = sidxTotalPayload - sidxDownloaded;
          job.eta = job.speed > 0 ? remaining / job.speed : 0;

          chrome.runtime.sendMessage({
            type: "TAB_DOWNLOAD_PROGRESS",
            id: job.id,
            percent: job.percent,
            downloaded: sidxDownloaded,
            total: sidxTotalPayload,
            speed: job.speed,
            eta: job.eta
          });
        };

        const [vSubstream, aSubstream] = await Promise.all([
          downloadRangeInParallel(job.url, vSidx.rangeStart, vSidx.rangeEnd, currentChunkSize, currentConcurrency, job, updateSidxProgress),
          downloadRangeInParallel(job.audioUrl, aSidx.rangeStart, aSidx.rangeEnd, currentChunkSize, currentConcurrency, job, updateSidxProgress)
        ]);

        const videoBuf = new Uint8Array(vSidx.initBytes.byteLength + vSubstream.byteLength);
        videoBuf.set(vSidx.initBytes, 0);
        videoBuf.set(vSubstream, vSidx.initBytes.byteLength);

        const audioBuf = new Uint8Array(aSidx.initBytes.byteLength + aSubstream.byteLength);
        audioBuf.set(aSidx.initBytes, 0);
        audioBuf.set(aSubstream, aSidx.initBytes.byteLength);

        const vSeek = Math.max(0, job.trimRange.startTimeSec - vSidx.subsegmentStartSec);
        const aSeek = Math.max(0, job.trimRange.startTimeSec - aSidx.subsegmentStartSec);

        const sidxTrimRange: TrimRange = {
          ...job.trimRange,
          vSeek,
          aSeek
        };

        const subtitleBuffers: { name: string; code: string; data: Uint8Array }[] = [];
        if (job.selectedSubtitles && job.selectedSubtitles.length > 0) {
          for (let i = 0; i < job.selectedSubtitles.length; i++) {
            const track = job.selectedSubtitles[i];
            let jsonUrl = track.baseUrl.includes("fmt=") ? track.baseUrl.replace(/fmt=[^&]+/, "fmt=json3") : `${track.baseUrl}&fmt=json3`;
            try {
              const res = await fetch(jsonUrl);
              if (res.ok) {
                const jsonCaptions = await res.json();
                const srtContent = jsonToWordSrt(jsonCaptions, job.trimRange);
                subtitleBuffers.push({
                  name: `sub_${i}.srt`,
                  code: track.code || "eng",
                  data: new TextEncoder().encode(srtContent)
                });
              }
            } catch (err) {
              console.warn("Failed to fetch subtitle track:", err);
            }
          }
        }

        const mergedBuf = await runFFmpegMerge(
          videoBuf,
          audioBuf,
          job.ext,
          job.audioExt,
          sidxTrimRange,
          subtitleBuffers
        );

        await job.writableStream.write(mergedBuf);
        await job.writableStream.close();

        job.status = "complete";
        job.percent = 100;
        job.downloadedBytes = mergedBuf.byteLength;

        chrome.runtime.sendMessage({
          type: "TAB_DOWNLOAD_COMPLETE",
          id: job.id
        });

        refreshHistory();
        processQueue();
        return;
      }
    } catch (sidxErr) {
      console.warn("SIDX byte-range download failed, falling back to full stream trim:", sidxErr);
    }
  }

  // 2. Standard full stream adaptive fetching for video + audio
  const audioSize = job.audioSize || 0;
  let videoSize = job.totalSize;
  if (audioSize > 0 && job.totalSize > audioSize) {
    videoSize = job.totalSize - audioSize;
  }
  const totalSize = videoSize + audioSize;
  job.totalSize = totalSize;

  const totalVideoChunks = Math.ceil(videoSize / currentChunkSize);
  const totalAudioChunks = Math.ceil(audioSize / currentChunkSize);

  if (!job.adaptiveVideoChunks) job.adaptiveVideoChunks = new Map<number, ArrayBuffer>();
  if (!job.adaptiveAudioChunks) job.adaptiveAudioChunks = new Map<number, ArrayBuffer>();
  if (job.launchedVideoChunks === undefined) job.launchedVideoChunks = 0;
  if (job.launchedAudioChunks === undefined) job.launchedAudioChunks = 0;
  if (job.videoDownloadedBytes === undefined) job.videoDownloadedBytes = 0;
  if (job.audioDownloadedBytes === undefined) job.audioDownloadedBytes = 0;

  const updateProgress = () => {
    job.downloadedBytes = job.videoDownloadedBytes! + job.audioDownloadedBytes!;
    job.percent = Math.round((job.downloadedBytes / totalSize) * 100);

    const now = Date.now();
    job.speedHistory.push({ time: now, bytes: job.downloadedBytes });
    job.speedHistory = job.speedHistory.filter((h) => now - h.time < 4000);

    if (job.speedHistory.length > 1) {
      const first = job.speedHistory[0];
      const elapsed = (now - first.time) / 1000;
      job.speed = elapsed > 0 ? (job.downloadedBytes - first.bytes) / elapsed : 0;
    } else {
      const elapsed = (now - job.startedTime) / 1000;
      job.speed = elapsed > 0 ? job.downloadedBytes / elapsed : 0;
    }

    const remaining = totalSize - job.downloadedBytes;
    job.eta = job.speed > 0 ? remaining / job.speed : 0;

    chrome.runtime.sendMessage({
      type: "TAB_DOWNLOAD_PROGRESS",
      id: job.id,
      percent: job.percent,
      downloaded: job.downloadedBytes,
      total: totalSize,
      speed: job.speed,
      eta: job.eta
    });
  };

  const activeVideoFetches = new Set<number>();
  const downloadVideo = () => {
    return new Promise<void>((resolve, reject) => {
      const fetchNext = () => {
        if (job.paused || job.cancelled) {
          reject(new Error("Job paused or cancelled."));
          return;
        }
        if (job.adaptiveVideoChunks!.size === totalVideoChunks) {
          resolve();
          return;
        }

        while (activeVideoFetches.size < currentConcurrency && job.launchedVideoChunks! < totalVideoChunks) {
          const chunkIdx = job.launchedVideoChunks!++;
          activeVideoFetches.add(chunkIdx);

          fetchChunkWithRetry(job, chunkIdx, totalVideoChunks, currentChunkSize)
            .then((arrayBuffer) => {
              activeVideoFetches.delete(chunkIdx);
              if (!arrayBuffer) {
                if (!job.paused && !job.cancelled) {
                  reject(new Error(`Failed to download video chunk ${chunkIdx + 1}/${totalVideoChunks}`));
                }
                return;
              }
              job.adaptiveVideoChunks!.set(chunkIdx, arrayBuffer);
              job.videoDownloadedBytes! += arrayBuffer.byteLength;
              updateProgress();
              fetchNext();
            })
            .catch((err) => {
              activeVideoFetches.delete(chunkIdx);
              reject(err);
            });
        }
      };
      fetchNext();
    });
  };

  const activeAudioFetches = new Set<number>();
  const downloadAudio = () => {
    return new Promise<void>((resolve, reject) => {
      const fetchNext = () => {
        if (job.paused || job.cancelled) {
          reject(new Error("Job paused or cancelled."));
          return;
        }
        if (job.adaptiveAudioChunks!.size === totalAudioChunks) {
          resolve();
          return;
        }

        while (activeAudioFetches.size < currentConcurrency && job.launchedAudioChunks! < totalAudioChunks) {
          const chunkIdx = job.launchedAudioChunks!++;
          activeAudioFetches.add(chunkIdx);

          fetchAudioChunkWithRetry(job, chunkIdx, totalAudioChunks, currentChunkSize)
            .then((arrayBuffer) => {
              activeAudioFetches.delete(chunkIdx);
              if (!arrayBuffer) {
                if (!job.paused && !job.cancelled) {
                  reject(new Error(`Failed to download audio chunk ${chunkIdx + 1}/${totalAudioChunks}`));
                }
                return;
              }
              job.adaptiveAudioChunks!.set(chunkIdx, arrayBuffer);
              job.audioDownloadedBytes! += arrayBuffer.byteLength;
              updateProgress();
              fetchNext();
            })
            .catch((err) => {
              activeAudioFetches.delete(chunkIdx);
              reject(err);
            });
        }
      };
      fetchNext();
    });
  };

  try {
    await downloadVideo();
    await downloadAudio();

    chrome.runtime.sendMessage({
      type: "TAB_DOWNLOAD_PROGRESS",
      id: job.id,
      percent: 99,
      downloaded: totalSize,
      total: totalSize,
      speed: 0,
      eta: 0
    });

    const videoBuf = mergeChunksToBuffer(job.adaptiveVideoChunks!, totalVideoChunks);
    const audioBuf = mergeChunksToBuffer(job.adaptiveAudioChunks!, totalAudioChunks);

    const subtitleBuffers: { name: string; code: string; data: Uint8Array }[] = [];
    if (job.selectedSubtitles && job.selectedSubtitles.length > 0) {
      for (let i = 0; i < job.selectedSubtitles.length; i++) {
        const track = job.selectedSubtitles[i];
        let jsonUrl = track.baseUrl;
        if (jsonUrl.includes("fmt=")) {
          jsonUrl = jsonUrl.replace(/fmt=[^&]+/, "fmt=json3");
        } else {
          jsonUrl = `${jsonUrl}&fmt=json3`;
        }
        try {
          const res = await fetch(jsonUrl);
          if (res.ok) {
            const jsonCaptions = await res.json();
            const srtContent = jsonToWordSrt(jsonCaptions, job.trimRange);
            subtitleBuffers.push({
              name: `sub_${i}.srt`,
              code: track.code || "eng",
              data: new TextEncoder().encode(srtContent)
            });
          }
        } catch (err) {
          console.warn("Failed to fetch subtitle track for fusion:", err);
        }
      }
    }

    const mergedBuf = await runFFmpegMerge(
      videoBuf,
      audioBuf,
      job.ext,
      job.audioExt,
      job.trimRange,
      subtitleBuffers
    );

    await job.writableStream.write(mergedBuf);
    await job.writableStream.close();

    job.status = "complete";
    job.percent = 100;
    job.downloadedBytes = totalSize;

    chrome.runtime.sendMessage({
      type: "TAB_DOWNLOAD_COMPLETE",
      id: job.id
    });

    refreshHistory();
    processQueue();
  } catch (err: any) {
    console.error("Adaptive download/merge error:", err);
    if (job.paused || job.cancelled) return;
    job.status = "error";
    job.errorMessage = err.message || "Merge processing failed.";
    try {
      await job.writableStream.abort();
    } catch (_) {}
    chrome.runtime.sendMessage({
      type: "TAB_DOWNLOAD_FAILED",
      id: job.id,
      error: job.errorMessage
    });
    processQueue();
  }
}
