import React from "react";
import { themeColors, themeStyles } from "../styles/theme";

interface DownloadStatusCardProps {
  status: "idle" | "downloading" | "complete" | "error";
  errorMessage: string;
  onStart: () => void;
  onRetry: () => void;
  title: string;
  ext: string;
  sizeText: string;
}

export const DownloadStatusCard: React.FC<DownloadStatusCardProps> = ({
  status,
  errorMessage,
  onStart,
  onRetry,
  title,
  ext,
  sizeText
}) => {
  if (status === "downloading") return null;

  return (
    <div>
      {/* Video info label */}
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 8px 0", lineHeight: "1.4" }}>
          {title}
        </h3>
        <p style={{ color: themeColors.textMuted, fontSize: "12px", margin: 0 }}>
          Format: <span style={{ color: themeColors.text, fontWeight: 500 }}>{ext.toUpperCase()}</span>
          {sizeText && ` • Size: ${sizeText}`}
        </p>
      </div>

      {status === "idle" && (
        <button
          onClick={onStart}
          style={{
            ...themeStyles.button,
            width: "100%",
            padding: "14px",
            fontSize: "14px",
            boxShadow: "0 8px 24px rgba(139, 92, 246, 0.25)"
          }}
        >
          Choose Location & Download
        </button>
      )}

      {status === "complete" && (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.2)",
              color: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              margin: "0 auto 16px auto"
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h4 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 8px 0" }}>
            Download Completed!
          </h4>
          <p
            style={{
              color: themeColors.textMuted,
              fontSize: "13px",
              margin: "0 0 24px 0",
              lineHeight: "1.5"
            }}
          >
            The file has been streamed and saved successfully to your disk.
          </p>
          <button
            onClick={() => window.close()}
            style={{
              ...themeStyles.button,
              background: "rgba(255, 255, 255, 0.05)",
              border: `1px solid ${themeColors.border}`,
              color: themeColors.text,
              padding: "10px 24px",
              fontSize: "13px",
              boxShadow: "none"
            }}
          >
            Close Window
          </button>
        </div>
      )}

      {status === "error" && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.05)",
            border: "1px solid rgba(239, 68, 68, 0.15)",
            borderRadius: "16px",
            padding: "24px",
            textAlign: "center"
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto"
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h4 style={{ color: "#ef4444", fontSize: "15px", fontWeight: 600, margin: "0 0 8px 0" }}>
            Streaming failed
          </h4>
          <p
            style={{
              color: themeColors.textMuted,
              fontSize: "12px",
              margin: "0 0 20px 0",
              lineHeight: "1.5"
            }}
          >
            {errorMessage || "Network error. Please try again."}
          </p>
          <button
            onClick={onRetry}
            style={{
              ...themeStyles.button,
              background: themeColors.error,
              padding: "10px 24px",
              fontSize: "13px",
              boxShadow: "none"
            }}
          >
            Retry Download
          </button>
        </div>
      )}
    </div>
  );
};
