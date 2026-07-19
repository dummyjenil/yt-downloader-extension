import { describe, it, expect } from "vitest";
import { jsonToWordSrt } from "./subtitle";

describe("Subtitle Service", () => {
  it("should convert YouTube JSON captions to Word-level SRT format", () => {
    const mockCaptions = {
      events: [
        {
          tStartMs: 1000,
          dDurationMs: 2000,
          segs: [
            { utf8: "Hello", tOffsetMs: 0 },
            { utf8: "World", tOffsetMs: 500 }
          ]
        }
      ]
    };

    const srt = jsonToWordSrt(mockCaptions);
    expect(srt).toContain("1\n00:00:01,000 --> 00:00:01,500\nHello");
    expect(srt).toContain("2\n00:00:01,500 --> 00:00:03,000\nWorld");
  });

  it("should filter captions when trimRange is enabled", () => {
    const mockCaptions = {
      events: [
        {
          tStartMs: 1000,
          dDurationMs: 2000,
          segs: [{ utf8: "Early", tOffsetMs: 0 }]
        },
        {
          tStartMs: 10000,
          dDurationMs: 2000,
          segs: [{ utf8: "Late", tOffsetMs: 0 }]
        }
      ]
    };

    const trimRange = { enabled: true, startTimeSec: 8, endTimeSec: 15 };
    const srt = jsonToWordSrt(mockCaptions, trimRange);

    expect(srt).not.toContain("Early");
    expect(srt).toContain("Late");
  });

  it("should return fallback message if no subtitles found", () => {
    const srt = jsonToWordSrt({});
    expect(srt).toContain("[No Subtitles Found]");
  });
});
