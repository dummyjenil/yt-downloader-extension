import React from "react";
import { formatBytes } from "../../utils/youtube";

interface ActiveDownloadsProps {
  activeJobs: any[];
}

export const ActiveDownloads: React.FC<ActiveDownloadsProps> = ({ activeJobs }) => {
  if (activeJobs.length === 0) return null;

  return (
    <div className="mt-5 pt-4 border-t border-white/10 font-sans">
      <h4 className="m-0 mb-3 text-xs font-bold text-violet-400 uppercase tracking-wider">
        Active Downloads ({activeJobs.length})
      </h4>
      <div className="flex flex-col gap-2.5 max-h-40 overflow-y-auto no-scrollbar">
        {activeJobs.map((job) => (
          <div key={job.id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold text-zinc-200 truncate max-w-[70%]">
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
                  className={`bg-none border-none cursor-pointer p-0 flex items-center hover:scale-110 transition-transform ${
                    job.status === "paused" ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {job.status === "paused" ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="4" y="4" width="4" height="16" />
                      <rect x="16" y="4" width="4" height="16" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => {
                    chrome.runtime.sendMessage({ type: "CANCEL_DOWNLOAD", id: job.id });
                  }}
                  className="bg-none border-none text-rose-500 cursor-pointer p-0 flex items-center hover:scale-110 transition-transform"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
            <div className="w-full bg-white/5 rounded-full h-[3.5px] overflow-hidden my-1">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${job.percent}%`,
                  background: job.status === "paused" ? "#fbbf24" : "linear-gradient(90deg, #f43f5e 0%, #8b5cf6 100%)"
                }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-zinc-400">
              <span>
                {job.status === "paused" ? "Paused" : `${formatBytes(job.speed)}/s`}
              </span>
              <span>{job.percent}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
