import React from "react";
import { formatBytes } from "../../utils/youtube";

interface HistoryTabProps {
  historyList: any[];
  clearHistory: () => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ historyList, clearHistory }) => {
  return (
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
  );
};
