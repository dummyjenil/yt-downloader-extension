import React from "react";
import { useTheme } from "../../context/ThemeContext";
import { formatBytes } from "../../utils/youtube";

interface ActiveDownloadsProps {
  activeJobs: any[];
}

export const ActiveDownloads: React.FC<ActiveDownloadsProps> = ({ activeJobs }) => {
  const { themeConfig } = useTheme();

  if (activeJobs.length === 0) return null;

  return (
    <div className={`mt-6 pt-5 border-t ${themeConfig.border} font-sans`}>
      <h4 className={`m-0 mb-3.5 text-xs font-extrabold ${themeConfig.accentText} uppercase tracking-wider`}>
        Active Downloads ({activeJobs.length})
      </h4>
      <div className="flex flex-col gap-3 max-h-48 overflow-y-auto no-scrollbar">
        {activeJobs.map((job) => (
          <div key={job.id} className={`${themeConfig.card} ${themeConfig.radius} p-3.5 shadow-md`}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-extrabold truncate max-w-[70%]">
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
                  className={`bg-none border-none cursor-pointer p-0 flex items-center hover:scale-110 transition-transform ${
                    job.status === "paused" ? "text-emerald-400" : "text-amber-400"
                  }`}
                  title={job.status === "paused" ? "Resume" : "Pause"}
                >
                  {job.status === "paused" ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="4" y="4" width="4" height="16" />
                      <rect x="16" y="4" width="4" height="16" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (typeof chrome !== "undefined" && chrome.runtime) {
                      chrome.runtime.sendMessage({ type: "CANCEL_DOWNLOAD", id: job.id });
                    }
                  }}
                  className="bg-none border-none text-rose-500 cursor-pointer p-0 flex items-center hover:scale-110 transition-transform"
                  title="Cancel"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
            <div className={`w-full bg-white/5 rounded-full h-2 overflow-hidden my-2 border ${themeConfig.border}`}>
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  job.status === "paused" ? "bg-amber-400" : "bg-gradient-to-r from-rose-500 to-violet-500"
                }`}
                style={{
                  width: `${job.percent}%`
                }}
              />
            </div>
            <div className={`flex justify-between text-xs ${themeConfig.mutedText} font-semibold`}>
              <span>
                {job.status === "paused" ? "Paused" : `${formatBytes(job.speed)}/s`}
              </span>
              <span className="font-extrabold">{job.percent}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
