import React, { useEffect, useState } from "react"

import { useTheme } from "../context/ThemeContext"
import type { TrimRange } from "../types/youtube"

interface RangeSelectorProps {
  totalDurationSec: number
  onChange: (trimRange: TrimRange) => void
}

export const RangeSelector: React.FC<RangeSelectorProps> = ({
  totalDurationSec,
  onChange
}) => {
  const { themeConfig } = useTheme()
  const [enabled, setEnabled] = useState(false)
  const [startStr, setStartStr] = useState("00:00")
  const [endStr, setEndStr] = useState(() => {
    const mins = Math.floor(totalDurationSec / 60)
    const secs = totalDurationSec % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  })

  const parseTimeToSec = (str: string): number => {
    const parts = str
      .trim()
      .split(":")
      .map((p) => parseInt(p, 10))
    if (parts.length === 3) {
      return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
    }
    if (parts.length === 2) {
      return (parts[0] || 0) * 60 + (parts[1] || 0)
    }
    if (parts.length === 1 && !isNaN(parts[0])) {
      return parts[0]
    }
    return 0
  }

  const formatSecToTime = (totalSec: number): string => {
    const hrs = Math.floor(totalSec / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    const secs = Math.floor(totalSec % 60)
    const pad = (n: number) => String(n).padStart(2, "0")
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
    }
    return `${pad(mins)}:${pad(secs)}`
  }

  const startSec = parseTimeToSec(startStr)
  const parsedEndSec = parseTimeToSec(endStr)
  const endSec =
    totalDurationSec > 0
      ? Math.min(totalDurationSec, parsedEndSec)
      : parsedEndSec
  const trimmedDuration = Math.max(0, endSec - startSec)

  useEffect(() => {
    onChange({
      enabled,
      startTimeSec: startSec,
      endTimeSec: endSec > startSec ? endSec : totalDurationSec || endSec
    })
  }, [enabled, startStr, endStr, totalDurationSec])

  return (
    <div
      className={`flex flex-col gap-2.5 ${themeConfig.card} ${themeConfig.radius} p-3 mb-3 shrink-0`}>
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold tracking-wide">
          Media Range Mode:
        </span>
        <div className={`inline-flex ${themeConfig.navContainer}`}>
          <button
            type="button"
            onClick={() => setEnabled(false)}
            className={`px-3 py-1.5 text-xs font-bold ${themeConfig.radius} transition-all cursor-pointer ${
              !enabled ? themeConfig.subTabActive : themeConfig.subTabInactive
            }`}>
            Full Media
          </button>
          <button
            type="button"
            onClick={() => setEnabled(true)}
            className={`px-3 py-1.5 text-xs font-bold ${themeConfig.radius} transition-all cursor-pointer ${
              enabled ? themeConfig.subTabActive : themeConfig.subTabInactive
            }`}>
            Trimmed Media
          </button>
        </div>
      </div>

      {enabled && (
        <div
          className={`flex flex-col gap-2.5 pt-3 border-t border-dashed ${themeConfig.border}`}>
          <div className="flex gap-3 items-center">
            <div className="flex-1 flex flex-col gap-1">
              <span
                className={`text-xs ${themeConfig.mutedText} font-semibold`}>
                Start Time (mm:ss)
              </span>
              <input
                type="text"
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
                placeholder="00:00"
                className={`${themeConfig.input} ${themeConfig.radius} px-3 py-2 text-xs font-mono text-center outline-none`}
              />
            </div>
            <span
              className={`text-base ${themeConfig.mutedText} mt-5 font-bold`}>
              →
            </span>
            <div className="flex-1 flex flex-col gap-1">
              <span
                className={`text-xs ${themeConfig.mutedText} font-semibold`}>
                End Time (mm:ss)
              </span>
              <input
                type="text"
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
                placeholder="01:30"
                className={`${themeConfig.input} ${themeConfig.radius} px-3 py-2 text-xs font-mono text-center outline-none`}
              />
            </div>
          </div>
          <div
            className={`flex justify-between text-xs ${themeConfig.accentText} font-bold`}>
            <span>✂️ Trim Active</span>
            <span>Duration: {formatSecToTime(trimmedDuration)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
