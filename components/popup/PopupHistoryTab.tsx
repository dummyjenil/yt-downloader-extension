import React from "react"

import { useTheme } from "../../context/ThemeContext"
import { formatBytes } from "../../utils/youtube"

interface PopupHistoryTabProps {
  historyList: any[]
  clearHistory: () => void
}

export const PopupHistoryTab: React.FC<PopupHistoryTabProps> = ({
  historyList,
  clearHistory
}) => {
  const { themeConfig } = useTheme()

  return (
    <div className="flex flex-col gap-3 flex-1">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold">Download History</h3>
        {historyList.length > 0 && (
          <button
            onClick={clearHistory}
            className={`${themeConfig.dangerBtn} ${themeConfig.radius} px-3 py-1 text-xs font-bold transition-all cursor-pointer`}>
            Clear All
          </button>
        )}
      </div>
      {historyList.length === 0 ? (
        <div
          className={`py-12 text-center ${themeConfig.mutedText} text-xs font-medium`}>
          No history found
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 max-h-[460px] overflow-y-auto no-scrollbar">
          {historyList.map((item, idx) => (
            <div
              key={idx}
              className={`${themeConfig.card} ${themeConfig.radius} p-3 flex justify-between items-center`}>
              <div className="flex-1 overflow-hidden pr-3">
                <div className="text-xs font-bold truncate">
                  {item.title}.{item.ext}
                </div>
                <div
                  className={`text-[10px] ${themeConfig.mutedText} mt-0.5 font-medium`}>
                  {formatBytes(item.total)}
                </div>
              </div>
              <span
                className={`text-xs font-extrabold px-2.5 py-1 ${themeConfig.radius} ${
                  item.status === "complete"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-rose-500/20 text-rose-300"
                }`}>
                {item.status === "complete" ? "Success" : "Failed"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
