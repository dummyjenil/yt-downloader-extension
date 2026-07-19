import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fetchSidxByteRange, parseSidx } from "../utils/sidx";

// Define dummy global chrome object for Node environment
if (typeof (global as any).chrome === "undefined") {
  (global as any).chrome = {
    runtime: {
      sendMessage: () => Promise.resolve(),
      lastError: null
    }
  };
}

import { processSingleStreamDownload } from "../tabs/download-hooks/singleStreamDownloader";
import { processAdaptiveDownload } from "../tabs/download-hooks/adaptiveDownloader";
import type { JobState } from "../tabs/download-hooks/types";

const TEST_DIR = __dirname;
const DEFAULT_VIDEO_ID = "C8QYVwX0M6g";
const TARGET_START_SEC = 17.0;
const TARGET_END_SEC = 79.0;
const TARGET_DURATION_SEC = TARGET_END_SEC - TARGET_START_SEC;

function getFileDuration(filepath: string): number {
  if (!fs.existsSync(filepath)) return 0.0;
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filepath}"`,
      { encoding: "utf-8" }
    ).trim();
    return parseFloat(output) || 0.0;
  } catch {
    return 0.0;
  }
}

async function fetchYouTubeStreams(videoId: string) {
  const apiKey = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
  const playerUrl = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false&ext_request=true`;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      let visitorData = "";
      try {
        const webRes = await fetch(playerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
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
        const webData = await webRes.json();
        visitorData = webData?.responseContext?.visitorData || "";
      } catch (err) {}

      const vrRes = await fetch(playerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip"
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

      const vrData = await vrRes.json();
      const details = vrData?.videoDetails || {};
      const title = details.title || "Unknown";

      const adaptive = vrData?.streamingData?.adaptiveFormats || [];
      const formats = vrData?.streamingData?.formats || [];

      let videoFormat: any = null;
      let audioFormat: any = null;
      let standardFormat: any = null;

      for (const f of adaptive) {
        const mime = f.mimeType || "";
        if (mime.includes("video/mp4") && mime.includes("avc1")) {
          if (!videoFormat || parseInt(f.contentLength || "0", 10) > parseInt(videoFormat.contentLength || "0", 10)) {
            videoFormat = f;
          }
        }
        if (mime.includes("audio/mp4") && mime.includes("mp4a")) {
          if (!audioFormat || parseInt(f.contentLength || "0", 10) > parseInt(audioFormat.contentLength || "0", 10)) {
            audioFormat = f;
          }
        }
      }

      for (const f of formats) {
        const mime = f.mimeType || "";
        if (mime.includes("video/mp4")) {
          if (!standardFormat || parseInt(f.contentLength || "0", 10) > parseInt(standardFormat.contentLength || "0", 10)) {
            standardFormat = f;
          }
        }
      }
      if (!standardFormat && formats.length > 0) {
        standardFormat = formats[0];
      }

      if (videoFormat || audioFormat || standardFormat) {
        return { videoFormat, audioFormat, standardFormat, title };
      }
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("Failed to fetch stream details");
}

function createWritableStreamMock(outPath: string) {
  return {
    write: async (chunk: ArrayBuffer | Uint8Array) => {
      fs.writeFileSync(outPath, new Uint8Array(chunk));
    },
    close: async () => {},
    abort: async () => {}
  };
}

function createJobState(
  url: string,
  ext: string,
  totalSize: number,
  outPath: string,
  initRange?: any,
  indexRange?: any,
  audioUrl?: string,
  audioSize?: number,
  audioExt?: string,
  audioInitRange?: any,
  audioIndexRange?: any
): JobState {
  return {
    id: `job_${Date.now()}`,
    url,
    title: "Test Video",
    ext,
    totalSize,
    downloadedBytes: 0,
    percent: 0,
    speed: 0,
    eta: 0,
    status: "downloading",
    paused: false,
    cancelled: false,
    writableStream: createWritableStreamMock(outPath),
    nextChunkToWrite: 0,
    downloadedChunks: new Map(),
    activeFetches: new Set(),
    startedTime: Date.now(),
    speedHistory: [],
    launchedChunks: 0,
    initRange,
    indexRange,
    audioUrl,
    audioSize,
    audioExt,
    audioInitRange,
    audioIndexRange,
    trimRange: {
      enabled: true,
      startTimeSec: TARGET_START_SEC,
      endTimeSec: TARGET_END_SEC
    }
  };
}

async function runExtensionSingleStreamTest(format: any, ext: string, outPath: string) {
  let totalSize = parseInt(format.contentLength || "0", 10);
  if (!totalSize) {
    // Fetch size via HEAD request if contentLength is missing
    try {
      const headRes = await fetch(`${format.url}&ext_download=true`, { method: "HEAD" });
      const len = headRes.headers.get("content-length");
      if (len) totalSize = parseInt(len, 10);
    } catch (_) {}
  }
  if (!totalSize) totalSize = 10000000;

  const job = createJobState(
    format.url,
    ext,
    totalSize,
    outPath,
    format.initRange,
    format.indexRange
  );

  return new Promise<{ duration: number; outPath: string }>((resolve, reject) => {
    const refreshHistory = () => {};
    const processQueue = () => {
      if (job.status === "complete") {
        const dur = getFileDuration(outPath);
        resolve({ duration: dur, outPath });
      } else if (job.status === "error") {
        reject(new Error(job.errorMessage || "Single stream download failed"));
      }
    };

    processSingleStreamDownload(
      job,
      5 * 1024 * 1024,
      3,
      refreshHistory,
      processQueue
    );
  });
}

async function runExtensionAdaptiveFusionTest(vFormat: any, aFormat: any, outPath: string) {
  const vSize = parseInt(vFormat.contentLength || "0", 10);
  const aSize = parseInt(aFormat.contentLength || "0", 10);
  const totalSize = vSize + aSize;

  const job = createJobState(
    vFormat.url,
    "mp4",
    totalSize,
    outPath,
    vFormat.initRange,
    vFormat.indexRange,
    aFormat.url,
    aSize,
    "m4a",
    aFormat.initRange,
    aFormat.indexRange
  );

  return new Promise<{ duration: number; outPath: string }>((resolve, reject) => {
    const refreshHistory = () => {};
    const processQueue = () => {
      if (job.status === "complete") {
        const dur = getFileDuration(outPath);
        resolve({ duration: dur, outPath });
      } else if (job.status === "error") {
        reject(new Error(job.errorMessage || "Adaptive fusion download failed"));
      }
    };

    processAdaptiveDownload(
      job,
      5 * 1024 * 1024,
      3,
      refreshHistory,
      processQueue
    );
  });
}

async function main() {
  console.log("=".repeat(70));
  console.log("🚀 STRICT EXTENSION DOWNLOADER PIPELINE VERIFICATION SUITE");
  console.log(`   Video ID:        ${DEFAULT_VIDEO_ID}`);
  console.log(`   Target Duration: ${TARGET_DURATION_SEC}s (${TARGET_START_SEC}s -> ${TARGET_END_SEC}s)`);
  console.log("=".repeat(70));

  const { videoFormat, audioFormat, standardFormat, title } = await fetchYouTubeStreams(DEFAULT_VIDEO_ID);
  console.log(`   Title: '${title}'`);

  const results: Record<string, { status: string; path: string }> = {};

  // 1. Audio Only Test using processSingleStreamDownload
  console.log("\n--- [TEST 1: AUDIO ONLY (processSingleStreamDownload)] ---");
  const audioOut = path.join(TEST_DIR, "ts_out_audio.m4a");
  try {
    const res = await runExtensionSingleStreamTest(audioFormat, "m4a", audioOut);
    results["audio"] = { status: `PASSED (Duration: ${res.duration.toFixed(2)}s)`, path: res.outPath };
  } catch (err: any) {
    results["audio"] = { status: `FAILED (${err.message})`, path: audioOut };
  }

  // 2. Video Only Test using processSingleStreamDownload
  console.log("\n--- [TEST 2: VIDEO ONLY (processSingleStreamDownload)] ---");
  const videoOut = path.join(TEST_DIR, "ts_out_video.mp4");
  try {
    const res = await runExtensionSingleStreamTest(videoFormat, "mp4", videoOut);
    results["video"] = { status: `PASSED (Duration: ${res.duration.toFixed(2)}s)`, path: res.outPath };
  } catch (err: any) {
    results["video"] = { status: `FAILED (${err.message})`, path: videoOut };
  }

  // 3. Fusion Test using processAdaptiveDownload
  console.log("\n--- [TEST 3: FUSION VIDEO+AUDIO (processAdaptiveDownload)] ---");
  const fusionOut = path.join(TEST_DIR, "ts_out_fusion.mp4");
  try {
    const res = await runExtensionAdaptiveFusionTest(videoFormat, audioFormat, fusionOut);
    results["fusion"] = { status: `PASSED (Duration: ${res.duration.toFixed(2)}s)`, path: res.outPath };
  } catch (err: any) {
    results["fusion"] = { status: `FAILED (${err.message})`, path: fusionOut };
  }

  // 4. Standard MP4 Test using processSingleStreamDownload
  console.log("\n--- [TEST 4: STANDARD MP4 (processSingleStreamDownload)] ---");
  const standardOut = path.join(TEST_DIR, "ts_out_standard.mp4");
  try {
    const res = await runExtensionSingleStreamTest(standardFormat, "mp4", standardOut);
    results["standard"] = { status: `PASSED (Duration: ${res.duration.toFixed(2)}s)`, path: res.outPath };
  } catch (err: any) {
    results["standard"] = { status: `FAILED (${err.message})`, path: standardOut };
  }

  console.log("\n" + "=".repeat(70));
  console.log("📊 STRICT EXTENSION PIPELINE TEST RESULTS SUMMARY");
  console.log("=".repeat(70));
  let allPassed = true;
  for (const [key, item] of Object.entries(results)) {
    const icon = item.status.startsWith("PASSED") ? "✅" : "❌";
    console.log(`  ${icon} ${key.toUpperCase().padEnd(20)}: ${item.status}`);
    if (item.path) {
      console.log(`     Saved File: ${item.path}`);
    }
    if (item.status.startsWith("FAILED")) allPassed = false;
  }
  console.log("=".repeat(70));

  if (allPassed) {
    console.log("\n🎉 ALL STRICT EXTENSION DOWNLOAD PIPELINE TESTS PASSED!");
    process.exit(0);
  } else {
    console.log("\n❌ SOME EXTENSION DOWNLOAD PIPELINE TESTS FAILED!");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal Test Exception:", err);
  process.exit(1);
});
