import React, { useEffect, useState } from "react";
import "./styles/globals.css";

import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { useVideoInfo } from "./hooks/useVideoInfo";
import { useDownloads } from "./hooks/useDownloads";
import { useSettings } from "./hooks/useSettings";

// UI Components
import { Header } from "./components/Header";
import { UrlForm } from "./components/UrlForm";
import { VideoDetails } from "./components/VideoDetails";
import { StreamTabs } from "./components/StreamTabs";
import { StreamRow } from "./components/StreamRow";
import { CustomFusionSelector } from "./components/CustomFusionSelector";
import { RangeSelector } from "./components/RangeSelector";
import { Placeholder } from "./components/Placeholder";

// Sub Tabs
import { PopupDashboardTab } from "./components/popup/PopupDashboardTab";
import { PopupSettingsTab } from "./components/popup/PopupSettingsTab";
import { PopupHistoryTab } from "./components/popup/PopupHistoryTab";

function PopupContent() {
  const { themeConfig } = useTheme();

  // Navigation tab for popup
  const [navTab, setNavTab] = useState<"streams" | "dashboard" | "settings" | "history">("streams");

  // Custom Hooks encapsulating business & state logic strictly
  const {
    urlInput,
    setUrlInput,
    loading,
    error,
    videoInfo,
    activeTab,
    setActiveTab,
    trimRange,
    setTrimRange,
    handleManualSubmit
  } = useVideoInfo();

  const {
    downloads,
    activeDownloads,
    historyList,
    handleDownload,
    clearHistory
  } = useDownloads();

  const {
    chunkSize,
    setChunkSize,
    concurrency,
    setConcurrency,
    saveMode,
    setSaveMode,
    defaultDirName,
    handleSelectDirectory,
    handleClearDirectory
  } = useSettings();

  // Load Outfit Google Font
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  return (
    <div className={`w-[500px] min-h-[580px] max-h-[660px] ${themeConfig.container} font-sans p-6 flex flex-col overflow-y-auto no-scrollbar box-border transition-colors duration-200`}>
      {/* App Header */}
      <Header />

      {/* Primary Navigation Bar */}
      <div className={`flex gap-1.5 ${themeConfig.navContainer} mb-5`}>
        {[
          { id: "streams", label: "Extractor" },
          { id: "dashboard", label: `Downloads ${activeDownloads.length > 0 ? `(${activeDownloads.length})` : ""}` },
          { id: "settings", label: "Settings" },
          { id: "history", label: "History" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setNavTab(tab.id as any)}
            className={`flex-1 py-2 text-xs font-bold ${themeConfig.radius} transition-all cursor-pointer ${navTab === tab.id
                ? themeConfig.navTabActive
                : themeConfig.navTabInactive
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* RENDER TAB VIEWS */}
      {navTab === "streams" && (
        <>
          <UrlForm
            urlInput={urlInput}
            setUrlInput={setUrlInput}
            onSubmit={handleManualSubmit}
            loading={loading}
          />

          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={`animate-spin ${themeConfig.accentText} mb-3`}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
              </svg>
              <span className={`text-xs ${themeConfig.mutedText} font-semibold`}>Extracting media streams...</span>
            </div>
          )}

          {error && (
            <div className="text-xs text-rose-400 leading-relaxed p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl mb-4 font-semibold">
              {error}
            </div>
          )}

          {videoInfo && (
            <>
              <VideoDetails videoInfo={videoInfo} />

              <RangeSelector
                totalDurationSec={parseInt(videoInfo.lengthSeconds || "0", 10)}
                onChange={(range) => setTrimRange(range)}
              />

              <StreamTabs activeTab={activeTab} setActiveTab={setActiveTab} />

              {activeTab === "fusion" && (
                <CustomFusionSelector
                  videoInfo={videoInfo}
                  downloads={downloads}
                  trimRange={trimRange || undefined}
                  handleDownload={(vStream, cat, aStream, subs) => {
                    handleDownload(videoInfo, vStream, cat, trimRange, aStream, subs, () => setNavTab("dashboard"));
                  }}
                />
              )}

              <div className="flex flex-col gap-2.5">
                {activeTab === "video" &&
                  videoInfo.formats.map((stream) => (
                    <StreamRow
                      key={stream.itag}
                      label={`MP4 Video (${stream.qualityLabel || "Progressive"})`}
                      meta={`${stream.contentLength ? `${(parseInt(stream.contentLength) / 1024 / 1024).toFixed(1)} MB` : "Unknown Size"} • Video + Audio`}
                      isDownloading={downloads.some(d => d.url === stream.url && (d.status === "downloading" || d.status === "paused"))}
                      onDownload={() =>
                        handleDownload(videoInfo, stream, "video", trimRange, undefined, undefined, () => setNavTab("dashboard"))
                      }
                    />
                  ))}

                {activeTab === "audio" &&
                  videoInfo.adaptiveFormats
                    .filter((f) => f.mimeType.startsWith("audio/"))
                    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
                    .map((stream, idx) => {
                      const isOpus = stream.mimeType.includes("opus");
                      const ext = isOpus ? "webm" : "m4a";
                      const kbps = Math.round((stream.bitrate || 0) / 1000);
                      const sizeMb = stream.contentLength ? (parseInt(stream.contentLength) / 1024 / 1024).toFixed(1) : "?";
                      const langLabel = stream.displayName || (stream.langCode ? `[${stream.langCode.toUpperCase()}]` : "");
                      const titleLabel = langLabel ? `${langLabel} • ${ext.toUpperCase()} Audio (${kbps} kbps)` : `${ext.toUpperCase()} Audio (${kbps} kbps)`;
                      const defaultTag = stream.isDefaultAudio ? " (Default)" : "";

                      return (
                        <StreamRow
                          key={`${stream.itag}_${stream.audioTrackId || stream.langCode || idx}`}
                          label={`${titleLabel}${defaultTag}`}
                          meta={`${sizeMb} MB • ${isOpus ? "Opus" : "AAC"}${stream.audioTrackId ? ` • Track: ${stream.audioTrackId}` : ""}`}
                          isDownloading={downloads.some(d => d.url === stream.url && (d.status === "downloading" || d.status === "paused"))}
                          onDownload={() =>
                            handleDownload(videoInfo, stream, "audio", trimRange, undefined, undefined, () => setNavTab("dashboard"))
                          }
                        />
                      );
                    })}

                {activeTab === "adaptive" &&
                  videoInfo.adaptiveFormats
                    .filter((f) => f.mimeType.startsWith("video/"))
                    .sort((a, b) => {
                      const qa = parseInt(a.qualityLabel || "0", 10);
                      const qb = parseInt(b.qualityLabel || "0", 10);
                      return qb - qa;
                    })
                    .map((stream) => {
                      const isWebm = stream.mimeType.includes("webm");
                      const sizeMb = stream.contentLength ? (parseInt(stream.contentLength) / 1024 / 1024).toFixed(1) : "?";
                      return (
                        <StreamRow
                          key={stream.itag}
                          label={`${isWebm ? "WEBM" : "MP4"} Video (${stream.qualityLabel})`}
                          meta={`${sizeMb} MB • Video Only`}
                          isDownloading={downloads.some(d => d.url === stream.url && (d.status === "downloading" || d.status === "paused"))}
                          onDownload={() =>
                            handleDownload(videoInfo, stream, "adaptive", trimRange, undefined, undefined, () => setNavTab("dashboard"))
                          }
                        />
                      );
                    })}
              </div>
            </>
          )}

          {!videoInfo && !loading && <Placeholder />}
        </>
      )}

      {navTab === "dashboard" && (
        <PopupDashboardTab activeDownloads={activeDownloads} />
      )}

      {navTab === "settings" && (
        <PopupSettingsTab
          defaultDirName={defaultDirName}
          chunkSize={chunkSize}
          concurrency={concurrency}
          saveMode={saveMode}
          handleSelectDirectory={handleSelectDirectory}
          handleClearDirectory={handleClearDirectory}
          setChunkSize={setChunkSize}
          setConcurrency={setConcurrency}
          setSaveMode={setSaveMode}
        />
      )}

      {navTab === "history" && (
        <PopupHistoryTab historyList={historyList} clearHistory={clearHistory} />
      )}
    </div>
  );
}

function IndexPopup() {
  return (
    <ThemeProvider>
      <PopupContent />
    </ThemeProvider>
  );
}

export default IndexPopup;
