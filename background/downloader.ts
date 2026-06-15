import { DownloadDB } from "../db";

export interface ActiveDownload {
  url: string;
  title: string;
  ext: string;
  itag: number;
  downloaded: number;
  total: number;
  percent: number;
  status: string;
}

let activeDownload: ActiveDownload | null = null;

export function getActiveDownload(): ActiveDownload | null {
  return activeDownload;
}

export function setActiveDownload(val: ActiveDownload | null) {
  activeDownload = val;
}

const db = new DownloadDB();
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

export async function getStreamSize(url: string): Promise<number> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    const size = response.headers.get("content-length");
    if (size) return parseInt(size, 10);
  } catch (e) {
    console.warn("HEAD request failed, trying GET with range=0-0", e);
  }
  
  try {
    const response = await fetch(`${url}&range=0-0`);
    const contentRange = response.headers.get("content-range");
    if (contentRange) {
      const parts = contentRange.split("/");
      if (parts.length === 2) {
        return parseInt(parts[1], 10);
      }
    }
    const size = response.headers.get("content-length");
    if (size) return parseInt(size, 10);
  } catch (e) {
    console.error("Failed to get stream size", e);
  }
  return 0;
}

export async function startChunkedDownload(
  url: string,
  title: string,
  ext: string,
  itag: number,
  contentLength?: string
) {
  // Sanitize filename
  const sanitizedTitle = title.replace(/[\\/:*?"<>|]/g, "_");
  const filename = `${sanitizedTitle}.${ext}`;

  let totalSize = contentLength ? parseInt(contentLength, 10) : 0;
  if (!totalSize || isNaN(totalSize)) {
    totalSize = await getStreamSize(url);
  }

  if (!totalSize) {
    throw new Error("Unable to determine video stream file size.");
  }

  const downloadId = `${itag}_${Date.now()}`;
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
  
  activeDownload = {
    url,
    title: filename,
    ext,
    itag,
    downloaded: 0,
    total: totalSize,
    percent: 0,
    status: `Starting download (0%)`
  };

  let downloadedBytes = 0;
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min((i + 1) * CHUNK_SIZE, totalSize) - 1;
    
    const chunkUrl = `${url}&range=${start}-${end}`;
    let success = false;
    let retries = 3;
    let arrayBuffer: ArrayBuffer | null = null;
    
    while (!success && retries > 0) {
      try {
        const response = await fetch(chunkUrl);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        arrayBuffer = await response.arrayBuffer();
        success = true;
      } catch (err) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to fetch chunk ${i + 1}/${totalChunks}: ${err}`);
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (arrayBuffer) {
      await db.saveChunk(downloadId, i, arrayBuffer);
      downloadedBytes += arrayBuffer.byteLength;
      
      const percent = Math.round((downloadedBytes / totalSize) * 100);
      const formattedPercent = isNaN(percent) ? 0 : percent;
      
      activeDownload = {
        ...activeDownload,
        downloaded: downloadedBytes,
        percent: formattedPercent,
        status: `Downloading: ${formattedPercent}%`
      };

      chrome.runtime.sendMessage({
        type: "DOWNLOAD_PROGRESS",
        itag,
        downloaded: downloadedBytes,
        total: totalSize,
        percent: formattedPercent
      }).catch(() => {});
    }
  }

  activeDownload = null;
  
  chrome.runtime.sendMessage({
    type: "DOWNLOAD_COMPLETE",
    itag
  }).catch(() => {});

  const helperUrl = chrome.runtime.getURL(
    `tabs/download-helper.html?downloadId=${downloadId}&totalChunks=${totalChunks}&filename=${encodeURIComponent(filename)}`
  );
  chrome.tabs.create({ url: helperUrl, active: false });
}
