import { describe, it, expect } from "vitest";
import { extractVideoId, extractPlaylistId, formatBytes, formatDuration, formatTime } from "./youtube";

describe("YouTube Utils", () => {
  describe("extractVideoId", () => {
    it("should extract 11-char video ID from watch URL", () => {
      expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("should extract video ID from short link (youtu.be)", () => {
      expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("should extract video ID from YouTube Shorts URL", () => {
      expect(extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share")).toBe("dQw4w9WgXcQ");
    });

    it("should return null for invalid URLs", () => {
      expect(extractVideoId("https://google.com")).toBeNull();
      expect(extractVideoId("")).toBeNull();
    });
  });

  describe("extractPlaylistId", () => {
    it("should extract list parameter from playlist URL", () => {
      expect(extractPlaylistId("https://www.youtube.com/playlist?list=PL1234567890abcdef")).toBe("PL1234567890abcdef");
    });
  });

  describe("formatBytes", () => {
    it("should format bytes into human-readable strings", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(5242880)).toBe("5 MB");
      expect(formatBytes(1073741824)).toBe("1 GB");
      expect(formatBytes(undefined)).toBe("Unknown size");
    });
  });

  describe("formatDuration", () => {
    it("should format seconds into mm:ss or hh:mm:ss", () => {
      expect(formatDuration("65")).toBe("1:05");
      expect(formatDuration("3665")).toBe("1:01:05");
      expect(formatDuration("invalid")).toBe("0:00");
    });
  });

  describe("formatTime", () => {
    it("should format ETA seconds into hours, minutes, seconds", () => {
      expect(formatTime(45)).toBe("45s");
      expect(formatTime(125)).toBe("2m 5s");
      expect(formatTime(3665)).toBe("1h 1m 5s");
      expect(formatTime(Infinity)).toBe("calculating...");
    });
  });
});
