import React, { useEffect, useState, useRef } from "react";
import { formatBytes } from "../utils/youtube";
import { themeColors } from "../styles/theme";

// Modular components
import { DownloadProgress } from "../components/DownloadProgress";
import { DownloadStatusCard } from "../components/DownloadStatusCard";

export default function DownloadPage() {
  const [params, setParams] = useState<{ url: string; title: string; ext: string; totalSize: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "downloading" | "complete" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [speed, setSpeed] = useState(0); // bytes per second
  const [eta, setEta] = useState<number | null>(null); // seconds
  const [percent, setPercent] = useState(0);

  const activeDownloadRef = useRef(false);
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const url = urlParams.get("url") || "";
    const title = urlParams.get("title") || "video";
    const ext = urlParams.get("ext") || "mp4";
    const contentLengthStr = urlParams.get("contentLength") || "0";
    const totalSize = parseInt(contentLengthStr, 10);

    if (url) {
      setParams({ url, title, ext, totalSize });
    } else {
      setStatus("error");
      setErrorMessage("Missing streaming URL parameter.");
    }
  }, []);

  const startStreamingDownload = async () => {
    if (!params || activeDownloadRef.current) return;
    activeDownloadRef.current = true;
    setStatus("downloading");
    setErrorMessage("");

    let writableStream: any = null;

    try {
      // 1. Prompt user to select save destination
      const options = {
        suggestedName: `${params.title}.${params.ext}`,
        types: [
          {
            description: `${params.ext.toUpperCase()} File`,
            accept: {
              [`video/${params.ext === "mp4" ? "mp4" : "webm"}`]: [`.${params.ext}`],
            },
          },
        ],
      };

      // Check if showSaveFilePicker is available
      if (!(window as any).showSaveFilePicker) {
        throw new Error("Your browser does not support standard file streaming. Please use Chrome.");
      }

      const fileHandle = await (window as any).showSaveFilePicker(options);
      writableStream = await fileHandle.createWritable();

      // 2. Determine size if not present
      let totalSize = params.totalSize;
      if (!totalSize) {
        const headResponse = await fetch(params.url, { method: "HEAD" }).catch(() => null);
        const headSize = headResponse?.headers.get("content-length");
        if (headSize) {
          totalSize = parseInt(headSize, 10);
        } else {
          // Fallback chunk 0-0 range request
          const rangeResponse = await fetch(`${params.url}&range=0-0`);
          const rangeHeader = rangeResponse.headers.get("content-range");
          if (rangeHeader) {
            totalSize = parseInt(rangeHeader.split("/")[1], 10);
          }
        }
      }

      if (!totalSize) {
        throw new Error("Unable to fetch video size from YouTube server.");
      }

      // Notify background of download start
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: "TAB_DOWNLOAD_START",
          url: params.url,
          title: params.title,
          ext: params.ext,
          total: totalSize
        }).catch(() => {});
      }

      // 3. Sequential Range Download & Direct Write
      const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
      let loadedBytes = 0;
      const downloadStartTime = Date.now();

      for (let i = 0; i < totalChunks; i++) {
        if (!activeDownloadRef.current) {
          break; // Aborted
        }

        const start = i * CHUNK_SIZE;
        const end = Math.min((i + 1) * CHUNK_SIZE, totalSize) - 1;

        const chunkUrl = `${params.url}&range=${start}-${end}`;
        let response = await fetch(chunkUrl);
        
        if (!response.ok) {
          // Retry once
          response = await fetch(chunkUrl);
          if (!response.ok) {
            throw new Error(`Failed to download segment ${i + 1}/${totalChunks}`);
          }
        }

        const arrayBuffer = await response.arrayBuffer();
        await writableStream.write(arrayBuffer);

        loadedBytes += arrayBuffer.byteLength;
        setDownloadedBytes(loadedBytes);

        // Progress calculations
        const currentPercent = Math.round((loadedBytes / totalSize) * 100);
        setPercent(currentPercent);

        const elapsedTime = (Date.now() - downloadStartTime) / 1000; // seconds
        const currentSpeed = loadedBytes / elapsedTime;
        setSpeed(currentSpeed);

        const remainingBytes = totalSize - loadedBytes;
        const currentEta = currentSpeed > 0 ? remainingBytes / currentSpeed : 0;
        setEta(currentEta);

        // Notify background of download progress
        if (typeof chrome !== "undefined" && chrome.runtime) {
          chrome.runtime.sendMessage({
            type: "TAB_DOWNLOAD_PROGRESS",
            url: params.url,
            percent: currentPercent,
            downloaded: loadedBytes,
            total: totalSize
          }).catch(() => {});
        }
      }

      if (activeDownloadRef.current) {
        await writableStream.close();
        setStatus("complete");

        // Notify background of download completion
        if (typeof chrome !== "undefined" && chrome.runtime) {
          chrome.runtime.sendMessage({
            type: "TAB_DOWNLOAD_COMPLETE",
            url: params.url
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || "Failed to download and write file.");
      if (writableStream) {
        try {
          await writableStream.abort();
        } catch (_) {}
      }

      // Notify background of download failure
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: "TAB_DOWNLOAD_FAILED",
          url: params?.url || "",
          error: err.message || "Network error"
        }).catch(() => {});
      }
    } finally {
      activeDownloadRef.current = false;
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        fontFamily: "'Outfit', 'Inter', sans-serif",
        background: "linear-gradient(135deg, #09090b 0%, #121217 100%)",
        color: "#f4f4f5",
        margin: 0,
        padding: "20px"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: "24px",
          border: "1px solid rgba(255, 255, 255, 0.07)",
          padding: "30px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
          boxSizing: "border-box"
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 800,
              background: "linear-gradient(135deg, #f43f5e 0%, #8b5cf6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.5px"
            }}
          >
            YTD Premium
          </div>
          <div
            style={{
              background: "rgba(139, 92, 246, 0.1)",
              color: "#a78bfa",
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "10px",
              fontWeight: 600,
              border: "1px solid rgba(139, 92, 246, 0.2)",
              letterSpacing: "0.5px",
              textTransform: "uppercase"
            }}
          >
            Direct Stream
          </div>
        </div>

        {params && (
          <div>
            {/* Status and Actions: Idle / Complete / Error */}
            <DownloadStatusCard
              status={status}
              errorMessage={errorMessage}
              onStart={startStreamingDownload}
              onRetry={startStreamingDownload}
              title={params.title}
              ext={params.ext}
              sizeText={params.totalSize > 0 ? formatBytes(params.totalSize) : ""}
            />

            {/* Active Download Progress Card */}
            {status === "downloading" && (
              <DownloadProgress
                percent={percent}
                speed={speed}
                eta={eta}
                downloadedBytes={downloadedBytes}
                totalSize={params.totalSize}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
