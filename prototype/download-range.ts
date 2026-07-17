import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// Target Configuration
const VIDEO_ID = "xiz_U2eYT_U";
const START_TIME_SEC = 65; // 1:05 (1 min 5 sec)
const END_TIME_SEC = 85;   // 1:25 (1 min 25 sec)
const TARGET_QUALITY = "720p";
const CONCURRENCY = 4;     // Parallel chunk connections
const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB chunk size for parallel downloader

const OUTPUT_DIR = __dirname;
const TEMP_VIDEO_FILE = path.join(OUTPUT_DIR, "temp_video.mp4");
const TEMP_AUDIO_FILE = path.join(OUTPUT_DIR, "temp_audio.m4a");
const FINAL_OUTPUT_FILE = path.join(OUTPUT_DIR, "output_trimmed_720p.mp4");

interface Subsegment {
  index: number;
  startByte: number;
  endByte: number;
  size: number;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
}

interface ParsedSidx {
  timescale: number;
  subsegments: Subsegment[];
}

interface FormatInfo {
  itag: number;
  mimeType: string;
  qualityLabel?: string;
  contentLength: number;
  bitrate: number;
  url: string;
  initRange: { start: string; end: string };
  indexRange: { start: string; end: string };
}

// 1. YouTube InnerTube API Key Retrieval
async function getApiKey(): Promise<string> {
  try {
    const response = await fetch("https://www.youtube.com/app_shell");
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const text = await response.text();
    const match = text.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/) || 
                  text.match(/INNERTUBE_API_KEY":"([^"]+)"/);
    if (match && match[1]) return match[1];
    throw new Error("INNERTUBE_API_KEY not found in app_shell");
  } catch (err) {
    return "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
  }
}

// 2. Fetch VisitorData required for ANDROID_VR client authentication
async function fetchVisitorData(videoId: string, apiKey: string): Promise<string> {
  const url = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false&ext_request=true`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "x-youtube-client-name": "1",
      "x-youtube-client-version": "2.20251021.01.00"
    },
    body: JSON.stringify({
      videoId,
      context: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20251021.01.00",
          osName: "Windows",
          osVersion: "10.0",
          platform: "DESKTOP"
        }
      }
    })
  });

  const data: any = await response.json();
  const visitorData = data.responseContext?.visitorData;
  if (visitorData) return visitorData;
  throw new Error("Unable to fetch visitorData");
}

// 3. Fetch Video Player Response using ANDROID_VR client
async function fetchPlayerResponse(videoId: string, apiKey: string, visitorData: string) {
  const url = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false&ext_request=true`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
      "x-youtube-client-name": "28",
      "x-youtube-client-version": "1.60.19"
    },
    body: JSON.stringify({
      videoId,
      contentCheckOk: true,
      context: {
        client: {
          clientName: "ANDROID_VR",
          clientVersion: "1.60.19",
          deviceMake: "Oculus",
          deviceModel: "Quest 3",
          osName: "Android",
          osVersion: "12L",
          androidSdkVersion: "32",
          visitorData
        }
      }
    })
  });

  if (!response.ok) throw new Error(`HTTP Status ${response.status}`);
  return response.json();
}

// 4. Parse MP4 SIDX (Segment Index) Box to obtain precise subsegment byte offsets and timestamps
function parseSidx(buf: Buffer, indexRangeEnd: number): ParsedSidx {
  let offset = 0;
  const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
  if (type !== "sidx") throw new Error("Provided buffer is not a valid sidx box");
  
  const version = buf.readUInt8(offset + 8);
  const timescale = buf.readUInt32BE(offset + 16);
  
  offset += 20;
  let earliestPresentationTime = 0;
  let firstOffset = 0;
  if (version === 0) {
    earliestPresentationTime = buf.readUInt32BE(offset);
    firstOffset = buf.readUInt32BE(offset + 4);
    offset += 8;
  } else {
    earliestPresentationTime = Number(buf.readBigUInt64BE(offset));
    firstOffset = Number(buf.readBigUInt64BE(offset + 8));
    offset += 16;
  }
  
  offset += 2; // reserved
  const referenceCount = buf.readUInt16BE(offset);
  offset += 2;

  let currentByte = indexRangeEnd + 1 + firstOffset;
  let currentTime = earliestPresentationTime / timescale;
  const subsegments: Subsegment[] = [];

  for (let i = 0; i < referenceCount; i++) {
    const refInfo = buf.readUInt32BE(offset);
    const refSize = refInfo & 0x7FFFFFFF; // 31-bit size
    const subDuration = buf.readUInt32BE(offset + 4);
    const durSec = subDuration / timescale;

    subsegments.push({
      index: i,
      startByte: currentByte,
      endByte: currentByte + refSize - 1,
      size: refSize,
      startTimeSec: currentTime,
      endTimeSec: currentTime + durSec,
      durationSec: durSec
    });

    currentByte += refSize;
    currentTime += durSec;
    offset += 12;
  }

  return { timescale, subsegments };
}

// 5. Parallel Range Downloader
async function downloadByteRangeParallel(
  streamUrl: string,
  startByte: number,
  endByte: number,
  label: string
): Promise<Buffer> {
  const totalRangeBytes = endByte - startByte + 1;
  console.log(`\n[${label}] Fetching byte range ${startByte} - ${endByte} (${(totalRangeBytes / (1024 * 1024)).toFixed(2)} MB) via parallel chunk requests...`);

  const chunks: { index: number; start: number; end: number }[] = [];
  let currentStart = startByte;
  let chunkIdx = 0;

  while (currentStart <= endByte) {
    const currentEnd = Math.min(currentStart + CHUNK_SIZE - 1, endByte);
    chunks.push({ index: chunkIdx++, start: currentStart, end: currentEnd });
    currentStart = currentEnd + 1;
  }

  const downloadedChunks = new Map<number, Buffer>();
  let downloadedBytes = 0;
  const startTime = Date.now();

  async function fetchChunk(chunk: { index: number; start: number; end: number }): Promise<void> {
    const response = await fetch(streamUrl, {
      headers: {
        "User-Agent": "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
        "Range": `bytes=${chunk.start}-${chunk.end}`
      }
    });

    if (!response.ok && response.status !== 206) {
      throw new Error(`Failed to fetch chunk ${chunk.start}-${chunk.end}, status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    downloadedChunks.set(chunk.index, buffer);
    downloadedBytes += buffer.length;

    const elapsedSec = (Date.now() - startTime) / 1000 || 0.001;
    const speedMbps = ((downloadedBytes * 8) / (1024 * 1024 * elapsedSec)).toFixed(2);
    const percent = ((downloadedBytes / totalRangeBytes) * 100).toFixed(1);
    process.stdout.write(`\r[${label}] Progress: ${percent}% (${(downloadedBytes / (1024 * 1024)).toFixed(2)} MB / ${(totalRangeBytes / (1024 * 1024)).toFixed(2)} MB) | Speed: ${speedMbps} Mbps`);
  }

  const queue = [...chunks];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const chunk = queue.shift();
      if (chunk) await fetchChunk(chunk);
    }
  });

  await Promise.all(workers);
  console.log(`\n[${label}] Completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s.`);

  const buffers: Buffer[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const buf = downloadedChunks.get(i);
    if (!buf) throw new Error(`Missing chunk index ${i}`);
    buffers.push(buf);
  }
  return Buffer.concat(buffers);
}

async function fetchByteRangeSingle(url: string, start: number, end: number): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "com.google.android.apps.youtube.vr.oculus/1.60.19",
      "Range": `bytes=${start}-${end}`
    }
  });
  if (!response.ok && response.status !== 206) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  console.log("=================================================");
  console.log(" YouTube Video Time-Range Downloader & Trimmer");
  console.log("=================================================");
  console.log(`Video ID: ${VIDEO_ID}`);
  console.log(`Target Range: 1:05 (${START_TIME_SEC}s) -> 1:25 (${END_TIME_SEC}s)`);
  console.log(`Target Quality: ${TARGET_QUALITY}`);

  // Step 1: Metadata & Player Response
  console.log("\n1. Fetching YouTube InnerTube player response...");
  const apiKey = await getApiKey();
  const visitorData = await fetchVisitorData(VIDEO_ID, apiKey);
  const playerResponse = await fetchPlayerResponse(VIDEO_ID, apiKey, visitorData);

  const videoDetails = playerResponse.videoDetails || {};
  const totalDurationSec = parseInt(videoDetails.lengthSeconds || "180", 10);
  console.log(`Title: "${videoDetails.title}"`);
  console.log(`Total Video Duration: ${totalDurationSec}s (${(totalDurationSec / 60).toFixed(2)} mins)`);

  const adaptiveFormats: any[] = playerResponse.streamingData?.adaptiveFormats || [];
  
  // Select 720p MP4 format
  const vRaw = adaptiveFormats.find(f => f.qualityLabel?.includes(TARGET_QUALITY) && f.mimeType?.includes("video/mp4")) ||
               adaptiveFormats.find(f => f.qualityLabel?.includes(TARGET_QUALITY));
  if (!vRaw) throw new Error(`Could not find 720p video format`);

  // Select MP4 audio format (itag 140)
  const aRaw = adaptiveFormats.find(f => f.itag === 140) ||
               adaptiveFormats.find(f => f.mimeType?.includes("audio/mp4"));
  if (!aRaw) throw new Error(`Could not find MP4 audio format`);

  const vFormat: FormatInfo = {
    itag: vRaw.itag,
    mimeType: vRaw.mimeType,
    qualityLabel: vRaw.qualityLabel,
    contentLength: parseInt(vRaw.contentLength || "0", 10),
    bitrate: vRaw.bitrate,
    url: vRaw.url,
    initRange: { start: vRaw.initRange.start, end: vRaw.initRange.end },
    indexRange: { start: vRaw.indexRange.start, end: vRaw.indexRange.end }
  };

  const aFormat: FormatInfo = {
    itag: aRaw.itag,
    mimeType: aRaw.mimeType,
    contentLength: parseInt(aRaw.contentLength || "0", 10),
    bitrate: aRaw.bitrate,
    url: aRaw.url,
    initRange: { start: aRaw.initRange.start, end: aRaw.initRange.end },
    indexRange: { start: aRaw.indexRange.start, end: aRaw.indexRange.end }
  };

  console.log(`Selected Formats:`);
  console.log(`- Video: itag ${vFormat.itag} (${vFormat.qualityLabel}) | Total stream size: ${(vFormat.contentLength / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- Audio: itag ${aFormat.itag} (${aFormat.mimeType}) | Total stream size: ${(aFormat.contentLength / 1024 / 1024).toFixed(2)} MB`);

  // Step 2: Fetch Container Header & Parse SIDX for Video & Audio
  console.log("\n2. Fetching container headers & parsing SIDX index for time window [1:05 -> 1:25]...");

  // Video SIDX
  const vInitBuf = await fetchByteRangeSingle(vFormat.url, parseInt(vFormat.initRange.start, 10), parseInt(vFormat.initRange.end, 10));
  const vIndexBuf = await fetchByteRangeSingle(vFormat.url, parseInt(vFormat.indexRange.start, 10), parseInt(vFormat.indexRange.end, 10));
  const vSidx = parseSidx(vIndexBuf, parseInt(vFormat.indexRange.end, 10));
  
  const vTargets = vSidx.subsegments.filter(s => s.endTimeSec >= START_TIME_SEC && s.startTimeSec <= END_TIME_SEC);
  if (vTargets.length === 0) throw new Error("No video subsegments match time range");

  const vStartByte = vTargets[0].startByte;
  const vEndByte = vTargets[vTargets.length - 1].endByte;
  const vSubsegmentStartTime = vTargets[0].startTimeSec;

  // Audio SIDX
  const aInitBuf = await fetchByteRangeSingle(aFormat.url, parseInt(aFormat.initRange.start, 10), parseInt(aFormat.initRange.end, 10));
  const aIndexBuf = await fetchByteRangeSingle(aFormat.url, parseInt(aFormat.indexRange.start, 10), parseInt(aFormat.indexRange.end, 10));
  const aSidx = parseSidx(aIndexBuf, parseInt(aFormat.indexRange.end, 10));

  const aTargets = aSidx.subsegments.filter(s => s.endTimeSec >= START_TIME_SEC && s.startTimeSec <= END_TIME_SEC);
  if (aTargets.length === 0) throw new Error("No audio subsegments match time range");

  const aStartByte = aTargets[0].startByte;
  const aEndByte = aTargets[aTargets.length - 1].endByte;
  const aSubsegmentStartTime = aTargets[0].startTimeSec;

  console.log(`- Video subsegments range: ${vTargets[0].startTimeSec.toFixed(2)}s to ${vTargets[vTargets.length - 1].endTimeSec.toFixed(2)}s | Bytes: ${vStartByte} -> ${vEndByte}`);
  console.log(`- Audio subsegments range: ${aTargets[0].startTimeSec.toFixed(2)}s to ${aTargets[aTargets.length - 1].endTimeSec.toFixed(2)}s | Bytes: ${aStartByte} -> ${aEndByte}`);

  // Step 3: Download subsegment byte ranges using parallel requests
  const vDataBuf = await downloadByteRangeParallel(vFormat.url, vStartByte, vEndByte, "720p Video Stream Range");
  const aDataBuf = await downloadByteRangeParallel(aFormat.url, aStartByte, aEndByte, "Audio Stream Range");

  // Step 4: Construct complete playable stream chunks (Header + SIDX Index + Subsegments)
  console.log("\n3. Assembling stream chunks...");
  const fullVideoBuf = Buffer.concat([vInitBuf, vIndexBuf, vDataBuf]);
  const fullAudioBuf = Buffer.concat([aInitBuf, aIndexBuf, aDataBuf]);

  fs.writeFileSync(TEMP_VIDEO_FILE, fullVideoBuf);
  fs.writeFileSync(TEMP_AUDIO_FILE, fullAudioBuf);

  console.log(`Saved temporary video stream chunk: ${(fullVideoBuf.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Saved temporary audio stream chunk: ${(fullAudioBuf.length / 1024 / 1024).toFixed(2)} MB`);

  // Step 5: FFmpeg Exact Trimming & Muxing
  console.log("\n4. Trimming & repairing exact section with FFmpeg...");
  const vOffset = START_TIME_SEC - vSubsegmentStartTime;
  const aOffset = START_TIME_SEC - aSubsegmentStartTime;
  const duration = END_TIME_SEC - START_TIME_SEC;

  const ffmpegCmd = `ffmpeg -y -ss ${vOffset.toFixed(3)} -to ${(vOffset + duration).toFixed(3)} -i "${TEMP_VIDEO_FILE}" -ss ${aOffset.toFixed(3)} -to ${(aOffset + duration).toFixed(3)} -i "${TEMP_AUDIO_FILE}" -c:v libx264 -preset fast -c:a aac -b:a 192k "${FINAL_OUTPUT_FILE}"`;

  console.log(`Running FFmpeg command:\n${ffmpegCmd}\n`);
  execSync(ffmpegCmd, { stdio: "inherit" });

  // Cleanup temp stream files
  if (fs.existsSync(TEMP_VIDEO_FILE)) fs.unlinkSync(TEMP_VIDEO_FILE);
  if (fs.existsSync(TEMP_AUDIO_FILE)) fs.unlinkSync(TEMP_AUDIO_FILE);

  // Step 6: Final Verification
  if (fs.existsSync(FINAL_OUTPUT_FILE)) {
    const stats = fs.statSync(FINAL_OUTPUT_FILE);
    console.log("\n=================================================");
    console.log(" SUCCESS! Trimmed 720p Video Created!");
    console.log("=================================================");
    console.log(`Output File: ${FINAL_OUTPUT_FILE}`);
    console.log(`File Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size} bytes)`);
    console.log(`Trimmed Segment: 1:05 -> 1:25 (${duration}s @ 720p)`);
    console.log("=================================================");
  } else {
    throw new Error("Trimmed output file was not created");
  }
}

main().catch(err => {
  console.error("\nExecution error:", err);
  process.exit(1);
});
