import React from "react"

import { useTheme } from "../../context/ThemeContext"
import { formatBytes, formatTime } from "../../utils/youtube"
import type { JobState } from "../download-hooks/useDownloadManager"

interface ActiveDownloadsTabProps {
  jobList: JobState[]
  defaultDirName: string | null
  dirPermission: string | null
  requestDirPermission: () => void
  startSetup: (id: string) => void
  pauseJob: (id: string) => void
  resumeJob: (id: string) => void
  cancelJob: (id: string) => void
  clearJob: (id: string) => void

  maxConcurrentJobs: number
  updateSetting: (key: "maxConcurrentJobs", val: number) => void
}

export const ActiveDownloadsTab: React.FC<ActiveDownloadsTabProps> = ({
  jobList,
  defaultDirName,
  dirPermission,
  requestDirPermission,
  startSetup,
  pauseJob,
  resumeJob,
  cancelJob,
  clearJob
}) => {
  const { themeConfig } = useTheme()

  return (
    <div>
      <h2 className="text-2xl font-extrabold mb-6">Active Downloads</h2>

      {!defaultDirName && (
        <div className="flex items-center justify-between gap-4 p-5 bg-blue-500/10 border border-blue-500/30 rounded-2xl mb-6 text-sm text-blue-200 leading-relaxed">
          <div className="flex items-center gap-3">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              Default download folder is not set. Downloads will wait as{" "}
              <strong>Idle</strong>. Click <strong>Start</strong> on the job
              card to select a save location manually, or select a default
              folder in <strong>Settings</strong> for automatic downloads.
            </span>
          </div>
        </div>
      )}

      {defaultDirName && dirPermission !== "granted" && (
        <div className="flex items-center justify-between gap-4 p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl mb-6 text-sm text-amber-200 leading-relaxed">
          <div className="flex items-center gap-3">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>
              Permission is required to download files to your default folder (
              <strong>{defaultDirName}</strong>).
            </span>
          </div>
          <button
            onClick={requestDirPermission}
            className={`${themeConfig.primaryBtn} ${themeConfig.radius} px-4 py-2 text-xs font-bold whitespace-nowrap cursor-pointer`}>
            Grant Permission
          </button>
        </div>
      )}

      {jobList.length === 0 ? (
        <div
          className={`text-center py-16 px-6 ${themeConfig.card} ${themeConfig.radius} border-dashed ${themeConfig.mutedText}`}>
          <svg
            width="52"
            height="52"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="mx-auto mb-4 opacity-40">
            <path d="M12 15V3m0 12l-4-4m4 4l4-4M5 20h14" />
          </svg>
          <p className="m-0 text-base font-bold text-zinc-100">
            No active downloads running
          </p>
          <p className="mt-1 text-sm">
            Start downloading from a YouTube page to see progress here
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {jobList.map((job) => (
            <div
              key={job.id}
              className={`${themeConfig.card} ${themeConfig.radius} p-5 ${themeConfig.shadow}`}>
              <div className="flex justify-between items-start gap-4 mb-3">
                <div>
                  <h4 className="m-0 text-base font-bold leading-snug">
                    {job.title}.{job.ext}
                  </h4>
                  <span
                    className={`text-xs ${themeConfig.mutedText} mt-1 inline-block font-medium`}>
                    Total Size:{" "}
                    {job.totalSize > 0
                      ? formatBytes(job.totalSize)
                      : "Calculating..."}
                  </span>
                </div>

                {/* Controls */}
                <div className="flex gap-2 shrink-0">
                  {job.status === "idle" && (
                    <button
                      onClick={() => startSetup(job.id)}
                      className={`${themeConfig.primaryBtn} ${themeConfig.radius} px-3 py-1.5 text-xs font-bold cursor-pointer h-9`}
                      title="Start Download">
                      Start
                    </button>
                  )}
                  {job.status === "downloading" && (
                    <button
                      onClick={() => pauseJob(job.id)}
                      className={`${themeConfig.secondaryBtn} ${themeConfig.radius} w-9 h-9 flex items-center justify-center cursor-pointer`}
                      title="Pause">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor">
                        <rect x="4" y="4" width="4" height="16" />
                        <rect x="16" y="4" width="4" height="16" />
                      </svg>
                    </button>
                  )}
                  {job.status === "paused" && (
                    <button
                      onClick={() => resumeJob(job.id)}
                      className={`${themeConfig.primaryBtn} ${themeConfig.radius} w-9 h-9 flex items-center justify-center cursor-pointer`}
                      title="Resume">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  )}
                  {(job.status === "complete" || job.status === "error") && (
                    <button
                      onClick={() => clearJob(job.id)}
                      className={`${themeConfig.secondaryBtn} ${themeConfig.radius} px-3 py-1.5 text-xs font-bold cursor-pointer h-9`}
                      title="Clear">
                      Clear
                    </button>
                  )}
                  {job.status !== "complete" && job.status !== "error" && (
                    <button
                      onClick={() => cancelJob(job.id)}
                      className={`${themeConfig.dangerBtn} ${themeConfig.radius} w-9 h-9 flex items-center justify-center cursor-pointer`}
                      title="Cancel">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress details */}
              <div
                className={`flex justify-between text-xs ${themeConfig.mutedText} mb-2 font-medium`}>
                <span>
                  {job.status === "paused"
                    ? "Paused"
                    : job.status === "error"
                      ? `Error: ${job.errorMessage}`
                      : job.status === "idle"
                        ? "Waiting to start..."
                        : job.status === "complete"
                          ? "Complete"
                          : `Downloading (${formatBytes(job.downloadedBytes)} / ${formatBytes(job.totalSize)})`}
                </span>
                <span className="font-extrabold">{job.percent}%</span>
              </div>

              {/* Progress Bar */}
              <div
                className={`w-full h-2.5 bg-white/5 ${themeConfig.radius} overflow-hidden mb-3 border ${themeConfig.border}`}>
                <div
                  className={`h-full ${themeConfig.radius} transition-all duration-300 ${
                    job.status === "paused"
                      ? "bg-amber-400"
                      : job.status === "idle"
                        ? "bg-blue-500"
                        : job.status === "error"
                          ? "bg-rose-500"
                          : "bg-gradient-to-r from-rose-500 to-violet-500"
                  }`}
                  style={{ width: `${job.percent}%` }}
                />
              </div>

              {/* Meta stats: speed and ETA */}
              {job.status === "downloading" && (
                <div
                  className={`flex gap-5 text-xs ${themeConfig.mutedText} font-medium`}>
                  <span>
                    Speed:{" "}
                    <strong className="text-zinc-100">
                      {formatBytes(job.speed)}/s
                    </strong>
                  </span>
                  <span>
                    ETA:{" "}
                    <strong className="text-zinc-100">
                      {formatTime(job.eta)}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
