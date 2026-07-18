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
