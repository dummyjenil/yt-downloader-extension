import React from "react";
import { themeStyles, themeColors } from "../../styles/theme";

interface PopupSettingsTabProps {
  defaultDirName: string | null;
  chunkSize: number;
  concurrency: number;
  handleSelectDirectory: () => void;
  handleClearDirectory: () => void;
  setChunkSize: (val: number) => void;
  setConcurrency: (val: number) => void;
}

export const PopupSettingsTab: React.FC<PopupSettingsTabProps> = ({
  defaultDirName,
  chunkSize,
  concurrency,
  handleSelectDirectory,
  handleClearDirectory,
  setChunkSize,
  setConcurrency
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>
      <h3 style={{ margin: "0", fontSize: "14px", fontWeight: 700 }}>Settings</h3>

      {/* Directory Access */}
      <div>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#e4e4e7", display: "block", marginBottom: "4px" }}>
          Default Folder
        </span>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            onClick={handleSelectDirectory}
            style={{
              ...themeStyles.button,
              padding: "6px 12px",
              fontSize: "11px",
              background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)"
            }}
          >
            {defaultDirName ? "Change" : "Choose Folder"}
          </button>
          {defaultDirName && (
            <button
              onClick={handleClearDirectory}
              style={{
                background: "rgba(244, 63, 94, 0.1)",
                border: "1px solid rgba(244, 63, 94, 0.2)",
                color: "#fda4af",
                borderRadius: "12px",
                padding: "6px 12px",
                fontSize: "11px",
                cursor: "pointer"
              }}
            >
              Clear
            </button>
          )}
        </div>
        {defaultDirName && (
          <span style={{ fontSize: "10px", color: "#a78bfa", marginTop: "4px", display: "block" }}>
            Saving directly to: {defaultDirName}
          </span>
        )}
      </div>

      {/* Chunk Size Selector */}
      <div>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#e4e4e7", display: "block", marginBottom: "4px" }}>
          Chunk Size
        </span>
        <select
          value={chunkSize}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            setChunkSize(val);
            chrome.storage.local.set({ chunkSize: val });
          }}
          style={{
            background: "#18181b",
            border: `1px solid ${themeColors.border}`,
            borderRadius: "8px",
            color: "#f4f4f5",
            padding: "6px 10px",
            fontSize: "11px",
            width: "100%",
            outline: "none"
          }}
        >
          <option value={1 * 1024 * 1024}>1 MB</option>
          <option value={2 * 1024 * 1024}>2 MB</option>
          <option value={5 * 1024 * 1024}>5 MB (Default)</option>
          <option value={10 * 1024 * 1024}>10 MB</option>
          <option value={20 * 1024 * 1024}>20 MB</option>
        </select>
      </div>

      {/* Concurrency limit */}
      <div>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#e4e4e7", display: "block", marginBottom: "4px" }}>
          Parallel Chunk Fetches
        </span>
        <select
          value={concurrency}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            setConcurrency(val);
            chrome.storage.local.set({ concurrency: val });
          }}
          style={{
            background: "#18181b",
            border: `1px solid ${themeColors.border}`,
            borderRadius: "8px",
            color: "#f4f4f5",
            padding: "6px 10px",
            fontSize: "11px",
            width: "100%",
            outline: "none"
          }}
        >
          <option value={1}>1 (Sequential)</option>
          <option value={2}>2 Parallel Chunks</option>
          <option value={3}>3 Parallel Chunks</option>
          <option value={5}>5 Parallel Chunks</option>
        </select>
      </div>
    </div>
  );
};
