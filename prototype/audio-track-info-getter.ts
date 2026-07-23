
// Configuration
const VIDEO_ID = process.argv[2] || "wk62YFS3gqc";
const CONCURRENCY = 4;
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunk size for fast parallel fetch

interface AudioStream {
  fmtId: string;
  itag: string;
  ext: string;
  codec: string;
  tbr: number;
  sizeMb: number;
  contentLength: number;
  langCode: string;
  displayName: string;
  trackId: string;
  isDefault: boolean;
  qualityNote: string;
  url: string;
}

// 1. Fetch YouTube HTML Webpage with cookies & parse ytInitialPlayerResponse
async function fetchPlayerResponseFromWebpage(videoId: string): Promise<any> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  const html = await response.text();
  const match = html.match(/var ytInitialPlayerResponse\s*=\s*({.+?});<\/script>/) ||
    html.match(/ytInitialPlayerResponse\s*=\s*({.+?});var /) ||
    html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);

  if (match && match[1]) {
    return JSON.parse(match[1]);
  }
  throw new Error("Could not parse ytInitialPlayerResponse from YouTube webpage HTML");
}

// 2. Parse All Multi-Language Audio Streams
function parseAllAudioStreams(playerResponse: any): AudioStream[] {
  const adaptiveFormats: any[] = playerResponse.streamingData?.adaptiveFormats || [];
  const formats: any[] = playerResponse.streamingData?.formats || [];
  const allFormats = [...adaptiveFormats, ...formats];

  // Index languages
  const knownLangs: string[] = [];
  for (const fmt of allFormats) {
    if (fmt.mimeType?.startsWith("audio/")) {
      const rawId = fmt.audioTrack?.id || "";
      const code = rawId ? rawId.split(".")[0] : "und";
      if (!knownLangs.includes(code)) knownLangs.push(code);
    }
  }

  const audioStreams: AudioStream[] = [];
  const seenKeys = new Set<string>();

  for (const fmt of allFormats) {
    if (!fmt.mimeType?.startsWith("audio/")) continue;

    const track = fmt.audioTrack || {};
    const displayName = track.displayName || "Default / Original";
    const rawTrackId = track.id || "default";
    const langCode = rawTrackId !== "default" ? rawTrackId.split(".")[0] : "und";
    const isDefault = !!track.audioIsDefault;

    const itag = String(fmt.itag);
    const bitrate = fmt.bitrate || 0;
    const tbr = Math.round(bitrate / 1000);
    const contentLength = parseInt(fmt.contentLength || "0", 10);
    const sizeMb = contentLength / (1024 * 1024);

    const ext = fmt.mimeType.includes("mp4") ? "m4a" : "webm";
    const codecMatch = fmt.mimeType.match(/codecs="([^"]+)"/);
    const codec = codecMatch ? codecMatch[1] : fmt.mimeType.split(";")[0];
    const qualityNote = tbr < 75 ? "low" : (tbr < 160 ? "medium" : "high");

    const key = `${itag}_${langCode}_${rawTrackId}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const langIdx = knownLangs.includes(langCode) ? knownLangs.indexOf(langCode) : 0;
    const fmtId = `${itag}-${langIdx}`;

    audioStreams.push({
      fmtId,
      itag,
      ext,
      codec,
      tbr,
      sizeMb,
      contentLength,
      langCode,
      displayName,
      trackId: rawTrackId,
      isDefault,
      qualityNote,
      url: fmt.url
    });
  }

  return audioStreams;
}

// 3. Main Function
async function main() {
  console.log("=========================================================================");
  console.log(" YouTube Multi-Language Audio Downloader (Short TypeScript)");
  console.log("=========================================================================");
  console.log(`Video ID: ${VIDEO_ID}`);

  const playerRes = await fetchPlayerResponseFromWebpage(VIDEO_ID);
  const title = playerRes.videoDetails?.title || "YouTube Audio";
  console.log(`Title: "${title}"`);

  const streams = parseAllAudioStreams(playerRes);
  if (streams.length === 0) throw new Error("No audio streams found");

  console.log(`\nFound ${streams.length} Audio Formats Across Multi-Language Tracks:`);
  console.log("-".repeat(85));
  console.log(`${"ID".padEnd(10)} ${"EXT".padEnd(5)} ${"FILESIZE".padEnd(10)} ${"TBR".padEnd(6)} ${"ACODEC".padEnd(14)} [LANG] AUDIO TRACK`);
  console.log("-".repeat(85));

  const uniqueLangs = new Set<string>();

  streams.forEach(s => {
    const sizeStr = s.sizeMb > 0 ? `${s.sizeMb.toFixed(2)}MiB` : "unknown";
    const langTag = `[${s.langCode}]`;
    const defaultTag = s.isDefault ? " (default)" : "";
    console.log(`${s.fmtId.padEnd(10)} ${s.ext.padEnd(5)} ${sizeStr.padEnd(10)} ${(s.tbr + "k").padEnd(6)} ${s.codec.padEnd(14)} ${langTag} ${s.displayName}${defaultTag}, ${s.qualityNote}`);
    uniqueLangs.add(`[${s.langCode}] ${s.displayName}`);
  });

  console.log("-".repeat(85));
  console.log(`\nTotal Unique Audio Language Tracks Detected: ${uniqueLangs.size}`);
  uniqueLangs.forEach(l => console.log(`  - ${l}`));
  console.log("=========================================================================");
}

main().catch(err => {
  console.error("Execution Error:", err);
  process.exit(1);
});
