import React, { useState, useEffect } from "react";
import type { TrimRange } from "../types/youtube";

interface RangeSelectorProps {
  totalDurationSec: number;
  onChange: (trimRange: TrimRange) => void;
}

export const RangeSelector: React.FC<RangeSelectorProps> = ({ totalDurationSec, onChange }) => {
  const [enabled, setEnabled] = useState(false);
  const [startStr, setStartStr] = useState("00:00");
  const [endStr, setEndStr] = useState(() => {
    const mins = Math.floor(totalDurationSec / 60);
    const secs = totalDurationSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  });

  const parseTimeToSec = (str: string): number => {
    const parts = str.trim().split(":").map((p) => parseInt(p, 10));
    if (parts.length === 3) {
      return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    }
    if (parts.length === 2) {
      return (parts[0] || 0) * 60 + (parts[1] || 0);
    }
    if (parts.length === 1 && !isNaN(parts[0])) {
      return parts[0];
    }
    return 0;
  };

  const formatSecToTime = (totalSec: number): string => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = Math.floor(totalSec % 60);
    const pad = (n: number) => String(n).padStart(2, "0");
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  const startSec = parseTimeToSec(startStr);
  const parsedEndSec = parseTimeToSec(endStr);
  const endSec = totalDurationSec > 0 ? Math.min(totalDurationSec, parsedEndSec) : parsedEndSec;
  const trimmedDuration = Math.max(0, endSec - startSec);

  useEffect(() => {
    onChange({
      enabled,
      startTimeSec: startSec,
      endTimeSec: endSec > startSec ? endSec : (totalDurationSec || endSec)
    });
  }, [enabled, startStr, endStr, totalDurationSec]);

  return (
    <div className="flex flex-col gap-2.5 bg-white/[0.025] border border-white/10 rounded-2xl p-3 mb-3">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-zinc-200 tracking-wide">
          Media Range Mode:
        </span>
        <div className="inline-flex bg-zinc-900 p-0.5 rounded-lg border border-white/10">
          <button
            type="button"
            onClick={() => setEnabled(false)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
              !enabled
                ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Full Media
          </button>
          <button
            type="button"
            onClick={() => setEnabled(true)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
              enabled
                ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Trimmed Media
          </button>
        </div>
      </div>

      {enabled && (
        <div className="flex flex-col gap-2 pt-2 border-t border-dashed border-white/10">
          <div className="flex gap-2.5 items-center">
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-[10px] text-zinc-400 font-medium">Start Time (mm:ss)</span>
              <input
                type="text"
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
                placeholder="00:00"
                className="bg-zinc-950 border border-white/15 rounded-lg text-zinc-100 px-2 py-1 text-xs font-mono text-center outline-none focus:border-violet-500/50"
              />
            </div>
            <span className="text-sm text-zinc-500 mt-4">→</span>
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-[10px] text-zinc-400 font-medium">End Time (mm:ss)</span>
              <input
                type="text"
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
                placeholder="01:30"
                className="bg-zinc-950 border border-white/15 rounded-lg text-zinc-100 px-2 py-1 text-xs font-mono text-center outline-none focus:border-violet-500/50"
              />
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-purple-300 font-medium">
            <span>✂️ Trim Active</span>
            <span>Duration: {formatSecToTime(trimmedDuration)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
