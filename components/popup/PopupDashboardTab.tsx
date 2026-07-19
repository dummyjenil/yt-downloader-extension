import React from "react";
import { formatBytes } from "../../utils/youtube";
import { themeStyles, themeColors } from "../../styles/theme";

interface PopupDashboardTabProps {
  activeDownloads: any[];
}

export const PopupDashboardTab: React.FC<PopupDashboardTabProps> = ({ activeDownloads }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
      <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: 700 }}>Active Downloads</h3>
      {activeDownloads.length === 0 ? (
        <div style={{ padding: "40px 10px", textAlign: "center", color: "#71717a", fontSize: "12px" }}>
          No active downloads running
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "420px", overflowY: "auto" }}>
          {activeDownloads.map((job) => (
            <div key={job.id} style={themeStyles.glassCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#f4f4f5", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", flex: 1 }}>
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
                      padding: 0
                    }}
                  >
                    {job.status === "paused" ? "▶" : "⏸"}
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
                      padding: 0
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div style={themeStyles.progressBarContainer}>
                <div
                  style={{
                    ...themeStyles.progressBarFill,
                    width: `${job.percent}%`,
                    background: job.status === "paused" ? "#fbbf24" : themeColors.accent
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#a1a1aa", marginTop: "4px" }}>
                <span>{job.status === "paused" ? "Paused" : `${formatBytes(job.speed)}/s`}</span>
                <span>{job.percent}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
