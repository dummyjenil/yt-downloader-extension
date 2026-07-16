import React, { useState } from "react";
import { useDownloadManager } from "./download-hooks/useDownloadManager";
import { Header } from "./download-components/Header";
import { ActiveDownloadsTab } from "./download-components/ActiveDownloadsTab";
import { SettingsTab } from "./download-components/SettingsTab";
import { HistoryTab } from "./download-components/HistoryTab";

export default function DownloadPage() {
  const [activeTab, setActiveTab] = useState<"downloads" | "settings" | "history">("downloads");
  
  const {
    jobList,
    chunkSize,
    concurrency,
    maxConcurrentJobs,
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
  } = useDownloadManager();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        fontFamily: "'Outfit', 'Inter', sans-serif",
        background: "linear-gradient(135deg, #09090b 0%, #121217 100%)",
        color: "#f4f4f5",
        margin: 0,
        padding: "0"
      }}
    >
      {/* Hidden FFmpeg Sandbox Iframe */}
      <iframe
        id="ffmpeg-sandbox"
        src="sandbox.html"
        style={{ display: "none" }}
      />

      {/* Premium Navigation Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          maxWidth: "800px",
          width: "100%",
          margin: "40px auto",
          padding: "0 20px",
          boxSizing: "border-box"
        }}
      >
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
            defaultDirName={defaultDirName}
            handleSelectDirectory={handleSelectDirectory}
            handleClearDirectory={handleClearDirectory}
            updateSetting={updateSetting}
          />
        )}

        {activeTab === "history" && (
          <HistoryTab
            historyList={historyList}
            clearHistory={clearHistory}
          />
        )}
      </main>
    </div>
  );
}
