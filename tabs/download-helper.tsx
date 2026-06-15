import { useEffect } from "react";
import React from "react";
import { DownloadDB } from "../db";

export default function DownloadHelper() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const downloadId = params.get("downloadId");
    const totalChunksStr = params.get("totalChunks");
    const filename = params.get("filename") || "video.mp4";

    if (!downloadId || !totalChunksStr) {
      console.error("Missing download parameters in download helper tab");
      return;
    }

    const totalChunks = parseInt(totalChunksStr, 10);
    const db = new DownloadDB();

    async function processDownload() {
      try {
        const chunks = await db.getChunks(downloadId, totalChunks);
        const blob = new Blob(chunks, { type: "application/octet-stream" });
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Clean up
        setTimeout(async () => {
          URL.revokeObjectURL(blobUrl);
          await db.clearDownload(downloadId, totalChunks);
          window.close();
        }, 1000);
      } catch (err) {
        console.error("Error in download helper tab:", err);
      }
    }

    processDownload();
  }, []);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        fontFamily: "'Outfit', 'Inter', sans-serif",
        background: "#09090b",
        color: "#f4f4f5",
        margin: 0
      }}
    >
      <div
        style={{
          textAlign: "center",
          padding: "30px",
          background: "rgba(255, 255, 255, 0.02)",
          borderRadius: "20px",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          maxWidth: "360px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)"
        }}
      >
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "rgba(139, 92, 246, 0.08)",
            border: "1px solid rgba(139, 92, 246, 0.15)",
            color: "#a78bfa",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px auto"
          }}
        >
          {/* Animated pulsing spinner */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{
              animation: "spin 1.2s linear infinite"
            }}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
        </div>
        <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 8px 0" }}>
          Reassembling Media File...
        </h3>
        <p style={{ color: "#a1a1aa", fontSize: "12px", margin: 0, lineHeight: "1.5" }}>
          Please do not close this window. It will save your file and close automatically.
        </p>
      </div>
    </div>
  );
}
