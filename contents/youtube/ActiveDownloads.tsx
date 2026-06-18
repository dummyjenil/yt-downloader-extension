import React from "react";
import { formatBytes } from "../../utils/youtube";

interface ActiveDownloadsProps {
  activeJobs: any[];
}

export const ActiveDownloads: React.FC<ActiveDownloadsProps> = ({ activeJobs }) => {
  if (activeJobs.length === 0) return null;

  return (
    <div style={{ marginTop: "20px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "16px" }}>
      <h4 style={{ margin: "0 0 12px 0", fontSize: "12px", fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Active Downloads ({activeJobs.length})
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "160px", overflowY: "auto", paddingRight: "4px" }}>
        {activeJobs.map((job) => (
          <div className="ytd-progress-card" key={job.id} style={{ margin: 0, padding: "10px 12px" }}>
            <div className="ytd-progress-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#e4e4e7", maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {job.title}.{job.ext}
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => {
                    chrome.runtime.sendMessage({
                      type: job.status === "paused" ? "RESUME_DOWNLOAD" : "PAUSE_DOWNLOAD",
                      id: job.id
                    });
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: job.status === "paused" ? "#10b981" : "#fbbf24",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  {job.status === "paused" ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="4" y="4" width="4" height="16" />
                      <rect x="16" y="4" width="4" height="16" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => {
                    chrome.runtime.sendMessage({ type: "CANCEL_DOWNLOAD", id: job.id });
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#f43f5e",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
            <div className="ytd-progress-bar-bg" style={{ margin: "4px 0", height: "3.5px" }}>
              <div 
                className="ytd-progress-bar-fg" 
                style={{
                  width: `${job.percent}%`,
                  background: job.status === "paused" ? "#fbbf24" : "linear-gradient(90deg, #f43f5e 0%, #8b5cf6 100%)"
                }}
              />
            </div>
            <div className="ytd-progress-details" style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#a1a1aa" }}>
              <span>
                {job.status === "paused" ? "Paused" : `${formatBytes(job.speed)}/s`}
              </span>
              <span>{job.percent}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
