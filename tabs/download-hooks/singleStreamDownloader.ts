import type { TrimRange } from "../../types/youtube";
import { fetchSidxByteRange } from "../../utils/sidx";
import { fetchSubtitleBuffers } from "../../utils/subtitle";
import { getJobAuxiliaryData } from "../../utils/downloadHelpers";

import type { JobState } from "./types";
import { runFFmpegMerge, mergeChunksToBuffer } from "./ffmpegMerge";
import { fetchChunkWithRetry, downloadRangeInParallel } from "./chunkDownloader";

function safeSendMessage(message: any) {
  try {
    if (typeof chrome !== "undefined" && chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage(message).catch(() => {});
    }
  } catch (_) {}
}

export async function processSingleStreamDownload(
  job: JobState,
  currentChunkSize: number,
  currentConcurrency: number,
  refreshHistory: () => void,
  processQueue: () => void
): Promise<void> {
  console.log("🚀 [processSingleStreamDownload START]", {
    id: job.id,
    title: job.title,
    ext: job.ext,
    trimRange: job.trimRange,
    initRange: job.initRange,
    indexRange: job.indexRange,
    totalSize: job.totalSize
  });

  // 1. SIDX Smart byte-range trimming for single stream
  if (job.trimRange && job.trimRange.enabled) {
    try {
      let sidx = job.sidxVideoInfo;
      if (!sidx) {
        sidx = (await fetchSidxByteRange(job.url, job.trimRange.startTimeSec, job.trimRange.endTimeSec, job.initRange, job.indexRange)) || undefined;
        job.sidxVideoInfo = sidx;
      }

      if (sidx) {
        console.log("🔥 [processSingleStreamDownload SIDX MATCH SUCCESS]", {
          range: `${sidx.rangeStart}-${sidx.rangeEnd}`,
          subsegmentStartSec: sidx.subsegmentStartSec
        });

        const rangeSize = sidx.rangeEnd - sidx.rangeStart + 1;
        let sidxDownloaded = 0;

        const updateSidxProgress = (addedBytes: number) => {
          sidxDownloaded += addedBytes;
          job.downloadedBytes = sidxDownloaded;
          job.percent = Math.min(99, Math.round((sidxDownloaded / rangeSize) * 100));

          const now = Date.now();
          job.speedHistory.push({ time: now, bytes: sidxDownloaded });
          job.speedHistory = job.speedHistory.filter((h) => now - h.time < 4000);

          if (job.speedHistory.length > 1) {
            const first = job.speedHistory[0];
            const elapsed = (now - first.time) / 1000;
            job.speed = elapsed > 0 ? (sidxDownloaded - first.bytes) / elapsed : 0;
          }

          const remaining = rangeSize - sidxDownloaded;
          job.eta = job.speed > 0 ? remaining / job.speed : 0;

          safeSendMessage({
            type: "TAB_DOWNLOAD_PROGRESS",
            id: job.id,
            percent: job.percent,
            downloaded: sidxDownloaded,
            total: rangeSize,
            speed: job.speed,
            eta: job.eta
          });
        };

        const substream = await downloadRangeInParallel(
          job.url,
          sidx.rangeStart,
          sidx.rangeEnd,
          currentChunkSize,
          currentConcurrency,
          job,
          updateSidxProgress
        );

        console.log("📦 [processSingleStreamDownload Substream Downloaded]", {
          substreamBytes: substream.byteLength,
          initBytes: sidx.initBytes.byteLength
        });

        const fullBuf = new Uint8Array(sidx.initBytes.byteLength + substream.byteLength);
        fullBuf.set(sidx.initBytes, 0);
        fullBuf.set(substream, sidx.initBytes.byteLength);

        const vSeek = Math.max(0, job.trimRange.startTimeSec - sidx.subsegmentStartSec);
        const sidxTrimRange: TrimRange = {
          ...job.trimRange,
          vSeek
        };

        console.log("🎬 [processSingleStreamDownload Calling runFFmpegMerge]", {
          fullBufLength: fullBuf.byteLength,
          sidxTrimRange
        });

        const subtitleBuffers = await fetchSubtitleBuffers(job.selectedSubtitles, sidxTrimRange);
        const aux = await getJobAuxiliaryData(job);
        const trimmedBuf = await runFFmpegMerge(fullBuf, null, job.ext, undefined, sidxTrimRange, subtitleBuffers, aux.thumbnailBuffer, aux.chapterMetadata, aux.metadataInfo);

        console.log("💾 [processSingleStreamDownload Writing output to disk]", {
          trimmedBufLength: trimmedBuf.byteLength
        });

        await job.writableStream.write(trimmedBuf);
        await job.writableStream.close();

        job.status = "complete";
        job.percent = 100;
        job.downloadedBytes = trimmedBuf.byteLength;

        console.log("🎉 [processSingleStreamDownload COMPLETE]", { savedSize: trimmedBuf.byteLength });

        safeSendMessage({
          type: "TAB_DOWNLOAD_COMPLETE",
          id: job.id
        });

        refreshHistory();
        processQueue();
        return;
      } else {
        console.warn("⚠️ [processSingleStreamDownload SIDX MATCH FAILED] Falling back to full stream trim...");
      }
    } catch (sidxErr) {
      console.warn("⚠️ [processSingleStreamDownload SIDX ERROR] Falling back to full stream trim:", sidxErr);
    }
  }

  // 2. Standard progressive chunk downloading & sequential writing
  console.log("📦 [processSingleStreamDownload SECTION 2] Full stream download fallback...");
  const totalChunks = Math.ceil(job.totalSize / currentChunkSize);

  const writeSequentialChunks = async (j: JobState) => {
    while (j.downloadedChunks.has(j.nextChunkToWrite)) {
      if (j.cancelled) break;

      const idx = j.nextChunkToWrite;
      const buffer = j.downloadedChunks.get(idx)!;

      await j.writableStream.write(buffer);

      j.downloadedBytes += buffer.byteLength;
      j.percent = Math.round((j.downloadedBytes / j.totalSize) * 100);

      const now = Date.now();
      j.speedHistory.push({ time: now, bytes: j.downloadedBytes });
      j.speedHistory = j.speedHistory.filter((h) => now - h.time < 4000);

      if (j.speedHistory.length > 1) {
        const first = j.speedHistory[0];
        const elapsed = (now - first.time) / 1000;
        j.speed = elapsed > 0 ? (j.downloadedBytes - first.bytes) / elapsed : 0;
      } else {
        const elapsed = (now - j.startedTime) / 1000;
        j.speed = elapsed > 0 ? j.downloadedBytes / elapsed : 0;
      }

      const remaining = j.totalSize - j.downloadedBytes;
      j.eta = j.speed > 0 ? remaining / j.speed : 0;

      j.downloadedChunks.delete(idx);
      j.nextChunkToWrite++;

      safeSendMessage({
        type: "TAB_DOWNLOAD_PROGRESS",
        id: j.id,
        percent: j.percent,
        downloaded: j.downloadedBytes,
        total: j.totalSize,
        speed: j.speed,
        eta: j.eta
      });
    }
  };

  const downloadLoop = async () => {
    if (job.paused || job.cancelled || job.status === "error" || job.status === "complete") {
      return;
    }

    while (job.activeFetches.size < currentConcurrency && job.launchedChunks < totalChunks) {
      const chunkIdx = job.launchedChunks++;
      job.activeFetches.add(chunkIdx);

      fetchChunkWithRetry(job, chunkIdx, totalChunks, currentChunkSize)
        .then(async (arrayBuffer) => {
          job.activeFetches.delete(chunkIdx);
          if (!arrayBuffer) {
            if (job.launchedChunks < totalChunks) downloadLoop();
            return;
          }

          job.downloadedChunks.set(chunkIdx, arrayBuffer);

          const requiresPostProcessing = Boolean(
            (job.trimRange && job.trimRange.enabled) ||
            (job.selectedSubtitles && job.selectedSubtitles.length > 0) ||
            job.embedThumbnail !== false ||
            job.embedChapters !== false
          );

          if (requiresPostProcessing) {
            job.downloadedBytes = 0;
            for (let i = 0; i < totalChunks; i++) {
              const c = job.downloadedChunks.get(i);
              if (c) job.downloadedBytes += c.byteLength;
            }
            job.percent = Math.round((job.downloadedBytes / job.totalSize) * 100);

            safeSendMessage({
              type: "TAB_DOWNLOAD_PROGRESS",
              id: job.id,
              percent: job.percent,
              downloaded: job.downloadedBytes,
              total: job.totalSize,
              speed: job.speed,
              eta: job.eta
            });

            if (job.downloadedChunks.size === totalChunks && job.status === "downloading") {
              job.status = "processing" as any;
              const fullBuf = mergeChunksToBuffer(job.downloadedChunks, totalChunks);
              job.downloadedChunks.clear();
              const subtitleBuffers = await fetchSubtitleBuffers(job.selectedSubtitles, job.trimRange);
              const aux = await getJobAuxiliaryData(job);
              const trimmedBuf = await runFFmpegMerge(
                fullBuf,
                null,
                job.ext,
                undefined,
                job.trimRange,
                subtitleBuffers,
                aux.thumbnailBuffer,
                aux.chapterMetadata,
                aux.metadataInfo
              );

              await job.writableStream.write(trimmedBuf);
              await job.writableStream.close();

              job.status = "complete";
              job.percent = 100;
              job.downloadedBytes = trimmedBuf.byteLength;

              safeSendMessage({
                type: "TAB_DOWNLOAD_COMPLETE",
                id: job.id
              });

              refreshHistory();
              processQueue();
            } else if (job.launchedChunks < totalChunks) {
              downloadLoop();
            }
            return;
          }

          await writeSequentialChunks(job);

          if (job.nextChunkToWrite >= totalChunks && job.status === "downloading") {
            job.status = "complete";
            job.percent = 100;
            job.downloadedBytes = job.totalSize;

            try {
              await job.writableStream.close();
            } catch (err) {
              console.warn("Failed to close writable stream:", err);
            }

            safeSendMessage({
              type: "TAB_DOWNLOAD_COMPLETE",
              id: job.id
            });

            refreshHistory();
            processQueue();
          } else if (job.nextChunkToWrite < totalChunks) {
            downloadLoop();
          }
        })
        .catch(async (err) => {
          console.error("Chunk fetch failed completely:", err);
          job.status = "error";
          job.errorMessage = err.message || "Network error";
          try { await job.writableStream.abort(); } catch (_) { }

          safeSendMessage({
            type: "TAB_DOWNLOAD_FAILED",
            id: job.id,
            error: job.errorMessage
          });

          processQueue();
        });
    }
  };

  downloadLoop();
}
