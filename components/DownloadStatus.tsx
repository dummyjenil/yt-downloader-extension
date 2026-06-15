import React from "react";
import { themeStyles } from "../styles/theme";

interface DownloadStatusProps {
  status: string | null;
  percent: number | null;
}

export const DownloadStatus: React.FC<DownloadStatusProps> = ({
  status,
  percent
}) => {
  if (!status) return null;

  return (
    <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={themeStyles.statusText}>{status}</div>
      {percent !== null && (
        <div style={themeStyles.progressBarContainer}>
          <div 
            style={{ 
              ...themeStyles.progressBarFill, 
              width: `${Math.min(100, Math.max(0, percent))}%` 
            }} 
          />
        </div>
      )}
    </div>
  );
};
