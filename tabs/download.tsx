import React, { useState } from "react"

import { ThemeProvider, useTheme } from "../context/ThemeContext"
import { ActiveDownloadsTab } from "./download-components/ActiveDownloadsTab"
import { Header } from "./download-components/Header"
import { HistoryTab } from "./download-components/HistoryTab"
import { SettingsTab } from "./download-components/SettingsTab"
import { useDownloadManager } from "./download-hooks/useDownloadManager"

import "../styles/globals.css"

function DownloadPageContent() {
  const [activeTab, setActiveTab] = useState<
    "downloads" | "settings" | "history"
  >("downloads")
  const { themeConfig } = useTheme()

  const {
    jobList,
    chunkSize,
    concurrency,
    maxConcurrentJobs,
    saveMode,
    defaultDirName,
    dirPermission,
    historyList,
    clearJob,
    requestDirPermission,
    handleSelectDirectory,
    handleClearDirectory,
    startSetup,
    pauseJob,
    resumeJob,
    cancelJob,
    clearHistory,
    updateSetting
  } = useDownloadManager()

  return (
    <div
      className={`flex flex-col min-h-screen font-sans ${themeConfig.container} transition-colors duration-200 m-0 p-0`}>
      {/* Hidden FFmpeg Sandbox Iframe */}
      <iframe id="ffmpeg-sandbox" src="sandbox.html" className="hidden" />

      {/* Premium Navigation Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full my-10 mx-auto px-6 box-border">
        {activeTab === "downloads" && (
          <ActiveDownloadsTab
            jobList={jobList}
            defaultDirName={defaultDirName}
            dirPermission={dirPermission}
            requestDirPermission={requestDirPermission}
            startSetup={startSetup}
            pauseJob={pauseJob}
            resumeJob={resumeJob}
            cancelJob={cancelJob}
            clearJob={clearJob}
            maxConcurrentJobs={maxConcurrentJobs}
            updateSetting={updateSetting}
          />
        )}

        {activeTab === "settings" && (
          <SettingsTab
            chunkSize={chunkSize}
            concurrency={concurrency}
            maxConcurrentJobs={maxConcurrentJobs}
            saveMode={saveMode}
            defaultDirName={defaultDirName}
            handleSelectDirectory={handleSelectDirectory}
            handleClearDirectory={handleClearDirectory}
            updateSetting={updateSetting}
          />
        )}

        {activeTab === "history" && (
          <HistoryTab historyList={historyList} clearHistory={clearHistory} />
        )}
      </main>
    </div>
  )
}

export default function DownloadPage() {
  return (
    <ThemeProvider>
      <DownloadPageContent />
    </ThemeProvider>
  )
}
