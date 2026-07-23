import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ============================================================================
// TypeScript Implementation Replicating yt_dlp Download Logic
// Target: Tamil M4A HD Audio Track ([ta] format 140-1) for Video: wk62YFS3gqc
// Output Directory: /home/jenil-sheth/Downloads/yt-downloader-extension/prototype/
// ============================================================================

const VIDEO_ID = process.argv[2] || "wk62YFS3gqc";
const TARGET_LANG = "ta"; // Tamil
const OUTPUT_DIR = __dirname;
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks (replicating yt_dlp http_chunk_size)

interface AudioFormatInfo {
  formatId: string;
  itag: number;
  ext: string;
  codec: string;
  bitrate: number;
  contentLength: number;
  langCode: string;
  displayName: string;
  url: string;
}

// 1. Replicate yt_dlp/extractor/youtube/_video.py format resolution
function getTamilAudioStreamInfo(videoId: string): { title: string; targetStream: AudioFormatInfo; allAudioStreams: AudioFormatInfo[] } {
  console.log(`[Extractor] Running yt_dlp format extraction logic for video ID: ${videoId}...`);
  
  const helperScript = path.join(__dirname, "yt_extractor_helper.py");
  const output = execSync(`python3 "${helperScript}" "${videoId}"`, {
    encoding: "utf-8",
    maxBuffer: 30 * 1024 * 1024
  });

  const parsed = JSON.parse(output);
  const allAudioStreams: AudioFormatInfo[] = parsed.audioStreams;

  // Find strictly the Tamil M4A format (itag 140 or langCode 'ta')
  const tamilStream = allAudioStreams.find(s => 
    (s.langCode === TARGET_LANG || (s.displayName && s.displayName.toLowerCase().includes("tamil"))) && 
    (s.ext === "m4a" || s.itag === 140)
  );

  if (!tamilStream) {
    throw new Error(`Tamil audio track ([ta]) not found in extracted formats list.`);
  }

  return {
    title: parsed.title,
    targetStream: tamilStream,
    allAudioStreams
  };
}

// 2. Replicate yt_dlp/downloader/http.py (HttpFD chunked HTTP Range downloader)
async function downloadStreamWithHttpFD(
  streamUrl: string,
  totalBytes: number,
  outputFilePath: string
): Promise<void> {
  console.log(`\n[HttpFD Downloader] Starting chunked Range download...`);
  console.log(`[HttpFD Downloader] Target file: ${outputFilePath}`);
  console.log(`[HttpFD Downloader] Total size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB (${totalBytes} bytes)`);

  const fileFd = fs.openSync(outputFilePath, "w");
  let downloadedBytes = 0;
  const startTime = Date.now();

  try {
    while (downloadedBytes < totalBytes || totalBytes === 0) {
      const endByte = totalBytes > 0 ? Math.min(downloadedBytes + CHUNK_SIZE - 1, totalBytes - 1) : downloadedBytes + CHUNK_SIZE - 1;
      
      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Encoding": "identity",
        "Range": `bytes=${downloadedBytes}-${endByte}`
      };

      const res = await fetch(streamUrl, { headers });
      if (!res.ok && res.status !== 206) {
        throw new Error(`HTTP Error during chunk fetch [${downloadedBytes}-${endByte}]: ${res.status} ${res.statusText}`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0) {
        break; // End of stream
      }

      fs.writeSync(fileFd, buffer, 0, buffer.length, downloadedBytes);
      downloadedBytes += buffer.length;

      const elapsedSec = (Date.now() - startTime) / 1000;
      const speedMBs = (downloadedBytes / (1024 * 1024)) / (elapsedSec || 1);
      const percent = totalBytes > 0 ? ((downloadedBytes / totalBytes) * 100).toFixed(1) : "???";

      process.stdout.write(
        `\r[HttpFD Downloader] Progress: ${percent}% (${(downloadedBytes / (1024 * 1024)).toFixed(2)} MB / ${(totalBytes / (1024 * 1024)).toFixed(2)} MB) @ ${speedMBs.toFixed(2)} MB/s`
      );

      if (totalBytes > 0 && downloadedBytes >= totalBytes) break;
    }
    console.log(`\n[HttpFD Downloader] Download complete successfully!`);
  } finally {
    fs.closeSync(fileFd);
  }
}

// 3. Main execution function
async function main() {
  console.log("=========================================================================");
  console.log(" YouTube Tamil M4A HD Audio Downloader (yt_dlp TypeScript Replication)");
  console.log("=========================================================================");
  console.log(`Target Video ID: ${VIDEO_ID}`);
  console.log(`Target Language: Tamil ([${TARGET_LANG}])`);

  // Step A: Extract formats & resolve Tamil stream URL
  const { title, targetStream, allAudioStreams } = getTamilAudioStreamInfo(VIDEO_ID);
  
  console.log(`\n[Extractor] Available Audio Languages Detected (${allAudioStreams.length} formats):`);
  console.log("-".repeat(80));
  allAudioStreams.forEach(s => {
    const isTarget = (s.langCode === TARGET_LANG || (s.displayName && s.displayName.toLowerCase().includes("tamil"))) ? " <-- [SELECTED TAMIL TRACK]" : "";
    console.log(`Format ID: ${s.formatId.padEnd(8)} | Lang: [${s.langCode.padEnd(5)}] | Track: ${s.displayName.padEnd(25)} | Ext: ${s.ext.padEnd(5)} | Size: ${(s.contentLength / (1024 * 1024)).toFixed(2)} MB${isTarget}`);
  });
  console.log("-".repeat(80));

  console.log(`\n[Extractor] Selected Target Stream Details:`);
  console.log(`  - Format ID:    ${targetStream.formatId}`);
  console.log(`  - Language:     [${targetStream.langCode}] ${targetStream.displayName}`);
  console.log(`  - Extension:    ${targetStream.ext}`);
  console.log(`  - Codec:        ${targetStream.codec}`);
  console.log(`  - Content Size: ${(targetStream.contentLength / (1024 * 1024)).toFixed(2)} MB`);

  // Step B: Download using HttpFD logic
  const sanitizedTitle = title.replace(/[/\\?%*:|"<>]/g, "_");
  const fileName = `${sanitizedTitle}_Tamil_HD.m4a`;
  const outputPath = path.join(OUTPUT_DIR, fileName);

  await downloadStreamWithHttpFD(targetStream.url, targetStream.contentLength, outputPath);

  // Step C: Verify file integrity
  console.log(`\n[Verification] Checking downloaded file...`);
  if (!fs.existsSync(outputPath)) {
    throw new Error(`File was not found at expected path: ${outputPath}`);
  }

  const stat = fs.statSync(outputPath);
  console.log(`  - Path: ${outputPath}`);
  console.log(`  - File Size on Disk: ${stat.size} bytes (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);

  // Verify M4A magic bytes (ftyp)
  const fd = fs.openSync(outputPath, "r");
  const headerBuf = Buffer.alloc(12);
  fs.readSync(fd, headerBuf, 0, 12, 0);
  fs.closeSync(fd);

  const ftypMagic = headerBuf.subarray(4, 8).toString("ascii");
  console.log(`  - Container Header: '${ftypMagic}'`);

  if (stat.size > 0 && (ftypMagic === "ftyp" || ftypMagic.includes("M4A"))) {
    console.log("\n=========================================================================");
    console.log(" SUCCESS: Tamil M4A HD audio track downloaded & verified successfully!");
    console.log("=========================================================================");
  } else {
    throw new Error("Downloaded file validation failed or corrupted!");
  }
}

main().catch(err => {
  console.error("\n[Error] Download execution failed:", err);
  process.exit(1);
});
