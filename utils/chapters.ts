export interface Chapter {
  title: string;
  startMs: number;
  endMs: number;
}

/**
 * Parse chapters from YouTube InnerTube playerResponse (macroMarkersListRenderer)
 * matching pytubefix chapters.py logic, or fallback to description text regex matching.
 */
export function extractChapters(
  playerResponse: any,
  descriptionText: string,
  totalDurationSec: number
): Chapter[] {
  // 1. Try parsing macroMarkersListRenderer from playerResponse (pytubefix logic)
  try {
    const markers = playerResponse?.playerOverlays?.playerOverlayRenderer?.decoratedPlayerBarRenderer?.decoratedPlayerBarRenderer?.playerBar?.multiMarkersPlayerBarRenderer?.markersMap;
    if (Array.isArray(markers)) {
      for (const m of markers) {
        if (m.key === "AUTO_CHAPTERS" || m.key === "DESCRIPTION_CHAPTERS" || m.key === "CHAPTERS") {
          const chaptersData = m.value?.chapters || [];
          if (chaptersData.length > 0) {
            const result: Chapter[] = [];
            for (let i = 0; i < chaptersData.length; i++) {
              const ch = chaptersData[i]?.chapterRenderer;
              if (ch) {
                const title = ch.title?.simpleText || ch.title?.runs?.[0]?.text || `Chapter ${i + 1}`;
                const startMs = ch.timeRangeStartMillis || 0;
                const nextStartMs = (i < chaptersData.length - 1)
                  ? (chaptersData[i + 1]?.chapterRenderer?.timeRangeStartMillis || (totalDurationSec * 1000))
                  : (totalDurationSec * 1000);

                result.push({
                  title,
                  startMs,
                  endMs: Math.max(startMs + 1000, nextStartMs)
                });
              }
            }
            if (result.length > 0) return result;
          }
        }
      }
    }
  } catch (_) {}

  // 2. Fallback: Parse description text regex
  if (!descriptionText) return [];

  const lines = descriptionText.split("\n");
  const parsedItems: { startMs: number; title: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-–—:]?\s*(.+)/);
    if (match) {
      const hrs = match[1] ? parseInt(match[1], 10) : 0;
      const mins = parseInt(match[2], 10);
      const secs = parseInt(match[3], 10);
      const title = match[4].trim();

      const startMs = (hrs * 3600 + mins * 60 + secs) * 1000;
      if (title && startMs < totalDurationSec * 1000) {
        parsedItems.push({ startMs, title });
      }
    }
  }

  if (parsedItems.length < 2) return [];

  parsedItems.sort((a, b) => a.startMs - b.startMs);

  const chapters: Chapter[] = [];
  const totalMs = totalDurationSec * 1000;

  for (let i = 0; i < parsedItems.length; i++) {
    const current = parsedItems[i];
    const nextStartMs = (i < parsedItems.length - 1) ? parsedItems[i + 1].startMs : totalMs;

    if (nextStartMs > current.startMs) {
      chapters.push({
        title: current.title,
        startMs: current.startMs,
        endMs: nextStartMs
      });
    }
  }

  return chapters;
}

export function generateFFmpegMetadata(
  title: string,
  artist: string,
  chapters: Chapter[]
): string {
  let meta = ";FFMETADATA1\n";
  meta += `title=${title.replace(/=/g, "\\=").replace(/;/g, "\\;")}\n`;
  if (artist) {
    meta += `artist=${artist.replace(/=/g, "\\=").replace(/;/g, "\\;")}\n`;
  }
  meta += `album=YouTube Downloads\n\n`;

  for (const ch of chapters) {
    meta += `[CHAPTER]\n`;
    meta += `TIMEBASE=1/1000\n`;
    meta += `START=${ch.startMs}\n`;
    meta += `END=${ch.endMs}\n`;
    meta += `title=${ch.title.replace(/=/g, "\\=").replace(/;/g, "\\;")}\n\n`;
  }

  return meta;
}
