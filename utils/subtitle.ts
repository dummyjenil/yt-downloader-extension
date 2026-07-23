function formatTime(ms: number): string {
  if (ms < 0) ms = 0;
  const milliseconds = Math.floor(ms % 1000);
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const pad = (n: number, width: number = 2) => String(n).padStart(width, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
}

export function jsonToWordSrt(
  data: any,
  trimRange?: { enabled: boolean; startTimeSec: number; endTimeSec: number }
): string {
  const subtitles: { index: number; start: string; end: string; content: string }[] = [];
  let index = 1;
  const events = data.events || [];

  const isTrimmed = trimRange && trimRange.enabled;
  const startMsLimit = isTrimmed ? Math.max(0, trimRange.startTimeSec * 1000) : 0;
  const endMsLimit = isTrimmed ? trimRange.endTimeSec * 1000 : Infinity;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (!event.segs) continue;

    const event_start = event.tStartMs || 0;
    let event_end: number;

    if (event.dDurationMs !== undefined) {
      event_end = event_start + event.dDurationMs;
    } else {
      let foundEnd = null;
      for (let j = i + 1; j < events.length; j++) {
        if (events[j].tStartMs !== undefined) {
          foundEnd = events[j].tStartMs;
          break;
        }
      }
      event_end = foundEnd !== null ? foundEnd : event_start + 1000;
    }

    // Extract valid words
    const words: { text: string; start_ms: number }[] = [];
    for (const seg of event.segs) {
      const text = (seg.utf8 || "").trim();
      if (!text || text === "\n") continue;
      const start_ms = event_start + (seg.tOffsetMs || 0);
      words.push({ text, start_ms });
    }

    if (words.length === 0) continue;

    // Create one subtitle entry per word (Word SRT)
    for (let k = 0; k < words.length; k++) {
      const { text: word, start_ms } = words[k];
      let end_ms: number;

      if (k < words.length - 1) {
        end_ms = words[k + 1].start_ms;
      } else {
        end_ms = event_end;
      }

      if (end_ms <= start_ms) {
        end_ms = start_ms + 50;
      }

      // Filter by trim bounds if trimming is active
      if (isTrimmed) {
        if (end_ms < startMsLimit || start_ms > endMsLimit) {
          continue;
        }
      }

      const finalStart = isTrimmed ? Math.max(0, start_ms - startMsLimit) : start_ms;
      const finalEnd = isTrimmed ? Math.max(50, end_ms - startMsLimit) : end_ms;

      subtitles.push({
        index: index,
        start: formatTime(finalStart),
        end: formatTime(finalEnd),
        content: word
      });
      index++;
    }
  }

  if (subtitles.length === 0) {
    return "1\n00:00:00,000 --> 00:00:02,000\n[No Subtitles Found]\n";
  }

  return (
    subtitles.map((sub) => `${sub.index}\n${sub.start} --> ${sub.end}\n${sub.content}`).join("\n\n") +
    "\n"
  );
}

export function xmlToSrt(
  xmlText: string,
  trimRange?: { enabled: boolean; startTimeSec: number; endTimeSec: number }
): string {
  const subtitles: { index: number; start: string; end: string; content: string }[] = [];
  let index = 1;

  const isTrimmed = trimRange && trimRange.enabled;
  const startMsLimit = isTrimmed ? Math.max(0, trimRange.startTimeSec * 1000) : 0;
  const endMsLimit = isTrimmed ? trimRange.endTimeSec * 1000 : Infinity;

  const regex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xmlText)) !== null) {
    const startSec = parseFloat(match[1]);
    const durSec = match[2] ? parseFloat(match[2]) : 2.0;
    const startMs = Math.round(startSec * 1000);
    const endMs = Math.round((startSec + durSec) * 1000);

    const rawContent = match[3]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (!rawContent) continue;

    if (isTrimmed) {
      if (endMs < startMsLimit || startMs > endMsLimit) continue;
    }

    const finalStart = isTrimmed ? Math.max(0, startMs - startMsLimit) : startMs;
    const finalEnd = isTrimmed ? Math.max(50, endMs - startMsLimit) : endMs;

    subtitles.push({
      index: index++,
      start: formatTime(finalStart),
      end: formatTime(finalEnd),
      content: rawContent
    });
  }

  if (subtitles.length === 0) {
    return "1\n00:00:00,000 --> 00:00:02,000\n[No Subtitles Found]\n";
  }

  return subtitles.map((s) => `${s.index}\n${s.start} --> ${s.end}\n${s.content}`).join("\n\n") + "\n";
}

export function parseSubtitleToSrt(
  rawText: string,
  trimRange?: { enabled: boolean; startTimeSec: number; endTimeSec: number }
): string {
  const trimmed = rawText.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return jsonToWordSrt(parsed, trimRange);
    } catch (_) {}
  }
  if (trimmed.startsWith("<")) {
    return xmlToSrt(trimmed, trimRange);
  }
  return trimmed;
}

export async function fetchSubtitleBuffers(
  selectedSubtitles?: { baseUrl: string; code?: string; name?: string }[],
  trimRange?: { enabled: boolean; startTimeSec: number; endTimeSec: number }
): Promise<{ name: string; code: string; data: Uint8Array }[]> {
  const subtitleBuffers: { name: string; code: string; data: Uint8Array }[] = [];
  if (selectedSubtitles && selectedSubtitles.length > 0) {
    for (let i = 0; i < selectedSubtitles.length; i++) {
      const track = selectedSubtitles[i];
      let jsonUrl = track.baseUrl.includes("fmt=") ? track.baseUrl.replace(/fmt=[^&]+/, "fmt=json3") : `${track.baseUrl}&fmt=json3`;
      try {
        const res = await fetch(jsonUrl);
        if (res.ok) {
          const rawText = await res.text();
          const srtContent = parseSubtitleToSrt(rawText, trimRange);
          subtitleBuffers.push({
            name: `sub_${i}.srt`,
            code: track.code || "eng",
            data: new TextEncoder().encode(srtContent)
          });
        }
      } catch (err) {
        console.warn("Failed to fetch subtitle track:", err);
      }
    }
  }
  return subtitleBuffers;
}
