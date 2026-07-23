import React from "react";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { usePlaylistManager } from "./playlist-hooks/usePlaylistManager";
import { PlaylistHeader } from "./playlist-components/PlaylistHeader";
import { PlaylistItemRow } from "./playlist-components/PlaylistItemRow";
import "../styles/globals.css";

function PlaylistPageContent() {
  const { themeConfig } = useTheme();

  const {
    playlistId,
    setPlaylistId,
    playlistDetails,
    items,
    loading,
    error,
    defaultDirName,
    dirPermission,
    globalPreset,
    batchStarting,
    fetchPlaylist,
    handleSelectDirectory,
    handleClearDirectory,
    toggleSelectAll,
    updateItem,
    applyGlobalPreset,
    startBatchDownload
  } = usePlaylistManager();

  const selectedCount = items.filter((i) => i.selected).length;

  return (
    <div className={`min-h-screen font-sans ${themeConfig.container} transition-colors duration-200 p-6 sm:p-10 box-border m-0`}>
      <div className="max-w-6xl mx-auto">
        {/* Navigation & Direct Input Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <span className="text-lg font-black tracking-tight text-white">
              YouTube Playlist Batch Manager
            </span>
          </div>

          {/* Manual Playlist URL Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (playlistId) fetchPlaylist(playlistId);
            }}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <input
              type="text"
              placeholder="Paste Playlist URL or ID..."
              value={playlistId || ""}
              onChange={(e) => setPlaylistId(e.target.value)}
              className={`flex-1 sm:w-80 ${themeConfig.input} ${themeConfig.radius} px-3.5 py-2 text-xs font-semibold outline-none`}
            />
            <button
              type="submit"
              disabled={loading}
              className={`py-2 px-4 text-xs font-bold ${themeConfig.radius} ${themeConfig.primaryBtn} cursor-pointer disabled:opacity-50`}
            >
              Load Playlist
            </button>
          </form>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className={`flex flex-col items-center justify-center py-20 ${themeConfig.mutedText} font-bold text-sm`}>
            <div className="w-10 h-10 border-4 border-white/10 border-t-violet-400 rounded-full animate-spin mb-4"></div>
            <span>Fetching YouTube Playlist Videos...</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-sm font-bold text-center mb-6">
            <div>{error}</div>
            <button
              onClick={() => playlistId && fetchPlaylist(playlistId)}
              className={`mt-4 ${themeConfig.dangerBtn} ${themeConfig.radius} px-5 py-2 text-xs font-black cursor-pointer`}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loaded Playlist Batch View */}
        {!loading && playlistDetails && (
          <>
            <PlaylistHeader
              playlistTitle={playlistDetails.title}
              playlistAuthor={playlistDetails.author}
              videoCount={items.length}
              selectedCount={selectedCount}
              defaultDirName={defaultDirName}
              dirPermission={dirPermission}
              globalPreset={globalPreset}
              batchStarting={batchStarting}
              onSelectDirectory={handleSelectDirectory}
              onClearDirectory={handleClearDirectory}
              onToggleSelectAll={toggleSelectAll}
              onApplyGlobalPreset={applyGlobalPreset}
              onStartBatchDownload={startBatchDownload}
            />

            {/* Video Items Cards Container */}
            <div className="flex flex-col gap-3">
              {items.map((item, idx) => (
                <PlaylistItemRow
                  key={item.videoId}
                  item={item}
                  index={idx}
                  onUpdate={(updates) => updateItem(item.videoId, updates)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PlaylistPage() {
  return (
    <ThemeProvider>
      <PlaylistPageContent />
    </ThemeProvider>
  );
}
