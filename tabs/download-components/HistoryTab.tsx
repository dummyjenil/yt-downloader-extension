import React from "react"

import { useTheme } from "../../context/ThemeContext"
import { formatBytes } from "../../utils/youtube"

interface HistoryTabProps {
  historyList: any[]
  clearHistory: () => void
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  historyList,
  clearHistory
}) => {
  const { themeConfig } = useTheme()

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-extrabold m-0">Download History</h2>
        {historyList.length > 0 && (
          <button
            onClick={clearHistory}
            className={`${themeConfig.dangerBtn} ${themeConfig.radius} px-4 py-2 text-xs font-bold transition-all cursor-pointer`}>
            Clear History
          </button>
        )}
      </div>

      {historyList.length === 0 ? (
        <div
          className={`text-center py-16 px-6 ${themeConfig.card} ${themeConfig.radius} border-dashed ${themeConfig.mutedText}`}>
          <p className="m-0 text-sm font-semibold">
            No download history recorded
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {historyList.map((item, index) => (
            <div
              key={index}
              className={`${themeConfig.card} ${themeConfig.radius} p-4 flex justify-between items-center shadow-sm`}>
              <div>
                <h5 className="m-0 text-sm font-bold">
                  {item.title}.{item.ext}
                </h5>
                <span
                  className={`text-xs ${themeConfig.mutedText} mt-1 inline-block font-medium`}>
                  {formatBytes(item.total)} •{" "}
                  {new Date(item.timestamp).toLocaleString()}
                </span>
              </div>

              <div>
                {item.status === "complete" ? (
                  <span
                    className={`bg-emerald-500/20 text-emerald-300 ${themeConfig.radius} px-3 py-1 text-xs font-bold border border-emerald-500/30`}>
                    Success
                  </span>
                ) : (
                  <span
                    className={`bg-rose-500/20 text-rose-300 ${themeConfig.radius} px-3 py-1 text-xs font-bold border border-rose-500/30`}
                    title={item.error}>
                    Failed
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
