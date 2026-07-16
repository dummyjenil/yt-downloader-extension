import React from "react";
import { formatBytes, formatTime } from "../../utils/youtube";
import type { JobState } from "../download-hooks/useDownloadManager";


interface ActiveDownloadsTabProps {
  jobList: JobState[];
  defaultDirName: string | null;
  dirPermission: string | null;
  requestDirPermission: () => void;
  startSetup: (id: string) => void;
  pauseJob: (id: string) => void;
  resumeJob: (id: string) => void;
  cancelJob: (id: string) => void;
  clearJob: (id: string) => void;

  maxConcurrentJobs: number;
  updateSetting: (key: "maxConcurrentJobs", val: number) => void;
}

export const ActiveDownloadsTab: React.FC<ActiveDownloadsTabProps> = ({
  jobList,
  defaultDirName,
  dirPermission,
  requestDirPermission,
  startSetup,
  pauseJob,
  resumeJob,
  cancelJob,
  clearJob,

  maxConcurrentJobs,
  updateSetting
}) => {
  return (
    <div>


      <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "20px" }}>Active Downloads</h2>
      {!defaultDirName && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            padding: "16px 20px",
            background: "rgba(59, 130, 246, 0.08)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            borderRadius: "16px",
            marginBottom: "24px",
            fontSize: "13px",
            lineHeight: 1.5,
            color: "#dbeafe"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              Default download folder is not set. Downloads will wait as <strong>Idle</strong>. Click <strong>Start</strong> on the job card to select a save location manually, or select a default folder in <strong>Settings</strong> to enable fully automatic downloads.
            </span>
          </div>
        </div>
      )}
      {defaultDirName && dirPermission !== "granted" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            padding: "16px 20px",
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.25)",
            borderRadius: "16px",
            marginBottom: "24px",
            fontSize: "13px",
            lineHeight: 1.5,
            color: "#fef3c7"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>
              Permission is required to download files to your default folder (<strong>{defaultDirName}</strong>).
            </span>
          </div>
          <button
            onClick={requestDirPermission}
            style={{
              background: "#fbbf24",
              border: "none",
              color: "#78350f",
              padding: "8px 14px",
              borderRadius: "10px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
              whiteSpace: "nowrap"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
          >
            Grant Permission
          </button>
        </div>
      )}
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
                  {(job.status === "complete" || job.status === "error") && (
                    <button
                      onClick={() => clearJob(job.id)}
                      style={{
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        color: "#e4e4e7",
                        padding: "0 12px",
                        borderRadius: "10px",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        height: "32px"
                      }}
                      title="Clear"
                    >
                      Clear
                    </button>
                  )}
                  {job.status !== "complete" && job.status !== "error" && (
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
                  )}
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
                    : job.status === "complete"
                    ? "Complete"
                    : `Downloading (${formatBytes(job.downloadedBytes)} / ${formatBytes(job.totalSize)})`}
                </span>
                <span style={{ fontWeight: 700, color: job.status === "paused" ? "#fbbf24" : job.status === "idle" ? "#60a5fa" : job.status === "complete" ? "#10b981" : "#a78bfa" }}>
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
  );
};
