import React from "react";
import { useTheme } from "../../context/ThemeContext";
import { formatBytes } from "../../utils/youtube";

interface PopupDashboardTabProps {
  activeDownloads: any[];
}

export const PopupDashboardTab: React.FC<PopupDashboardTabProps> = ({ activeDownloads }) => {
  const { themeConfig } = useTheme();

  return (
    <div className="flex flex-col gap-3 flex-1">
      <h3 className="text-sm font-bold">Active Downloads</h3>
      {activeDownloads.length === 0 ? (
        <div className={`py-12 text-center ${themeConfig.mutedText} text-xs font-medium`}>
          No active downloads running
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-h-[460px] overflow-y-auto no-scrollbar">
          {activeDownloads.map((job) => (
            <div key={job.id} className={`${themeConfig.card} ${themeConfig.radius} p-3.5 shadow-lg`}>
              <div className="flex justify-between items-center gap-2 mb-2">
                <span className="text-xs font-bold truncate flex-1">
                  {job.title}.{job.ext}
                </span>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => {
                      if (typeof chrome !== "undefined" && chrome.runtime) {
                        chrome.runtime.sendMessage({
                          type: job.status === "paused" ? "RESUME_DOWNLOAD" : "PAUSE_DOWNLOAD",
                          id: job.id
                        });
                      }
                    }}
                    className={`text-sm px-2 py-0.5 ${themeConfig.radius} ${
                      job.status === "paused" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                    } hover:scale-105 transition-transform cursor-pointer font-bold`}
                  >
                    {job.status === "paused" ? "▶ Resume" : "⏸ Pause"}
                  </button>
                  <button
                    onClick={() => {
                      if (typeof chrome !== "undefined" && chrome.runtime) {
                        chrome.runtime.sendMessage({ type: "CANCEL_DOWNLOAD", id: job.id });
                      }
                    }}
                    className={`text-sm px-2 py-0.5 ${themeConfig.radius} bg-rose-500/20 text-rose-300 hover:scale-105 transition-transform cursor-pointer font-bold`}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className={`w-full bg-white/5 rounded-full h-2 overflow-hidden my-2 border ${themeConfig.border}`}>
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    job.status === "paused"
                      ? "bg-amber-400"
                      : "bg-gradient-to-r from-rose-500 to-violet-500"
                  }`}
                  style={{ width: `${job.percent}%` }}
                />
              </div>
              <div className={`flex justify-between text-xs ${themeConfig.mutedText} mt-1 font-medium`}>
                <span>{job.status === "paused" ? "Paused" : `${formatBytes(job.speed)}/s`}</span>
                <span className="font-bold">{job.percent}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
