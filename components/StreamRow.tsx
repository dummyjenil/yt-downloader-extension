import React, { useState } from "react";
import { themeColors, themeStyles } from "../styles/theme";

interface StreamRowProps {
  label: string;
  meta: string;
  isDownloading: boolean;
  onDownload: () => void;
}

export const StreamRow: React.FC<StreamRowProps> = ({
  label,
  meta,
  isDownloading,
  onDownload
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const rowStyle: React.CSSProperties = {
    ...themeStyles.streamRow,
    background: isHovered ? themeColors.surfaceHover : "rgba(255, 255, 255, 0.015)",
    borderColor: isHovered ? "rgba(255, 255, 255, 0.12)" : themeColors.border
  };

  const buttonStyle: React.CSSProperties = {
    ...themeStyles.downloadIcon,
    background: isHovered ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.03)",
    borderColor: isHovered ? "rgba(255, 255, 255, 0.2)" : themeColors.border,
    color: isDownloading ? "#a78bfa" : themeColors.text
  };

  return (
    <div
      style={rowStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={themeStyles.streamInfo}>
        <span style={themeStyles.streamLabel}>{label}</span>
        <span style={themeStyles.streamMeta}>{meta}</span>
      </div>
      <button
        onClick={onDownload}
        disabled={isDownloading}
        style={buttonStyle}
        title="Download Stream"
      >
        {isDownloading ? (
          /* Sleek micro-spinner */
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            style={{
              animation: "spin 0.8s linear infinite",
            }}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
        ) : (
          /* Sleek modern down arrow SVG */
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        )}
      </button>
    </div>
  );
};
