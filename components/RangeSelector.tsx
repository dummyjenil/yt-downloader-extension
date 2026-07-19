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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        background: "rgba(255, 255, 255, 0.025)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "14px",
        padding: "12px 14px",
        marginBottom: "12px"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#e4e4e7", letterSpacing: "0.4px" }}>
          Media Range Mode:
        </span>
        <div
          style={{
            display: "inline-flex",
            background: "#18181b",
            borderRadius: "8px",
            padding: "2px",
            border: "1px solid rgba(255, 255, 255, 0.1)"
          }}
        >
          <button
            type="button"
            onClick={() => setEnabled(false)}
            style={{
              background: !enabled ? "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)" : "transparent",
              color: !enabled ? "#ffffff" : "#a1a1aa",
              border: "none",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            Full Media
          </button>
          <button
            type="button"
            onClick={() => setEnabled(true)}
            style={{
              background: enabled ? "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)" : "transparent",
              color: enabled ? "#ffffff" : "#a1a1aa",
              border: "none",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            Trimmed Media
          </button>
        </div>
      </div>

      {enabled && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginTop: "2px",
            paddingTop: "8px",
            borderTop: "1px dashed rgba(255, 255, 255, 0.08)"
          }}
        >
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "10px", color: "#a1a1aa", fontWeight: 500 }}>Start Time (mm:ss)</span>
              <input
                type="text"
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
                placeholder="00:00"
                style={{
                  background: "#09090b",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "8px",
                  color: "#f4f4f5",
                  padding: "6px 8px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  outline: "none",
                  textAlign: "center"
                }}
              />
            </div>
            <span style={{ fontSize: "14px", color: "#71717a", marginTop: "16px" }}>→</span>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "10px", color: "#a1a1aa", fontWeight: 500 }}>End Time (mm:ss)</span>
              <input
                type="text"
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
                placeholder="01:30"
                style={{
                  background: "#09090b",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "8px",
                  color: "#f4f4f5",
                  padding: "6px 8px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  outline: "none",
                  textAlign: "center"
                }}
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#c084fc" }}>
            <span>✂️ Trim Active</span>
            <span>Duration: {formatSecToTime(trimmedDuration)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
