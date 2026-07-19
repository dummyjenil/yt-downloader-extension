import { describe, expect, it } from "vitest";
import { resolveDownloadParams } from "./downloadHelpers";
import type { StreamFormat, TrimRange } from "../types/youtube";

describe("Download Helpers Unit Tests", () => {
  const sampleStream: StreamFormat = {
    itag: 18,
    url: "https://example.com/video.mp4",
    mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"',
    qualityLabel: "720p",
    contentLength: "10000000"
  };

  const sampleWebmAudio: StreamFormat = {
    itag: 251,
    url: "https://example.com/audio.webm",
    mimeType: 'audio/webm; codecs="opus"',
    qualityLabel: "",
    contentLength: "5000000"
  };

  it("should calculate video extension and filename correctly", () => {
    const res = resolveDownloadParams(sampleStream, "video", undefined, null, "120", "Test Video Title");
    expect(res.ext).toBe("mp4");
    expect(res.filename).toBe("Test Video Title_720p");
    expect(res.scaledContentLength).toBe("10000000");
  });

  it("should calculate audio extension correctly for opus/webm", () => {
    const res = resolveDownloadParams(sampleWebmAudio, "audio", undefined, null, "120", "Audio Track");
    expect(res.ext).toBe("webm");
    expect(res.filename).toBe("Audio Track");
  });

  it("should handle custom fusion parameters correctly", () => {
    const res = resolveDownloadParams(sampleStream, "fusion", sampleWebmAudio, null, "120", "Fusion Video");
    expect(res.ext).toBe("mp4");
    expect(res.audioUrl).toBe("https://example.com/audio.webm");
    expect(res.audioExt).toBe("webm");
    expect(res.audioSize).toBe("5000000");
  });

  it("should scale content length correctly when trimRange is enabled", () => {
    const trimRange: TrimRange = {
      startTimeSec: 30,
      endTimeSec: 60,
      enabled: true
    };
    // 30s trim out of 120s = 25% ratio (0.25)
    const res = resolveDownloadParams(sampleStream, "video", undefined, trimRange, "120", "Trimmed Video");
    expect(res.scaledContentLength).toBe("2500000");
    expect(res.filename).toBe("Trimmed Video_720p_trimmed_30s-60s");
  });

  it("should sanitize illegal characters in filename", () => {
    const res = resolveDownloadParams(sampleStream, "video", undefined, null, "100", "Video: Cool / Fresh * Title?");
    expect(res.filename).toBe("Video_ Cool _ Fresh _ Title__720p");
  });
});
