import { parseSidx } from "../utils/sidx";

const VIDEO_ID = "2t1luoj5FTY";

async function debugSubsegments() {
  const apiKey = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
  const playerUrl = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false&ext_request=true`;

  let visitorData = "";
  try {
    const webRes = await fetch(playerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      body: JSON.stringify({
        videoId: VIDEO_ID,
        context: { client: { clientName: "WEB", clientVersion: "2.20251021.01.00", osName: "Windows", osVersion: "10.0", platform: "DESKTOP" } }
      })
    });
    const webData = await webRes.json();
    visitorData = webData?.responseContext?.visitorData || "";
  } catch (err) { }

  const vrRes = await fetch(playerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip"
    },
    body: JSON.stringify({
      videoId: VIDEO_ID,
      contentCheckOk: true,
      context: { client: { clientName: "ANDROID_VR", clientVersion: "1.60.19", deviceMake: "Oculus", deviceModel: "Quest 3", osName: "Android", osVersion: "12L", androidSdkVersion: "32", visitorData } }
    })
  });

  const vrData = await vrRes.json();
  const adaptive = vrData?.streamingData?.adaptiveFormats || [];
  const videoFormat = adaptive.find((f: any) => f.qualityLabel === "360p" && f.mimeType.includes("video/mp4"));

  const idxStart = parseInt(videoFormat.indexRange.start, 10);
  const idxEnd = parseInt(videoFormat.indexRange.end, 10);

  const res = await fetch(`${videoFormat.url}&range=${idxStart}-${idxEnd}&ext_download=true`);
  const sidxAb = await res.arrayBuffer();
  const sidxBuf = new Uint8Array(sidxAb);

  const parsed = parseSidx(sidxBuf, idxEnd);
  console.log("Timescale:", parsed.timescale);
  console.log("Total subsegments count:", parsed.subsegments.length);

  console.log("\nFirst 10 subsegments:");
  for (let i = 0; i < Math.min(10, parsed.subsegments.length); i++) {
    const s = parsed.subsegments[i];
    console.log(`  Subsegment ${i}: byte ${s.startByte}-${s.endByte} (${s.size} bytes), time ${s.startTimeSec.toFixed(2)}s - ${s.endTimeSec.toFixed(2)}s (dur: ${s.durationSec.toFixed(2)}s)`);
  }

  const targetStart = 0;
  const targetEnd = 108;
  const matching = parsed.subsegments.filter(s => s.endTimeSec > targetStart && s.startTimeSec < targetEnd);
  console.log(`\nMatching subsegments for 0s-${targetEnd}s count: ${matching.length}`);
  if (matching.length > 0) {
    console.log(`First matching subsegment 0: byte ${matching[0].startByte}, start ${matching[0].startTimeSec}s`);
    console.log(`Last matching subsegment ${matching.length - 1}: byte ${matching[matching.length - 1].endByte}, end ${matching[matching.length - 1].endTimeSec}s`);
    console.log(`Total range size: ${matching[matching.length - 1].endByte - matching[0].startByte + 1} bytes`);
  }
}

debugSubsegments();
