import React from "react";

interface SettingsTabProps {
  chunkSize: number;
  concurrency: number;
  maxConcurrentJobs: number;
  defaultDirName: string | null;
  handleSelectDirectory: () => void;
  handleClearDirectory: () => void;
  updateSetting: (key: "chunkSize" | "concurrency" | "maxConcurrentJobs", val: number) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  chunkSize,
  concurrency,
  maxConcurrentJobs,
  defaultDirName,
  handleSelectDirectory,
  handleClearDirectory,
  updateSetting
}) => {
  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.07)",
        borderRadius: "24px",
        padding: "30px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
      }}
    >
      <h2 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 24px 0", color: "#f4f4f5" }}>Settings</h2>

      {/* Default Folder Access */}
      <div style={{ marginBottom: "28px" }}>
        <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#e4e4e7", marginBottom: "8px" }}>
          Default Download Folder
        </label>
        <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#71717a", lineHeight: 1.5 }}>
          Choose a default directory handle. When set, YTD will directly download streams into this folder without opening save-file picker popups every time.
        </p>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={handleSelectDirectory}
            style={{
              background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
              border: "none",
              color: "white",
              padding: "10px 18px",
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(139, 92, 246, 0.25)"
            }}
          >
            {defaultDirName ? "Change Folder" : "Select Default Folder"}
          </button>
          {defaultDirName && (
            <button
              onClick={handleClearDirectory}
              style={{
                background: "rgba(244, 63, 94, 0.1)",
                border: "1px solid rgba(244, 63, 94, 0.2)",
                color: "#fda4af",
                padding: "10px 18px",
                borderRadius: "12px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Clear
            </button>
          )}
        </div>
        {defaultDirName && (
          <div style={{ marginTop: "10px", fontSize: "12px", color: "#c084fc", fontWeight: 500 }}>
            Active Folder: <span style={{ color: "#e4e4e7", textDecoration: "underline" }}>{defaultDirName}</span>
          </div>
        )}
      </div>

      <hr style={{ border: "none", borderTop: "1px solid rgba(255, 255, 255, 0.07)", margin: "24px 0" }} />

      {/* Chunk Size */}
      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#e4e4e7", marginBottom: "8px" }}>
          Download Chunk Size
        </label>
        <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#71717a", lineHeight: 1.5 }}>
          Adjusting this can improve speed depending on your connection. Larger chunk size uses slightly more memory buffering but makes fewer network requests.
        </p>
        <select
          value={chunkSize}
          onChange={(e) => updateSetting("chunkSize", parseInt(e.target.value, 10))}
          style={{
            background: "#18181b",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px",
            color: "#f4f4f5",
            padding: "10px 14px",
            fontSize: "13px",
            width: "100%",
            maxWidth: "240px",
            outline: "none"
          }}
        >
          <option value={1 * 1024 * 1024}>1 MB</option>
          <option value={2 * 1024 * 1024}>2 MB</option>
          <option value={5 * 1024 * 1024}>5 MB (Default)</option>
          <option value={10 * 1024 * 1024}>10 MB</option>
          <option value={15 * 1024 * 1024}>15 MB</option>
          <option value={20 * 1024 * 1024}>20 MB</option>
        </select>
      </div>

      {/* Concurrency settings */}
      {/* Parallel Chunk Fetches */}
      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#e4e4e7", marginBottom: "8px" }}>
          Parallel Chunk Fetches
        </label>
        <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#71717a", lineHeight: 1.5 }}>
          Number of chunks to fetch simultaneously. Higher values speed up download but can trigger YouTube rate-limiting.
        </p>
        <select
          value={concurrency}
          onChange={(e) => updateSetting("concurrency", parseInt(e.target.value, 10))}
          style={{
            background: "#18181b",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px",
            color: "#f4f4f5",
            padding: "10px 14px",
            fontSize: "13px",
            width: "100%",
            maxWidth: "240px",
            outline: "none"
          }}
        >
          <option value={1}>1 (Sequential)</option>
          <option value={2}>2 Parallel Chunks</option>
          <option value={3}>3 Parallel Chunks (Recommended)</option>
          <option value={5}>5 Parallel Chunks (Fast)</option>
          <option value={8}>8 Parallel Chunks (Aggressive)</option>
        </select>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid rgba(255, 255, 255, 0.07)", margin: "24px 0" }} />

      {/* Max Concurrent Jobs (Batch size) */}
      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#e4e4e7", marginBottom: "8px" }}>
          Max Parallel Video Downloads (Batch Size)
        </label>
        <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#71717a", lineHeight: 1.5 }}>
          Control how many videos in a playlist download in parallel. Other videos will wait in queue automatically.
        </p>
        <select
          value={maxConcurrentJobs}
          onChange={(e) => updateSetting("maxConcurrentJobs", parseInt(e.target.value, 10))}
          style={{
            background: "#18181b",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#f4f4f5",
            padding: "10px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            width: "100%",
            maxWidth: "240px",
            outline: "none",
            cursor: "pointer"
          }}
        >
          {[1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
            <option key={num} value={num}>{num} {num === 1 ? "video" : "videos"}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
