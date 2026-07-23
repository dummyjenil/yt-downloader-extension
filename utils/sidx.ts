export interface Subsegment {
  index: number
  startByte: number
  endByte: number
  size: number
  startTimeSec: number
  endTimeSec: number
  durationSec: number
}

export interface ParsedSidx {
  timescale: number
  subsegments: Subsegment[]
}

export interface TargetByteRange {
  startByte: number
  endByte: number
  subsegments: Subsegment[]
}

export interface SidxRangeResult {
  initBytes: Uint8Array
  rangeStart: number
  rangeEnd: number
  subsegmentStartSec: number
  totalDurationSec?: number
}

export function buildChunkUrl(
  baseUrl: string,
  startByte: number,
  endByte: number
): string {
  // Cleanly strip any existing range= parameter to avoid sending duplicate range headers to YouTube servers
  let cleaned = baseUrl.replace(/([?&])range=[^&]*(&|$)/g, (match, p1, p2) =>
    p2 === "&" ? p1 : ""
  )
  if (cleaned.endsWith("?") || cleaned.endsWith("&")) {
    cleaned = cleaned.slice(0, -1)
  }
  const sep = cleaned.includes("?") ? "&" : "?"
  let url = `${cleaned}${sep}range=${startByte}-${endByte}`
  if (!url.includes("ext_download=true")) {
    url = `${url}&ext_download=true`
  }
  return url
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
  fetcherFn?: (
    url: string,
    startByte: number,
    endByte: number
  ) => Promise<ArrayBuffer>
): Promise<SidxRangeResult | null> {
  console.log("🔍 [fetchSidxByteRange] Resolving range:", {
    targetStartSec,
    targetEndSec,
    initRange,
    indexRange
  })

  const fetcher =
    fetcherFn ||
    (async (u, s, e) => {
      const chunkUrl = buildChunkUrl(u, s, e)
      let attempt = 0
      const maxAttempts = 5
      while (attempt < maxAttempts) {
        try {
          const res = await fetch(chunkUrl)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return await res.arrayBuffer()
        } catch (err) {
          attempt++
          if (attempt >= maxAttempts) throw err
          await new Promise((r) =>
            setTimeout(r, 500 * Math.pow(2, attempt - 1))
          )
        }
      }
      throw new Error(`Failed to fetch byte range ${s}-${e}`)
    })

  let initEnd = initRange ? parseInt(String(initRange.end), 10) : 0
  let idxStart = indexRange ? parseInt(String(indexRange.start), 10) : 0
  let idxEnd = indexRange ? parseInt(String(indexRange.end), 10) : 0

  let initBuf: Uint8Array
  let sidxBuf: Uint8Array

  try {
    if (initEnd > 0 && idxEnd > 0) {
      console.log(
        `🔍 [fetchSidxByteRange] Using explicit initRange (0-${initEnd}) and indexRange (${idxStart}-${idxEnd})`
      )
      const [initAb, sidxAb] = await Promise.all([
        fetcher(streamUrl, 0, initEnd),
        fetcher(streamUrl, idxStart, idxEnd)
      ])
      initBuf = new Uint8Array(initAb)
      sidxBuf = new Uint8Array(sidxAb)
    } else {
      // Fallback: fetch 64KB header first, then 256KB header if needed for long videos
      console.log(
        "🔍 [fetchSidxByteRange] Missing indexRange/initRange, fetching header fallback (0-65535)..."
      )
      let headerAb = await fetcher(streamUrl, 0, 65535)
      let headerBuf = new Uint8Array(headerAb)
      let view = new DataView(
        headerBuf.buffer,
        headerBuf.byteOffset,
        headerBuf.byteLength
      )

      let offset = 0
      let foundSidxOffset = -1
      let foundSidxSize = -1
      let foundMoovEnd = -1

      const scanHeader = (buf: Uint8Array, v: DataView) => {
        let off = 0
        while (off + 8 <= buf.length) {
          const size = v.getUint32(off, false)
          if (size < 8) break
          const type = String.fromCharCode(
            buf[off + 4],
            buf[off + 5],
            buf[off + 6],
            buf[off + 7]
          )

          if (type === "moov") {
            foundMoovEnd = off + size - 1
          } else if (type === "sidx") {
            foundSidxOffset = off
            foundSidxSize = size
            break
          }
          off += size
        }
      }

      scanHeader(headerBuf, view)

      if (foundSidxOffset === -1) {
        console.log(
          "🔍 [fetchSidxByteRange] SIDX not in 64KB, trying 256KB header fallback..."
        )
        headerAb = await fetcher(streamUrl, 0, 262143)
        headerBuf = new Uint8Array(headerAb)
        view = new DataView(
          headerBuf.buffer,
          headerBuf.byteOffset,
          headerBuf.byteLength
        )
        foundMoovEnd = -1
        scanHeader(headerBuf, view)
      }

      if (foundSidxOffset !== -1 && foundSidxSize > 0) {
        initEnd = foundMoovEnd > 0 ? foundMoovEnd : foundSidxOffset - 1
        idxStart = foundSidxOffset
        idxEnd = foundSidxOffset + foundSidxSize - 1
        initBuf = headerBuf.subarray(0, initEnd + 1)
        sidxBuf = headerBuf.subarray(idxStart, idxEnd + 1)
        console.log(
          `🔍 [fetchSidxByteRange] Found SIDX box in header fallback: ${idxStart}-${idxEnd}`
        )
      } else {
        console.warn(
          "⚠️ [fetchSidxByteRange] No SIDX box found in header fallbacks!"
        )
        return null
      }
    }

    const parsed = parseSidx(sidxBuf, idxEnd)
    const matching = parsed.subsegments.filter(
      (s) => s.endTimeSec > targetStartSec && s.startTimeSec < targetEndSec
    )

    if (matching.length === 0) {
      console.warn(
        "⚠️ [fetchSidxByteRange] No matching subsegments found for target time range!"
      )
      return null
    }

    const totalDurationSec =
      parsed.subsegments.length > 0
        ? parsed.subsegments[parsed.subsegments.length - 1].endTimeSec
        : 0

    const result: SidxRangeResult = {
      initBytes: initBuf,
      rangeStart: matching[0].startByte,
      rangeEnd: matching[matching.length - 1].endByte,
      subsegmentStartSec: matching[0].startTimeSec,
      totalDurationSec
    }

    console.log(
      `✅ [fetchSidxByteRange SUCCESS] Range: ${result.rangeStart}-${result.rangeEnd} (${result.rangeEnd - result.rangeStart + 1} bytes), SubStart: ${result.subsegmentStartSec}s, Matching Subsegments: ${matching.length}`
    )
    return result
  } catch (err) {
    console.warn("⚠️ [fetchSidxByteRange error]", err)
    return null
  }
}

/**
 * Parse an MP4 SIDX (Segment Index) box from a Uint8Array buffer
 */
export function parseSidx(buf: Uint8Array, indexRangeEnd: number): ParsedSidx {
  // Ensure we operate on a clean Uint8Array with byteOffset = 0
  const sidxBytes =
    buf.byteOffset === 0 && buf.byteLength === buf.buffer.byteLength
      ? buf
      : new Uint8Array(
          buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
        )

  const view = new DataView(
    sidxBytes.buffer,
    sidxBytes.byteOffset,
    sidxBytes.byteLength
  )

  // Check box type 'sidx'
  const type = String.fromCharCode(
    sidxBytes[4],
    sidxBytes[5],
    sidxBytes[6],
    sidxBytes[7]
  )
  if (type !== "sidx") {
    throw new Error(`Invalid SIDX box type: '${type}'`)
  }

  const version = sidxBytes[8]
  const timescale = view.getUint32(16, false) // Big-endian

  let offset = 20
  let earliestPresentationTime = 0
  let firstOffset = 0

  if (version === 0) {
    earliestPresentationTime = view.getUint32(offset, false)
    firstOffset = view.getUint32(offset + 4, false)
    offset += 8
  } else {
    // 64-bit presentation time & first offset
    const highPts = view.getUint32(offset, false)
    const lowPts = view.getUint32(offset + 4, false)
    earliestPresentationTime = highPts * 4294967296 + lowPts

    const highOff = view.getUint32(offset + 8, false)
    const lowOff = view.getUint32(offset + 12, false)
    firstOffset = highOff * 4294967296 + lowOff
    offset += 16
  }

  offset += 2 // Reserved
  const referenceCount = view.getUint16(offset, false)
  offset += 2

  let currentByte = indexRangeEnd + 1 + firstOffset
  let currentTime = earliestPresentationTime / timescale
  const subsegments: Subsegment[] = []

  for (let i = 0; i < referenceCount; i++) {
    const refInfo = view.getUint32(offset, false)
    const refSize = refInfo & 0x7fffffff // 31-bit size
    const subDuration = view.getUint32(offset + 4, false)
    const durSec = subDuration / timescale

    subsegments.push({
      index: i,
      startByte: currentByte,
      endByte: currentByte + refSize - 1,
      size: refSize,
      startTimeSec: currentTime,
      endTimeSec: currentTime + durSec,
      durationSec: durSec
    })

    currentByte += refSize
    currentTime += durSec
    offset += 12 // 4 bytes refInfo + 4 bytes subDuration + 4 bytes SAP info
  }

  return { timescale, subsegments }
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
    const parsed = parseSidx(sidxBuf, indexRangeEnd)
    const matching = parsed.subsegments.filter(
      (s) => s.endTimeSec > startTimeSec && s.startTimeSec < endTimeSec
    )

    if (matching.length === 0) {
      return null
    }

    return {
      startByte: matching[0].startByte,
      endByte: matching[matching.length - 1].endByte,
      subsegments: matching
    }
  } catch (err) {
    console.warn("Failed to parse SIDX box:", err)
    return null
  }
}
