import React from "react";
import { formatBytes } from "../../utils/youtube";

interface PopupDashboardTabProps {
  activeDownloads: any[];
}

export const PopupDashboardTab: React.FC<PopupDashboardTabProps> = ({ activeDownloads }) => {
  return (
    <div className="flex flex-col gap-2.5 flex-1">
      <h3 className="text-xs font-bold text-zinc-200">Active Downloads</h3>
      {activeDownloads.length === 0 ? (
        <div className="py-10 text-center text-zinc-500 text-xs">
          No active downloads running
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto no-scrollbar">
          {activeDownloads.map((job) => (
            <div key={job.id} className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-3 shadow-lg">
              <div className="flex justify-between items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold text-zinc-100 truncate flex-1">
                  {job.title}.{job.ext}
                </span>
                <div className="flex gap-1.5 items-center">
                  <button
                    onClick={() => {
                      chrome.runtime.sendMessage({
                        type: job.status === "paused" ? "RESUME_DOWNLOAD" : "PAUSE_DOWNLOAD",
                        id: job.id
                      });
                    }}
                    className={`text-xs p-0.5 hover:scale-110 transition-transform ${
                      job.status === "paused" ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {job.status === "paused" ? "▶" : "⏸"}
                  </button>
                  <button
                    onClick={() => {
                      chrome.runtime.sendMessage({ type: "CANCEL_DOWNLOAD", id: job.id });
                    }}
                    className="text-xs text-rose-500 p-0.5 hover:scale-110 transition-transform"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden my-1.5 border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    job.status === "paused"
                      ? "bg-amber-400"
                      : "bg-gradient-to-r from-rose-500 to-violet-500"
                  }`}
                  style={{ width: `${job.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                <span>{job.status === "paused" ? "Paused" : `${formatBytes(job.speed)}/s`}</span>
                <span>{job.percent}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
