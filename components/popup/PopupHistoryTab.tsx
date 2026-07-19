import React from "react";
import { formatBytes } from "../../utils/youtube";

interface PopupHistoryTabProps {
  historyList: any[];
  clearHistory: () => void;
}

export const PopupHistoryTab: React.FC<PopupHistoryTabProps> = ({ historyList, clearHistory }) => {
  return (
    <div className="flex flex-col gap-2.5 flex-1">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold text-zinc-200">History</h3>
        {historyList.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-rose-400 hover:text-rose-300 text-[10px] font-semibold transition-colors"
          >
            Clear All
          </button>
        )}
      </div>
      {historyList.length === 0 ? (
        <div className="py-10 text-center text-zinc-500 text-xs">
          No history found
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto no-scrollbar">
          {historyList.map((item, idx) => (
            <div
              key={idx}
              className="bg-white/[0.015] border border-white/10 rounded-xl p-2.5 flex justify-between items-center"
            >
              <div className="flex-1 overflow-hidden pr-2">
                <div className="text-xs font-semibold text-zinc-200 truncate">
                  {item.title}.{item.ext}
                </div>
                <div className="text-[9px] text-zinc-500 mt-0.5">
                  {formatBytes(item.total)}
                </div>
              </div>
              <span
                className={`text-[9px] font-semibold ${
                  item.status === "complete" ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {item.status === "complete" ? "Success" : "Failed"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
