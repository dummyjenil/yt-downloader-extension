import React, { useEffect, useState, useRef } from "react";
import { formatBytes, formatTime } from "../utils/youtube";
import { getDirectoryHandle, storeDirectoryHandle, clearDirectoryHandle } from "../utils/storage";

interface JobState {
  id: string;
  url: string;
  title: string;
  ext: string;
  totalSize: number;
  downloadedBytes: number;
  percent: number;
  speed: number;
  eta: number;
  status: "idle" | "downloading" | "paused" | "complete" | "error";
  errorMessage?: string;
  paused: boolean;
  cancelled: boolean;
  writableStream: any;
  nextChunkToWrite: number;
  downloadedChunks: Map<number, ArrayBuffer>;
  activeFetches: Set<number>;
  startedTime: number;
  speedHistory: { time: number; bytes: number }[];
  launchedChunks: number;
}

export default function DownloadPage() {
  const [jobList, setJobList] = useState<JobState[]>([]);
  const [chunkSize, setChunkSize] = useState<number>(5 * 1024 * 1024); // default 5MB
  const [concurrency, setConcurrency] = useState<number>(3); // default 3 parallel fetches
  const [defaultDirName, setDefaultDirName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"downloads" | "settings" | "history">("downloads");
  const [historyList, setHistoryList] = useState<any[]>([]);

  const jobsRef = useRef<Map<string, JobState>>(new Map());
  const chunkSizeRef = useRef(chunkSize);
  const concurrencyRef = useRef(concurrency);

  // Sync refs to avoid stale closures in download loop
  useEffect(() => { chunkSizeRef.current = chunkSize; }, [chunkSize]);
  useEffect(() => { concurrencyRef.current = concurrency; }, [concurrency]);

  // Load Settings and History on mount
  useEffect(() => {
    chrome.storage.local.get(["chunkSize", "concurrency", "downloadHistory"], (res) => {
      if (res.chunkSize) setChunkSize(res.chunkSize);
      if (res.concurrency) setConcurrency(res.concurrency);
      if (res.downloadHistory) setHistoryList(res.downloadHistory);
    });

    getDirectoryHandle().then((handle) => {
      if (handle) setDefaultDirName(handle.name);
    }).catch(console.error);

    // Periodic UI sync (every 400ms) to ensure smooth 60fps rendering without react lag
    const uiInterval = setInterval(() => {
      setJobList(Array.from(jobsRef.current.values()));
    }, 400);

    return () => clearInterval(uiInterval);
  }, []);

  // Listen for background relay commands (e.g. Pause, Resume, Cancel from popup/content scripts)
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
        const { url, title, ext, contentLength } = message;
        addNewJob(url, title, ext, contentLength ? parseInt(contentLength, 10) : 0);
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

    if (url) {
      // Small timeout to allow everything to mount
      setTimeout(() => {
        addNewJob(url, title, ext, totalSize);
      }, 300);
    }
  }, []);

  // Set default directory handle
  const handleSelectDirectory = async () => {
    try {
      if (!(window as any).showDirectoryPicker) {
        alert("Your browser does not support directory picking. Please use Google Chrome.");
        return;
      }
      const handle = await (window as any).showDirectoryPicker({
        mode: "readwrite"
      });
      await storeDirectoryHandle(handle);
      setDefaultDirName(handle.name);
    } catch (err: any) {
      console.error(err);
      alert("Failed to select directory: " + err.message);
    }
  };

  const handleClearDirectory = async () => {
    await clearDirectoryHandle();
    setDefaultDirName(null);
  };

  // Add a new download job
  const addNewJob = async (url: string, title: string, ext: string, totalSize: number) => {
    const cleanTitle = title.replace(/[\\/:*?"<>|]/g, "_");
    const jobId = `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    let canAutoStart = false;
    try {
      const dirHandle = await getDirectoryHandle();
      if (dirHandle) {
        const verifyOpts = { mode: "readwrite" };
        const perm = await (dirHandle as any).queryPermission(verifyOpts);
        if (perm === "granted") {
          canAutoStart = true;
        }
      }
    } catch (e) {
      console.warn("Failed to check directory handle permission on load", e);
    }

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
      status: canAutoStart ? "downloading" : "idle",
      paused: false,
      cancelled: false,
      writableStream: null,
      nextChunkToWrite: 0,
      downloadedChunks: new Map(),
      activeFetches: new Set(),
      startedTime: Date.now(),
      speedHistory: [],
      launchedChunks: 0
    };

    jobsRef.current.set(jobId, newJob);
    setJobList(Array.from(jobsRef.current.values()));

    // Automatically trigger start setup if permission is already granted
    if (canAutoStart) {
      startSetup(jobId);
    }
  };

  // Setup file stream (prompt or default folder) and start downloading
  const startSetup = async (jobId: string) => {
    const job = jobsRef.current.get(jobId);
    if (!job) return;

    // Set to downloading immediately to give instant feedback
    job.status = "downloading";
    setJobList(Array.from(jobsRef.current.values()));

    try {
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
            const fileHandle = await dirHandle.getFileHandle(`${job.title}.${job.ext}`, { create: true });
            writableStream = await fileHandle.createWritable();
          }
        }
      } catch (err) {
        console.warn("Failed to write to default folder, falling back to file picker", err);
      }

      // 2. Fallback to manual save file picker
      if (!writableStream) {
        if (!(window as any).showSaveFilePicker) {
          throw new Error("Your browser does not support standard file streaming. Please use Chrome.");
        }
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
      }

      // 3. Get total size if missing
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
      
      // Notify background and launch download loops
      chrome.runtime.sendMessage({
        type: "TAB_DOWNLOAD_START",
        id: job.id,
        url: job.url,
        title: job.title,
        ext: job.ext,
        total: totalSize
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
    }
  };

  // Parallel download loop
  const startJobDownload = async (jobId: string) => {
    const job = jobsRef.current.get(jobId);
    if (!job) return;

    job.status = "downloading";
    job.startedTime = Date.now();
    job.speedHistory = [{ time: Date.now(), bytes: job.downloadedBytes }];

    const currentChunkSize = chunkSizeRef.current;
    const currentConcurrency = concurrencyRef.current;
    const totalChunks = Math.ceil(job.totalSize / currentChunkSize);

    const downloadLoop = async () => {
      if (job.paused || job.cancelled || job.status === "error" || job.status === "complete") {
        return;
      }

      // Launch up to concurrency limit
      while (job.activeFetches.size < currentConcurrency && job.launchedChunks < totalChunks) {
        const chunkIdx = job.launchedChunks++;
        job.activeFetches.add(chunkIdx);

        fetchChunkWithRetry(job, chunkIdx, totalChunks, currentChunkSize)
          .then(async (arrayBuffer) => {
            if (!arrayBuffer) return; // paused/cancelled

            job.downloadedChunks.set(chunkIdx, arrayBuffer);
            job.activeFetches.delete(chunkIdx);

            // Write all available sequential chunks
            await writeSequentialChunks(job, currentChunkSize);

            // Check completion
            if (job.nextChunkToWrite >= totalChunks) {
              await job.writableStream.close();
              job.status = "complete";
              job.percent = 100;
              job.downloadedBytes = job.totalSize;
              
              chrome.runtime.sendMessage({
                type: "TAB_DOWNLOAD_COMPLETE",
                id: job.id
              });
              
              // Update local history
              refreshHistory();
            } else {
              // Trigger next worker loop
              downloadLoop();
            }
          })
          .catch(async (err) => {
            console.error("Chunk fetch failed completely:", err);
            job.status = "error";
            job.errorMessage = err.message || "Network error";
            try { await job.writableStream.abort(); } catch (_) {}

            chrome.runtime.sendMessage({
              type: "TAB_DOWNLOAD_FAILED",
              id: job.id,
              error: job.errorMessage
            });
          });
      }
    };

    downloadLoop();
  };

  const fetchChunkWithRetry = async (job: JobState, chunkIdx: number, totalChunks: number, size: number): Promise<ArrayBuffer | null> => {
    const start = chunkIdx * size;
    const end = Math.min((chunkIdx + 1) * size, job.totalSize) - 1;
    const chunkUrl = `${job.url}&range=${start}-${end}&ext_download=true`;

    let attempt = 0;
    const maxAttempts = 5;

    while (attempt < maxAttempts) {
      if (job.paused || job.cancelled) return null;

      try {
        const response = await fetch(chunkUrl);
        if (!response.ok) throw new Error(`HTTP Status ${response.status}`);
        return await response.arrayBuffer();
      } catch (err) {
        attempt++;
        if (attempt >= maxAttempts) throw err;
        const delay = 500 * Math.pow(2, attempt - 1); // exponential backoff
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    return null;
  };

  const writeSequentialChunks = async (job: JobState, size: number) => {
    while (job.downloadedChunks.has(job.nextChunkToWrite)) {
      if (job.cancelled) break;

      const idx = job.nextChunkToWrite;
      const buffer = job.downloadedChunks.get(idx)!;

      await job.writableStream.write(buffer);

      job.downloadedBytes += buffer.byteLength;
      job.percent = Math.round((job.downloadedBytes / job.totalSize) * 100);

      // Speed & ETA calculations
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

      // Progress message to background
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

  // Job operations
  const pauseJob = (jobId: string) => {
    const job = jobsRef.current.get(jobId);
    if (job && job.status === "downloading") {
      job.paused = true;
      job.status = "paused";
      chrome.runtime.sendMessage({ type: "TAB_DOWNLOAD_PAUSE_STATE", id: jobId, isPaused: true });
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
      } catch (_) {}
      chrome.runtime.sendMessage({ type: "TAB_DOWNLOAD_CANCELLED", id: jobId });
      jobsRef.current.delete(jobId);
      setJobList(Array.from(jobsRef.current.values()));
    }
  };

  const refreshHistory = () => {
    chrome.storage.local.get(["downloadHistory"], (res) => {
      if (res.downloadHistory) setHistoryList(res.downloadHistory);
    });
  };

  const clearHistory = () => {
    chrome.storage.local.set({ downloadHistory: [] }, () => {
      setHistoryList([]);
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        fontFamily: "'Outfit', 'Inter', sans-serif",
        background: "linear-gradient(135deg, #09090b 0%, #121217 100%)",
        color: "#f4f4f5",
        margin: 0,
        padding: "0"
      }}
    >
      {/* Premium Navigation Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 40px",
          background: "rgba(255, 255, 255, 0.02)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.07)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 100
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#f43f5e",
              boxShadow: "0 0 12px #f43f5e"
            }}
          ></div>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 800,
              background: "linear-gradient(135deg, #f43f5e 0%, #a78bfa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.5px"
            }}
          >
            YTD Premium Dashboard
          </span>
        </div>

        <nav style={{ display: "flex", gap: "8px" }}>
          {[
            { id: "downloads", label: "Active Downloads" },
            { id: "settings", label: "Settings" },
            { id: "history", label: "History" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: activeTab === tab.id ? "rgba(139, 92, 246, 0.15)" : "transparent",
                border: activeTab === tab.id ? "1px solid rgba(139, 92, 246, 0.3)" : "1px solid transparent",
                color: activeTab === tab.id ? "#c084fc" : "#a1a1aa",
                padding: "8px 16px",
                borderRadius: "12px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          maxWidth: "800px",
          width: "100%",
          margin: "40px auto",
          padding: "0 20px",
          boxSizing: "border-box"
        }}
      >
        {activeTab === "downloads" && (
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "20px" }}>Active Downloads</h2>
            {jobList.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px dashed rgba(255, 255, 255, 0.08)",
                  borderRadius: "24px",
                  color: "#71717a"
                }}
              >
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  style={{ marginBottom: "16px", opacity: 0.4 }}
                >
                  <path d="M12 15V3m0 12l-4-4m4 4l4-4M5 20h14" />
                </svg>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: 500 }}>No active downloads running</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px" }}>Start downloading from a YouTube page to see progress here</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {jobList.map((job) => (
                  <div
                    key={job.id}
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.07)",
                      borderRadius: "20px",
                      padding: "20px",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "12px" }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#f4f4f5", lineHeight: 1.4 }}>
                          {job.title}.{job.ext}
                        </h4>
                        <span style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "4px", display: "inline-block" }}>
                          Total Size: {job.totalSize > 0 ? formatBytes(job.totalSize) : "Calculating..."}
                        </span>
                      </div>

                      {/* Controls */}
                      <div style={{ display: "flex", gap: "8px" }}>
                        {job.status === "idle" && (
                          <button
                            onClick={() => startSetup(job.id)}
                            style={{
                              background: "rgba(16, 185, 129, 0.15)",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                              color: "#34d399",
                              padding: "0 10px",
                              borderRadius: "10px",
                              fontSize: "11px",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              height: "32px"
                            }}
                            title="Start Download"
                          >
                            Start
                          </button>
                        )}
                        {job.status === "downloading" && (
                          <button
                            onClick={() => pauseJob(job.id)}
                            style={{
                              background: "rgba(255, 255, 255, 0.05)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              color: "#f4f4f5",
                              width: "32px",
                              height: "32px",
                              borderRadius: "10px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                            title="Pause"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <rect x="4" y="4" width="4" height="16" />
                              <rect x="16" y="4" width="4" height="16" />
                            </svg>
                          </button>
                        )}
                        {job.status === "paused" && (
                          <button
                            onClick={() => resumeJob(job.id)}
                            style={{
                              background: "rgba(139, 92, 246, 0.2)",
                              border: "1px solid rgba(139, 92, 246, 0.3)",
                              color: "#c084fc",
                              width: "32px",
                              height: "32px",
                              borderRadius: "10px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                            title="Resume"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => cancelJob(job.id)}
                          style={{
                            background: "rgba(244, 63, 94, 0.1)",
                            border: "1px solid rgba(244, 63, 94, 0.2)",
                            color: "#fda4af",
                            width: "32px",
                            height: "32px",
                            borderRadius: "10px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                          title="Cancel"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Progress details */}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#a1a1aa", marginBottom: "6px" }}>
                      <span>
                        {job.status === "paused"
                          ? "Paused"
                          : job.status === "error"
                          ? `Error: ${job.errorMessage}`
                          : job.status === "idle"
                          ? "Waiting to start..."
                          : `Downloading (${formatBytes(job.downloadedBytes)} / ${formatBytes(job.totalSize)})`}
                      </span>
                      <span style={{ fontWeight: 700, color: job.status === "paused" ? "#fbbf24" : job.status === "idle" ? "#60a5fa" : "#a78bfa" }}>
                        {job.percent}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: "100%", height: "6px", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "10px", overflow: "hidden", marginBottom: "12px" }}>
                      <div
                        style={{
                          width: `${job.percent}%`,
                          height: "100%",
                          background: job.status === "paused" 
                            ? "#fbbf24" 
                            : job.status === "idle"
                            ? "#3b82f6"
                            : job.status === "error" 
                            ? "#f43f5e" 
                            : "linear-gradient(90deg, #f43f5e 0%, #8b5cf6 100%)",
                          borderRadius: "10px",
                          transition: "width 0.3s ease"
                        }}
                      ></div>
                    </div>

                    {/* Meta stats: speed and ETA */}
                    {job.status === "downloading" && (
                      <div style={{ display: "flex", gap: "20px", fontSize: "11px", color: "#71717a" }}>
                        <span>Speed: <strong style={{ color: "#e4e4e7" }}>{formatBytes(job.speed)}/s</strong></span>
                        <span>ETA: <strong style={{ color: "#e4e4e7" }}>{formatTime(job.eta)}</strong></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.07)",
              borderRadius: "24px",
              padding: "30px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
            }}
          >
            <h2 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 24px 0", color: "#f4f4f5" }}>Settings</h2>

            {/* Default Folder Access */}
            <div style={{ marginBottom: "28px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#e4e4e7", marginBottom: "8px" }}>
                Default Download Folder
              </label>
              <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#71717a", lineHeight: 1.5 }}>
                Choose a default directory handle. When set, YTD will directly download streams into this folder without opening save-file picker popups every time.
              </p>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  onClick={handleSelectDirectory}
                  style={{
                    background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
                    border: "none",
                    color: "white",
                    padding: "10px 18px",
                    borderRadius: "12px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(139, 92, 246, 0.25)"
                  }}
                >
                  {defaultDirName ? "Change Folder" : "Select Default Folder"}
                </button>
                {defaultDirName && (
                  <button
                    onClick={handleClearDirectory}
                    style={{
                      background: "rgba(244, 63, 94, 0.1)",
                      border: "1px solid rgba(244, 63, 94, 0.2)",
                      color: "#fda4af",
                      padding: "10px 18px",
                      borderRadius: "12px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              {defaultDirName && (
                <div style={{ marginTop: "10px", fontSize: "12px", color: "#c084fc", fontWeight: 500 }}>
                  Active Folder: <span style={{ color: "#e4e4e7", textDecoration: "underline" }}>{defaultDirName}</span>
                </div>
              )}
            </div>

            <hr style={{ border: "none", borderTop: "1px solid rgba(255, 255, 255, 0.07)", margin: "24px 0" }} />

            {/* Chunk Size */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#e4e4e7", marginBottom: "8px" }}>
                Download Chunk Size
              </label>
              <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#71717a", lineHeight: 1.5 }}>
                Adjusting this can improve speed depending on your connection. Larger chunk size uses slightly more memory buffering but makes fewer network requests.
              </p>
              <select
                value={chunkSize}
                onChange={(e) => {
                  const size = parseInt(e.target.value, 10);
                  setChunkSize(size);
                  chrome.storage.local.set({ chunkSize: size });
                }}
                style={{
                  background: "#18181b",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "10px",
                  color: "#f4f4f5",
                  padding: "10px 14px",
                  fontSize: "13px",
                  width: "100%",
                  maxWidth: "240px",
                  outline: "none"
                }}
              >
                <option value={1 * 1024 * 1024}>1 MB</option>
                <option value={2 * 1024 * 1024}>2 MB</option>
                <option value={5 * 1024 * 1024}>5 MB (Default)</option>
                <option value={10 * 1024 * 1024}>10 MB</option>
                <option value={15 * 1024 * 1024}>15 MB</option>
                <option value={20 * 1024 * 1024}>20 MB</option>
              </select>
            </div>

            {/* Concurrency settings */}
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#e4e4e7", marginBottom: "8px" }}>
                Parallel Chunk Fetches
              </label>
              <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#71717a", lineHeight: 1.5 }}>
                Number of chunks to fetch simultaneously. Higher values speed up download but can trigger YouTube rate-limiting.
              </p>
              <select
                value={concurrency}
                onChange={(e) => {
                  const limit = parseInt(e.target.value, 10);
                  setConcurrency(limit);
                  chrome.storage.local.set({ concurrency: limit });
                }}
                style={{
                  background: "#18181b",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "10px",
                  color: "#f4f4f5",
                  padding: "10px 14px",
                  fontSize: "13px",
                  width: "100%",
                  maxWidth: "240px",
                  outline: "none"
                }}
              >
                <option value={1}>1 (Sequential)</option>
                <option value={2}>2 Parallel Chunks</option>
                <option value={3}>3 Parallel Chunks (Recommended)</option>
                <option value={5}>5 Parallel Chunks (Fast)</option>
                <option value={8}>8 Parallel Chunks (Aggressive)</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, margin: 0 }}>Download History</h2>
              {historyList.length > 0 && (
                <button
                  onClick={clearHistory}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(244, 63, 94, 0.3)",
                    color: "#f43f5e",
                    padding: "6px 14px",
                    borderRadius: "10px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  Clear History
                </button>
              )}
            </div>

            {historyList.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px dashed rgba(255, 255, 255, 0.08)",
                  borderRadius: "24px",
                  color: "#71717a"
                }}
              >
                <p style={{ margin: 0, fontSize: "14px" }}>No download history recorded</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {historyList.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      background: "rgba(255, 255, 255, 0.015)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      borderRadius: "16px",
                      padding: "16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <h5 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#e4e4e7" }}>
                        {item.title}.{item.ext}
                      </h5>
                      <span style={{ fontSize: "11px", color: "#71717a", marginTop: "4px", display: "inline-block" }}>
                        {formatBytes(item.total)} • {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      {item.status === "complete" ? (
                        <span
                          style={{
                            background: "rgba(16, 185, 129, 0.1)",
                            color: "#10b981",
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "10px",
                            fontWeight: 600,
                            border: "1px solid rgba(16, 185, 129, 0.15)"
                          }}
                        >
                          Success
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "rgba(244, 63, 94, 0.1)",
                            color: "#f43f5e",
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "10px",
                            fontWeight: 600,
                            border: "1px solid rgba(244, 63, 94, 0.15)"
                          }}
                          title={item.error}
                        >
                          Failed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
