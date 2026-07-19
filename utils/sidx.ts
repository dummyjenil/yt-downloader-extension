export interface Subsegment {
  index: number;
  startByte: number;
  endByte: number;
  size: number;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
}

export interface ParsedSidx {
  timescale: number;
  subsegments: Subsegment[];
}

export interface TargetByteRange {
  startByte: number;
  endByte: number;
  subsegments: Subsegment[];
}

export interface SidxRangeResult {
  initBytes: Uint8Array;
  rangeStart: number;
  rangeEnd: number;
  subsegmentStartSec: number;
}

/**
 * Fetch and resolve target time range to exact SIDX byte range + init header
 */
export async function fetchSidxByteRange(
  streamUrl: string,
  targetStartSec: number,
  targetEndSec: number,
  initRange?: { start: string; end: string },
  indexRange?: { start: string; end: string },
  fetcherFn?: (url: string, startByte: number, endByte: number) => Promise<ArrayBuffer>
): Promise<SidxRangeResult | null> {
  const fetcher = fetcherFn || (async (u, s, e) => {
    let chunkUrl = u;
    if (chunkUrl.includes("range=")) {
      chunkUrl = chunkUrl.replace(/([?&])range=[^&]*/, `$1range=${s}-${e}`);
    } else {
      const sep = chunkUrl.includes("?") ? "&" : "?";
      chunkUrl = `${chunkUrl}${sep}range=${s}-${e}`;
    }
    if (!chunkUrl.includes("ext_download=true")) {
      const sep = chunkUrl.includes("?") ? "&" : "?";
      chunkUrl = `${chunkUrl}${sep}ext_download=true`;
    }
    const res = await fetch(chunkUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.arrayBuffer();
  });

  let initEnd = initRange ? parseInt(initRange.end, 10) : 0;
  let idxStart = indexRange ? parseInt(indexRange.start, 10) : 0;
  let idxEnd = indexRange ? parseInt(indexRange.end, 10) : 0;

  let initBuf: Uint8Array;
  let sidxBuf: Uint8Array;

  try {
    if (initEnd > 0 && idxEnd > 0) {
      const [initAb, sidxAb] = await Promise.all([
        fetcher(streamUrl, 0, initEnd),
        fetcher(streamUrl, idxStart, idxEnd)
      ]);
      initBuf = new Uint8Array(initAb);
      sidxBuf = new Uint8Array(sidxAb);
    } else {
      // Fallback: fetch header 0-4095
      const headerAb = await fetcher(streamUrl, 0, 4095);
      const headerBuf = new Uint8Array(headerAb);
      const view = new DataView(headerBuf.buffer, headerBuf.byteOffset, headerBuf.byteLength);

      let offset = 0;
      let foundSidxOffset = -1;
      let foundSidxSize = -1;
      let foundMoovEnd = -1;

      while (offset + 8 <= headerBuf.length) {
        const size = view.getUint32(offset, false);
        const type = String.fromCharCode(headerBuf[offset + 4], headerBuf[offset + 5], headerBuf[offset + 6], headerBuf[offset + 7]);
        if (size < 8) break;

        if (type === "moov") {
          foundMoovEnd = offset + size - 1;
        } else if (type === "sidx") {
          foundSidxOffset = offset;
          foundSidxSize = size;
          break;
        }
        offset += size;
      }

      if (foundSidxOffset !== -1 && foundSidxSize > 0) {
        initEnd = foundMoovEnd > 0 ? foundMoovEnd : foundSidxOffset - 1;
        idxStart = foundSidxOffset;
        idxEnd = foundSidxOffset + foundSidxSize - 1;
        initBuf = headerBuf.subarray(0, initEnd + 1);
        sidxBuf = headerBuf.subarray(idxStart, idxEnd + 1);
      } else {
        return null;
      }
    }

    const parsed = parseSidx(sidxBuf, idxEnd);
    const matching = parsed.subsegments.filter(
      (s) => s.endTimeSec > targetStartSec && s.startTimeSec < targetEndSec
    );

    if (matching.length === 0) return null;

    return {
      initBytes: initBuf,
      rangeStart: matching[0].startByte,
      rangeEnd: matching[matching.length - 1].endByte,
      subsegmentStartSec: matching[0].startTimeSec
    };
  } catch (err) {
    console.warn("fetchSidxByteRange error:", err);
    return null;
  }
}

/**
 * Parse an MP4 SIDX (Segment Index) box from a Uint8Array buffer
 */
export function parseSidx(buf: Uint8Array, indexRangeEnd: number): ParsedSidx {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // Check box type 'sidx'
  const type = String.fromCharCode(buf[4], buf[5], buf[6], buf[7]);
  if (type !== "sidx") {
    throw new Error(`Invalid SIDX box type: '${type}'`);
  }

  const version = buf[8];
  const timescale = view.getUint32(16, false); // Big-endian

  let offset = 20;
  let earliestPresentationTime = 0;
  let firstOffset = 0;

  if (version === 0) {
    earliestPresentationTime = view.getUint32(offset, false);
    firstOffset = view.getUint32(offset + 4, false);
    offset += 8;
  } else {
    // 64-bit presentation time & first offset
    const highPts = view.getUint32(offset, false);
    const lowPts = view.getUint32(offset + 4, false);
    earliestPresentationTime = highPts * 4294967296 + lowPts;

    const highOff = view.getUint32(offset + 8, false);
    const lowOff = view.getUint32(offset + 12, false);
    firstOffset = highOff * 4294967296 + lowOff;
    offset += 16;
  }

  offset += 2; // Reserved
  const referenceCount = view.getUint16(offset, false);
  offset += 2;

  let currentByte = indexRangeEnd + 1 + firstOffset;
  let currentTime = earliestPresentationTime / timescale;
  const subsegments: Subsegment[] = [];

  for (let i = 0; i < referenceCount; i++) {
    const refInfo = view.getUint32(offset, false);
    const refSize = refInfo & 0x7fffffff; // 31-bit size
    const subDuration = view.getUint32(offset + 4, false);
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
    offset += 12; // 4 bytes refInfo + 4 bytes subDuration + 4 bytes SAP info
  }

  return { timescale, subsegments };
}

/**
 * Resolve target time range (startTimeSec to endTimeSec) to exact SIDX subsegment byte range
 */
export function getTrimByteRange(
  sidxBuf: Uint8Array,
  indexRangeEnd: number,
  startTimeSec: number,
  endTimeSec: number
): TargetByteRange | null {
  try {
    const parsed = parseSidx(sidxBuf, indexRangeEnd);
    const matching = parsed.subsegments.filter(
      (s) => s.endTimeSec > startTimeSec && s.startTimeSec < endTimeSec
    );

    if (matching.length === 0) {
      return null;
    }

    return {
      startByte: matching[0].startByte,
      endByte: matching[matching.length - 1].endByte,
      subsegments: matching
    };
  } catch (err) {
    console.warn("Failed to parse SIDX box:", err);
    return null;
  }
}
