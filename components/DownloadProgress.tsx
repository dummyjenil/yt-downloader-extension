import React from "react";
import { formatBytes, formatTime } from "../utils/youtube";
import { themeColors, themeStyles } from "../styles/theme";

interface DownloadProgressProps {
  percent: number;
  speed: number;
  eta: number | null;
  downloadedBytes: number;
  totalSize: number;
}

export const DownloadProgress: React.FC<DownloadProgressProps> = ({
  percent,
  speed,
  eta,
  downloadedBytes,
  totalSize
}) => {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "12px",
          color: themeColors.textMuted,
          marginBottom: "8px"
        }}
      >
        <span>Streaming chunks directly...</span>
        <span style={{ color: themeColors.text, fontWeight: 600 }}>{percent}%</span>
      </div>

      {/* Progress bar container */}
      <div style={themeStyles.progressBarContainer}>
        <div
          style={{
            ...themeStyles.progressBarFill,
            width: `${percent}%`
          }}
        />
      </div>

      {/* Stats Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          background: "rgba(255, 255, 255, 0.015)",
          border: `1px solid ${themeColors.border}`,
          borderRadius: "14px",
          padding: "16px",
          marginTop: "16px"
        }}
      >
        <div>
          <div style={{ fontSize: "11px", color: themeColors.textMuted, marginBottom: "4px" }}>
            Speed
          </div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: themeColors.text }}>
            {formatBytes(speed)}/s
          </div>
        </div>
        <div>
          <div style={{ fontSize: "11px", color: themeColors.textMuted, marginBottom: "4px" }}>
            Remaining (ETA)
          </div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: themeColors.text }}>
            {eta !== null ? formatTime(eta) : "calculating..."}
          </div>
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <div style={{ fontSize: "11px", color: themeColors.textMuted, marginBottom: "4px" }}>
            Downloaded
          </div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: themeColors.text }}>
            {formatBytes(downloadedBytes)} {totalSize > 0 && `/ ${formatBytes(totalSize)}`}
          </div>
        </div>
      </div>
    </div>
  );
};
