import { useEffect, useState, useRef } from "react";
import { getDirectoryHandle, storeDirectoryHandle, clearDirectoryHandle } from "../../utils/storage";
import { jsonToWordSrt } from "../../utils/subtitle";
import type { TrimRange, CaptionTrack } from "../../types/youtube";
import { fetchSidxByteRange } from "../../utils/sidx";

import type { JobState } from "./types";
import { runFFmpegMerge, mergeChunksToBuffer } from "./ffmpegMerge";
import {
  fetchChunkWithRetry,
  fetchAudioChunkWithRetry,
  downloadRangeInParallel
} from "./chunkDownloader";
import { processSrtDownload } from "./srtProcessor";

export type { JobState };

export function useDownloadManager() {
  const [jobList, setJobList] = useState<JobState[]>([]);
  const [chunkSize, setChunkSize] = useState<number>(5 * 1024 * 1024); // default 5MB
  const [concurrency, setConcurrency] = useState<number>(3); // default 3 parallel fetches
  const [maxConcurrentJobs, setMaxConcurrentJobs] = useState<number>(3); // default 3 parallel video downloads
  const [defaultDirName, setDefaultDirName] = useState<string | null>(null);
  const [dirPermission, setDirPermission] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);

  const jobsRef = useRef<Map<string, JobState>>(new Map());
  const chunkSizeRef = useRef(chunkSize);
  const concurrencyRef = useRef(concurrency);
  const maxConcurrentJobsRef = useRef(maxConcurrentJobs);

  // Sync refs to avoid stale closures in download loop
  useEffect(() => { chunkSizeRef.current = chunkSize; }, [chunkSize]);
  useEffect(() => { concurrencyRef.current = concurrency; }, [concurrency]);
  useEffect(() => { maxConcurrentJobsRef.current = maxConcurrentJobs; }, [maxConcurrentJobs]);

  // Load Settings and History on mount
  useEffect(() => {
    chrome.storage.local.get(["chunkSize", "concurrency", "maxConcurrentJobs", "downloadHistory"], (res) => {
      if (res.chunkSize) setChunkSize(res.chunkSize as number);
      if (res.concurrency) setConcurrency(res.concurrency as number);
      if (res.maxConcurrentJobs) setMaxConcurrentJobs(res.maxConcurrentJobs as number);
      if (res.downloadHistory) setHistoryList(res.downloadHistory as any[]);
    });

    getDirectoryHandle().then((handle) => {
      if (handle) {
        setDefaultDirName(handle.name);
        (handle as any).queryPermission({ mode: "readwrite" }).then((perm: string) => {
          setDirPermission(perm);
        }).catch(console.error);
      }
    }).catch(console.error);

    // Periodic UI sync (every 400ms) to ensure smooth 60fps rendering without react lag
    const uiInterval = setInterval(() => {
      setJobList(Array.from(jobsRef.current.values()));
    }, 400);

    return () => clearInterval(uiInterval);
  }, []);

  // Listen for background relay commands
  useEffect(() => {
    const messageListener = (message: any, sender: any, sendResponse: any) => {
      if (message.type === "PAUSE_DOWNLOAD") {
        pauseJob(message.id);
        sendResponse({ success: true });
      } else if (message.type === "RESUME_DOWNLOAD") {
        resumeJob(message.id);
        sendResponse({ success: true });
      } else if (message.type === "CANCEL_DOWNLOAD") {
        cancelJob(message.id);
        sendResponse({ success: true });
      } else if (message.type === "NEW_DOWNLOAD_JOB") {
        const { url, title, ext, contentLength, audioUrl, audioSize, audioExt, initRange, indexRange, audioInitRange, audioIndexRange, trimRange, selectedSubtitles } = message;
        addNewJob(
          url,
          title,
          ext,
          contentLength ? parseInt(contentLength, 10) : 0,
          audioUrl,
          audioSize ? parseInt(audioSize, 10) : undefined,
          audioExt,
          initRange,
          indexRange,
          audioInitRange,
          audioIndexRange,
          trimRange,
          selectedSubtitles
        );
        sendResponse({ success: true });
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  // Handle URL parameters on initial tab load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const url = urlParams.get("url") || "";
    const title = urlParams.get("title") || "video";
    const ext = urlParams.get("ext") || "mp4";
    const contentLengthStr = urlParams.get("contentLength") || "0";
    const totalSize = parseInt(contentLengthStr, 10);
    const audioUrl = urlParams.get("audioUrl") || undefined;
    const audioSizeStr = urlParams.get("audioSize") || "";
    const audioSize = audioSizeStr ? parseInt(audioSizeStr, 10) : undefined;
    const audioExt = urlParams.get("audioExt") || undefined;
    const trimStart = urlParams.get("trimStart");
    const trimEnd = urlParams.get("trimEnd");
    const trimRange = (trimStart && trimEnd) ? { enabled: true, startTimeSec: parseFloat(trimStart), endTimeSec: parseFloat(trimEnd) } : undefined;
    const subtitlesStr = urlParams.get("subtitles");
    let selectedSubtitles: CaptionTrack[] | undefined = undefined;
    if (subtitlesStr) {
      try {
        selectedSubtitles = JSON.parse(subtitlesStr);
      } catch (e) {
        console.warn("Failed to parse subtitles query parameter:", e);
      }
    }

    const initRangeStr = urlParams.get("initRange");
    const indexRangeStr = urlParams.get("indexRange");
    const audioInitRangeStr = urlParams.get("audioInitRange");
    const audioIndexRangeStr = urlParams.get("audioIndexRange");

    const initRange = initRangeStr ? JSON.parse(initRangeStr) : undefined;
    const indexRange = indexRangeStr ? JSON.parse(indexRangeStr) : undefined;
    const audioInitRange = audioInitRangeStr ? JSON.parse(audioInitRangeStr) : undefined;
    const audioIndexRange = audioIndexRangeStr ? JSON.parse(audioIndexRangeStr) : undefined;

    if (url) {
      setTimeout(() => {
        addNewJob(
          url,
          title,
          ext,
          totalSize,
          audioUrl,
          audioSize,
          audioExt,
          initRange,
          indexRange,
          audioInitRange,
          audioIndexRange,
          trimRange,
          selectedSubtitles
        );
      }, 300);
    }
  }, []);

  const requestDirPermission = async () => {
    try {
      const handle = await getDirectoryHandle();
      if (handle) {
        const perm = await (handle as any).requestPermission({ mode: "readwrite" });
        setDirPermission(perm);
        if (perm === "granted") {
          processQueue();
        }
      }
    } catch (err: any) {
      console.error("Failed to request directory permission:", err);
      alert("Failed to grant permission: " + err.message);
    }
  };

  const handleSelectDirectory = async () => {
    try {
      if (!(window as any).showDirectoryPicker) {
        alert("Your browser does not support directory picking. Please use Google Chrome.");
        return;
      }
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      await storeDirectoryHandle(handle);
      setDefaultDirName(handle.name);
      setDirPermission("granted");
    } catch (err: any) {
      console.error(err);
      alert("Failed to select directory: " + err.message);
    }
  };

  const handleClearDirectory = async () => {
    await clearDirectoryHandle();
    setDefaultDirName(null);
    setDirPermission(null);
  };

  const addNewJob = async (
    url: string,
    title: string,
    ext: string,
    totalSize: number,
    audioUrl?: string,
    audioSize?: number,
    audioExt?: string,
    initRange?: { start: string; end: string },
    indexRange?: { start: string; end: string },
    audioInitRange?: { start: string; end: string },
    audioIndexRange?: { start: string; end: string },
    trimRange?: TrimRange,
    selectedSubtitles?: CaptionTrack[]
  ) => {
    const cleanTitle = title.replace(/[\\/:*?"<>|]/g, "_");
    const jobId = `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const newJob: JobState = {
      id: jobId,
      url,
      title: cleanTitle,
      ext,
      totalSize: totalSize || 0,
      downloadedBytes: 0,
      percent: 0,
      speed: 0,
      eta: 9999,
      status: "idle",
      paused: false,
      cancelled: false,
      writableStream: null,
      nextChunkToWrite: 0,
      downloadedChunks: new Map(),
      activeFetches: new Set(),
      startedTime: Date.now(),
      speedHistory: [],
      launchedChunks: 0,
      audioUrl,
      audioSize,
      audioExt,
      initRange,
      indexRange,
      audioInitRange,
      audioIndexRange,
      trimRange,
      selectedSubtitles
    };

    jobsRef.current.set(jobId, newJob);
    setJobList(Array.from(jobsRef.current.values()));

    processQueue();
  };

  const processQueue = async () => {
    const jobs = Array.from(jobsRef.current.values());
    const downloadingCount = jobs.filter(j => j.status === "downloading").length;

    const limit = maxConcurrentJobsRef.current;
    if (downloadingCount < limit) {
      const nextJob = jobs.find(j => j.status === "idle" && !j.paused && !j.cancelled);
      if (nextJob) {
        startSetup(nextJob.id);
      }
    }
  };

  const startSetup = async (jobId: string) => {
    const job = jobsRef.current.get(jobId);
    if (!job) return;

    job.status = "downloading";
    setJobList(Array.from(jobsRef.current.values()));

    try {
      if (job.ext === "srt") {
        await processSrtDownload(job, refreshHistory, processQueue);
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

      let writableStream: any = null;

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
            const targetDirHandle = dirHandle;
            const fileHandle = await targetDirHandle.getFileHandle(`${job.title}.${job.ext}`, { create: true });
            writableStream = await fileHandle.createWritable();
          }
        }
      } catch (err) {
        console.warn("Failed to write to default folder, falling back to file picker", err);
      }

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

      let totalSize = job.totalSize;
      if (!totalSize) {
        const headResponse = await fetch(`${job.url}&ext_download=true`, { method: "HEAD" }).catch(() => null);
        const headSize = headResponse?.headers.get("content-length");
        if (headSize) {
          totalSize = parseInt(headSize, 10);
        } else {
          const rangeResponse = await fetch(`${job.url}&range=0-0&ext_download=true`);
          const rangeHeader = rangeResponse.headers.get("content-range");
          if (rangeHeader) {
            totalSize = parseInt(rangeHeader.split("/")[1], 10);
          }
        }
      }

      if (!totalSize) {
        throw new Error("Unable to fetch video size from YouTube server.");
      }

      job.totalSize = totalSize;
      job.writableStream = writableStream;

      const finalTotalSize = totalSize + (job.audioSize || 0);

      chrome.runtime.sendMessage({
        type: "TAB_DOWNLOAD_START",
        id: job.id,
        url: job.url,
        title: job.title,
        ext: job.ext,
        total: finalTotalSize
      });

      startJobDownload(job.id);

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
  };

  const startJobDownload = async (jobId: string) => {
    const job = jobsRef.current.get(jobId);
    if (!job) return;

    job.status = "downloading";
    job.startedTime = Date.now();
    job.speedHistory = [{ time: Date.now(), bytes: job.downloadedBytes }];

    const currentChunkSize = chunkSizeRef.current;
    const currentConcurrency = concurrencyRef.current;

    if (job.audioUrl) {
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
                let jsonUrl = track.baseUrl.includes('fmt=') ? track.baseUrl.replace(/fmt=[^&]+/, 'fmt=json3') : `${track.baseUrl}&fmt=json3`;
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

      const videoSize = job.totalSize;
      const audioSize = job.audioSize || 0;
      const totalSize = videoSize + audioSize;

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
            if (jsonUrl.includes('fmt=')) {
              jsonUrl = jsonUrl.replace(/fmt=[^&]+/, 'fmt=json3');
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
      return;
    }

    if (job.trimRange && job.trimRange.enabled) {
      try {
        let sidx = job.sidxVideoInfo;
        if (!sidx) {
          sidx = (await fetchSidxByteRange(job.url, job.trimRange.startTimeSec, job.trimRange.endTimeSec, job.initRange, job.indexRange)) || undefined;
          job.sidxVideoInfo = sidx;
        }

        if (sidx) {
          console.log("Using SIDX Smart Byte-Range Downloader for Single Stream");
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

            chrome.runtime.sendMessage({
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

          const fullBuf = new Uint8Array(sidx.initBytes.byteLength + substream.byteLength);
          fullBuf.set(sidx.initBytes, 0);
          fullBuf.set(substream, sidx.initBytes.byteLength);

          const vSeek = Math.max(0, job.trimRange.startTimeSec - sidx.subsegmentStartSec);
          const sidxTrimRange: TrimRange = {
            ...job.trimRange,
            vSeek
          };

          const trimmedBuf = await runFFmpegMerge(fullBuf, null, job.ext, undefined, sidxTrimRange);

          await job.writableStream.write(trimmedBuf);
          await job.writableStream.close();

          job.status = "complete";
          job.percent = 100;
          job.downloadedBytes = trimmedBuf.byteLength;

          chrome.runtime.sendMessage({
            type: "TAB_DOWNLOAD_COMPLETE",
            id: job.id
          });

          refreshHistory();
          processQueue();
          return;
        }
      } catch (sidxErr) {
        console.warn("SIDX single-stream byte-range download failed, falling back to full stream trim:", sidxErr);
      }
    }

    const totalChunks = Math.ceil(job.totalSize / currentChunkSize);
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

            if (job.trimRange && job.trimRange.enabled) {
              job.downloadedBytes = 0;
              for (let i = 0; i < totalChunks; i++) {
                const c = job.downloadedChunks.get(i);
                if (c) job.downloadedBytes += c.byteLength;
              }
              job.percent = Math.round((job.downloadedBytes / job.totalSize) * 100);

              chrome.runtime.sendMessage({
                type: "TAB_DOWNLOAD_PROGRESS",
                id: job.id,
                percent: job.percent,
                downloaded: job.downloadedBytes,
                total: job.totalSize,
                speed: job.speed,
                eta: job.eta
              });

              if (job.downloadedChunks.size === totalChunks && job.status === "downloading") {
                const fullBuf = mergeChunksToBuffer(job.downloadedChunks, totalChunks);
                const trimmedBuf = await runFFmpegMerge(fullBuf, null, job.ext, undefined, job.trimRange);

                await job.writableStream.write(trimmedBuf);
                await job.writableStream.close();

                job.status = "complete";
                job.percent = 100;
                job.downloadedBytes = trimmedBuf.byteLength;

                chrome.runtime.sendMessage({
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

            await writeSequentialChunks(job, currentChunkSize);

            if (job.nextChunkToWrite >= totalChunks && job.status === "downloading") {
              job.status = "complete";
              job.percent = 100;
              job.downloadedBytes = job.totalSize;

              try {
                await job.writableStream.close();
              } catch (err) {
                console.warn("Failed to close writable stream:", err);
              }

              chrome.runtime.sendMessage({
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

            chrome.runtime.sendMessage({
              type: "TAB_DOWNLOAD_FAILED",
              id: job.id,
              error: job.errorMessage
            });

            processQueue();
          });
      }
    };

    downloadLoop();
  };

  const writeSequentialChunks = async (job: JobState, size: number) => {
    while (job.downloadedChunks.has(job.nextChunkToWrite)) {
      if (job.cancelled) break;

      const idx = job.nextChunkToWrite;
      const buffer = job.downloadedChunks.get(idx)!;

      await job.writableStream.write(buffer);

      job.downloadedBytes += buffer.byteLength;
      job.percent = Math.round((job.downloadedBytes / job.totalSize) * 100);

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

      const remaining = job.totalSize - job.downloadedBytes;
      job.eta = job.speed > 0 ? remaining / job.speed : 0;

      job.downloadedChunks.delete(idx);
      job.nextChunkToWrite++;

      chrome.runtime.sendMessage({
        type: "TAB_DOWNLOAD_PROGRESS",
        id: job.id,
        percent: job.percent,
        downloaded: job.downloadedBytes,
        total: job.totalSize,
        speed: job.speed,
        eta: job.eta
      });
    }
  };

  const pauseJob = (jobId: string) => {
    const job = jobsRef.current.get(jobId);
    if (job && job.status === "downloading") {
      job.paused = true;
      job.status = "paused";
      chrome.runtime.sendMessage({ type: "TAB_DOWNLOAD_PAUSE_STATE", id: jobId, isPaused: true });

      processQueue();
    }
  };

  const resumeJob = (jobId: string) => {
    const job = jobsRef.current.get(jobId);
    if (job && job.status === "paused") {
      job.paused = false;
      job.status = "downloading";
      job.startedTime = Date.now();
      job.speedHistory = [{ time: Date.now(), bytes: job.downloadedBytes }];
      chrome.runtime.sendMessage({ type: "TAB_DOWNLOAD_PAUSE_STATE", id: jobId, isPaused: false });
      startJobDownload(jobId);
    }
  };

  const cancelJob = async (jobId: string) => {
    const job = jobsRef.current.get(jobId);
    if (job) {
      job.cancelled = true;
      try {
        await job.writableStream.abort();
      } catch (_) { }
      chrome.runtime.sendMessage({ type: "TAB_DOWNLOAD_CANCELLED", id: jobId });
      jobsRef.current.delete(jobId);
      setJobList(Array.from(jobsRef.current.values()));

      processQueue();
    }
  };

  const refreshHistory = () => {
    chrome.storage.local.get(["downloadHistory"], (res) => {
      if (res.downloadHistory) setHistoryList(res.downloadHistory as any[]);
    });
  };

  const clearHistory = () => {
    chrome.storage.local.set({ downloadHistory: [] }, () => {
      setHistoryList([]);
    });
  };

  const updateSetting = (key: "chunkSize" | "concurrency" | "maxConcurrentJobs", val: number) => {
    if (key === "chunkSize") {
      setChunkSize(val);
    } else if (key === "concurrency") {
      setConcurrency(val);
    } else if (key === "maxConcurrentJobs") {
      setMaxConcurrentJobs(val);
    }
    chrome.storage.local.set({ [key]: val });
  };

  const clearJob = (jobId: string) => {
    jobsRef.current.delete(jobId);
    setJobList(Array.from(jobsRef.current.values()));
    chrome.runtime.sendMessage({ type: "CLEAR_DOWNLOAD", id: jobId });
  };

  return {
    jobList,
    chunkSize,
    concurrency,
    maxConcurrentJobs,
    defaultDirName,
    dirPermission,
    historyList,
    clearJob,
    requestDirPermission,
    handleSelectDirectory,
    handleClearDirectory,
    startSetup,
    pauseJob,
    resumeJob,
    cancelJob,
    clearHistory,
    updateSetting
  };
}
