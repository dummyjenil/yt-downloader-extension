import React from "react";
import { formatBytes } from "../../utils/youtube";
import { themeColors } from "../../styles/theme";

interface PopupHistoryTabProps {
  historyList: any[];
  clearHistory: () => void;
}

export const PopupHistoryTab: React.FC<PopupHistoryTabProps> = ({ historyList, clearHistory }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: "0", fontSize: "14px", fontWeight: 700 }}>History</h3>
        {historyList.length > 0 && (
          <button
            onClick={clearHistory}
            style={{
              background: "none",
              border: "none",
              color: "#f43f5e",
              fontSize: "10px",
              fontWeight: 600,
              cursor: "pointer",
              padding: 0
            }}
          >
            Clear All
          </button>
        )}
      </div>
      {historyList.length === 0 ? (
        <div style={{ padding: "40px 10px", textAlign: "center", color: "#71717a", fontSize: "12px" }}>
          No history found
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "420px", overflowY: "auto" }}>
          {historyList.map((item, idx) => (
            <div
              key={idx}
              style={{
                background: "rgba(255, 255, 255, 0.01)",
                border: `1px solid ${themeColors.border}`,
                borderRadius: "10px",
                padding: "8px 10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div style={{ flex: 1, overflow: "hidden", paddingRight: "8px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {item.title}.{item.ext}
                </div>
                <div style={{ fontSize: "9px", color: "#71717a", marginTop: "2px" }}>
                  {formatBytes(item.total)}
                </div>
              </div>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 600,
                  color: item.status === "complete" ? "#10b981" : "#f43f5e"
                }}
              >
                {item.status === "complete" ? "Success" : "Failed"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
