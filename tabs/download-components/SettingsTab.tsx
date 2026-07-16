import React, { useState, useEffect } from "react";
import { isFFmpegInstalled, downloadFFmpeg } from "../../utils/ffmpeg-helper";

interface SettingsTabProps {
  chunkSize: number;
  concurrency: number;
  maxConcurrentJobs: number;
  defaultDirName: string | null;
  handleSelectDirectory: () => void;
  handleClearDirectory: () => void;
  updateSetting: (key: "chunkSize" | "concurrency" | "maxConcurrentJobs", val: number) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  chunkSize,
  concurrency,
  maxConcurrentJobs,
  defaultDirName,
  handleSelectDirectory,
  handleClearDirectory,
  updateSetting
}) => {
  const [status, setStatus] = useState<"not_installed" | "downloading" | "installed" | "error">("not_installed");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if FFmpeg is installed
    isFFmpegInstalled().then((installed) => {
      if (installed) {
        setStatus("installed");
        setProgress(100);
      } else {
        chrome.storage.local.get(["ffmpeg_status", "ffmpeg_progress", "ffmpeg_error"], (res) => {
          if (res.ffmpeg_status) {
            setStatus(res.ffmpeg_status as any);
            setProgress((res.ffmpeg_progress as number) || 0);
            setError((res.ffmpeg_error as string) || null);
          }
        });
      }
    });

    // Listen to local storage changes to keep progress in sync
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === "local") {
        if (changes.ffmpeg_status) {
          setStatus(changes.ffmpeg_status.newValue as any);
        }
        if (changes.ffmpeg_progress) {
          setProgress(changes.ffmpeg_progress.newValue as number);
        }
        if (changes.ffmpeg_error) {
          setError((changes.ffmpeg_error.newValue as string) || null);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const handleDownloadTrigger = async () => {
    setStatus("downloading");
    setProgress(0);
    setError(null);
    chrome.storage.local.set({
      ffmpeg_status: "downloading",
      ffmpeg_progress: 0,
      ffmpeg_error: ""
    });

    try {
      await downloadFFmpeg("0.12.10", (pct) => {
        setProgress(pct);
        chrome.storage.local.set({ ffmpeg_progress: pct });
      });
      setStatus("installed");
      setProgress(100);
      chrome.storage.local.set({ ffmpeg_status: "installed", ffmpeg_progress: 100 });
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      const errMsg = err.message || "Failed to download and store FFmpeg.";
      setError(errMsg);
      chrome.storage.local.set({
        ffmpeg_status: "error",
        ffmpeg_error: errMsg
      });
    }
  };

  return (
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
          onChange={(e) => updateSetting("chunkSize", parseInt(e.target.value, 10))}
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
      {/* Parallel Chunk Fetches */}
      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#e4e4e7", marginBottom: "8px" }}>
          Parallel Chunk Fetches
        </label>
        <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#71717a", lineHeight: 1.5 }}>
          Number of chunks to fetch simultaneously. Higher values speed up download but can trigger YouTube rate-limiting.
        </p>
        <select
          value={concurrency}
          onChange={(e) => updateSetting("concurrency", parseInt(e.target.value, 10))}
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

      <hr style={{ border: "none", borderTop: "1px solid rgba(255, 255, 255, 0.07)", margin: "24px 0" }} />

      {/* Max Concurrent Jobs (Batch size) */}
      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#e4e4e7", marginBottom: "8px" }}>
          Max Parallel Video Downloads (Batch Size)
        </label>
        <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#71717a", lineHeight: 1.5 }}>
          Control how many videos in a playlist download in parallel. Other videos will wait in queue automatically.
        </p>
        <select
          value={maxConcurrentJobs}
          onChange={(e) => updateSetting("maxConcurrentJobs", parseInt(e.target.value, 10))}
          style={{
            background: "#18181b",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#f4f4f5",
            padding: "10px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            width: "100%",
            maxWidth: "240px",
            outline: "none",
            cursor: "pointer"
          }}
        >
          {[1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
            <option key={num} value={num}>{num} {num === 1 ? "video" : "videos"}</option>
          ))}
        </select>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid rgba(255, 255, 255, 0.07)", margin: "24px 0" }} />

      {/* FFmpeg Integration Status */}
      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#e4e4e7", marginBottom: "8px" }}>
          FFmpeg Integration (Required for HD Merging)
        </label>
        <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#71717a", lineHeight: 1.5 }}>
          FFmpeg is used at runtime to fuse high-definition adaptive video with audio tracks. To avoid bulkier extension packages, it is downloaded and installed locally on demand.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            background: "rgba(255, 255, 255, 0.01)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
            borderRadius: "14px",
            padding: "16px",
            boxSizing: "border-box"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "#a1a1aa" }}>Status:</span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: "20px",
                background:
                  status === "installed"
                    ? "rgba(16, 185, 129, 0.1)"
                    : status === "downloading"
                    ? "rgba(245, 158, 11, 0.1)"
                    : "rgba(239, 68, 68, 0.1)",
                color:
                  status === "installed"
                    ? "#34d399"
                    : status === "downloading"
                    ? "#fbbf24"
                    : "#f87171",
                border: `1px solid ${
                  status === "installed"
                    ? "rgba(16, 185, 129, 0.2)"
                    : status === "downloading"
                    ? "rgba(245, 158, 11, 0.2)"
                    : "rgba(239, 68, 68, 0.2)"
                }`
              }}
            >
              {status === "installed"
                ? "Ready / Installed"
                : status === "downloading"
                ? `Downloading (${progress}%)`
                : "Not Installed"}
            </span>
          </div>

          {error && (
            <div style={{ fontSize: "11px", color: "#f87171", background: "rgba(239, 68, 68, 0.05)", padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.1)" }}>
              Error: {error}
            </div>
          )}

          {status === "downloading" && (
            <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #a78bfa, #8b5cf6)",
                  width: `${progress}%`,
                  transition: "width 0.2s ease"
                }}
              />
            </div>
          )}

          <button
            onClick={handleDownloadTrigger}
            disabled={status === "downloading"}
            style={{
              alignSelf: "flex-start",
              background: status === "installed" ? "rgba(255, 255, 255, 0.03)" : "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)",
              border: status === "installed" ? "1px solid rgba(255, 255, 255, 0.08)" : "none",
              color: "white",
              padding: "8px 16px",
              borderRadius: "10px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: status === "downloading" ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              opacity: status === "downloading" ? 0.5 : 1
            }}
          >
            {status === "installed" ? "Reinstall FFmpeg" : "Download & Install FFmpeg"}
          </button>
        </div>
      </div>
    </div>
  );
};
