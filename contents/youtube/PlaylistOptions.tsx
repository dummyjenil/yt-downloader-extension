import React from "react";

interface PlaylistOptionsProps {
  playlistInfo: {
    videos: any[];
    title: string;
    author: string;
  };
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  sortOption: "default" | "title-asc" | "title-desc" | "duration-asc" | "duration-desc";
  setSortOption: (val: "default" | "title-asc" | "title-desc" | "duration-asc" | "duration-desc") => void;
  selectedVideoIds: Set<string>;
  setSelectedVideoIds: (ids: Set<string>) => void;
  rangeStart: string;
  setRangeStart: (val: string) => void;
  rangeEnd: string;
  setRangeEnd: (val: string) => void;
  playlistBatchSize: number;
  setPlaylistBatchSize: (val: number) => void;
  handlePlaylistDownload: () => void;
}

export const PlaylistOptions: React.FC<PlaylistOptionsProps> = ({
  playlistInfo,
  searchQuery,
  sortOption,
  setSortOption,
  selectedVideoIds,
  setSelectedVideoIds,
  rangeStart,
  setRangeStart,
  rangeEnd,
  setRangeEnd,
  playlistBatchSize,
  setPlaylistBatchSize,
  handlePlaylistDownload
}) => {
  return (
    <>
      {/* Search & Sort Toolbar */}
      <div className="ytd-playlist-toolbar">
        <input
          type="text"
          className="ytd-playlist-search"
          placeholder="Search videos in playlist..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="ytd-playlist-sort"
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as any)}
        >
          <option value="default">Default Index</option>
          <option value="title-asc">Title: A-Z</option>
          <option value="title-desc">Title: Z-A</option>
          <option value="duration-asc">Duration: Shortest</option>
          <option value="duration-desc">Duration: Longest</option>
        </select>
      </div>

      {/* Selection Bar */}
      <div className="ytd-playlist-selection-bar">
        <span>Selected: {selectedVideoIds.size} / {playlistInfo.videos.length}</span>
        <div className="ytd-playlist-btn-group">
          <button className="ytd-playlist-text-btn" onClick={() => setSelectedVideoIds(new Set(playlistInfo.videos.map((v: any) => v.videoId)))}>
            Select All
          </button>
          <button className="ytd-playlist-text-btn" onClick={() => setSelectedVideoIds(new Set())}>
            Select None
          </button>
          <button className="ytd-playlist-text-btn" onClick={() => {
            const newSelection = new Set<string>();
            playlistInfo.videos.forEach((v: any) => {
              if (!selectedVideoIds.has(v.videoId)) {
                newSelection.add(v.videoId);
              }
            });
            setSelectedVideoIds(newSelection);
          }}>
            Invert
          </button>
        </div>
      </div>

      {/* Range Selection Bar */}
      <div className="ytd-playlist-range-bar">
        <span>Select Range:</span>
        <input
          type="number"
          min="1"
          max={playlistInfo.videos.length}
          className="ytd-playlist-range-input"
          value={rangeStart}
          onChange={(e) => setRangeStart(e.target.value)}
        />
        <span>to</span>
        <input
          type="number"
          min="1"
          max={playlistInfo.videos.length}
          className="ytd-playlist-range-input"
          value={rangeEnd}
          onChange={(e) => setRangeEnd(e.target.value)}
        />
        <button className="ytd-playlist-range-btn" onClick={() => {
          const start = Math.max(1, parseInt(rangeStart, 10)) - 1;
          const end = Math.min(playlistInfo.videos.length, parseInt(rangeEnd, 10)) - 1;
          if (isNaN(start) || isNaN(end) || start > end) return;

          const newSelection = new Set(selectedVideoIds);
          for (let i = start; i <= end; i++) {
            const video = playlistInfo.videos[i];
            if (video) newSelection.add(video.videoId);
          }
          setSelectedVideoIds(newSelection);
        }}>
          Select Range
        </button>
      </div>

      {/* Videos Scrollable List */}
      <div className="ytd-stream-list" style={{ maxHeight: "180px", gap: "6px" }}>
        {(() => {
          const filtered = playlistInfo.videos.filter((video: any) => {
            const titleMatch = video.title.toLowerCase().includes(searchQuery.toLowerCase());
            const authorMatch = video.author.toLowerCase().includes(searchQuery.toLowerCase());
            return titleMatch || authorMatch;
          });

          const sorted = [...filtered].sort((a: any, b: any) => {
            if (sortOption === "title-asc") return a.title.localeCompare(b.title);
            if (sortOption === "title-desc") return b.title.localeCompare(a.title);
            if (sortOption === "duration-asc") return (a.lengthSeconds || 0) - (b.lengthSeconds || 0);
            if (sortOption === "duration-desc") return (b.lengthSeconds || 0) - (a.lengthSeconds || 0);
            return 0;
          });

          if (sorted.length === 0) {
            return <div style={{ textAlign: "center", padding: "20px", color: "#71717a", fontSize: "12px" }}>No videos match search query</div>;
          }

          return sorted.map((video: any) => {
            const isSelected = selectedVideoIds.has(video.videoId);
            const originalIndex = playlistInfo.videos.findIndex((v: any) => v.videoId === video.videoId) + 1;
            return (
              <div key={video.videoId} className={`ytd-playlist-video-item ${isSelected ? "selected" : ""}`}>
                <input
                  type="checkbox"
                  className="ytd-playlist-checkbox"
                  checked={isSelected}
                  onChange={() => {
                    const newSelection = new Set(selectedVideoIds);
                    if (isSelected) {
                      newSelection.delete(video.videoId);
                    } else {
                      newSelection.add(video.videoId);
                    }
                    setSelectedVideoIds(newSelection);
                  }}
                />
                <span style={{ fontSize: "10px", color: "#71717a", width: "16px", textAlign: "right" }}>{originalIndex}</span>
                <img className="ytd-playlist-video-thumb" src={video.thumbnail} alt="" />
                <div className="ytd-playlist-video-details">
                  <span className="ytd-playlist-video-title" title={video.title}>{video.title}</span>
                  <span className="ytd-playlist-video-meta">{video.author} • {video.duration || "0:00"}</span>
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Playlist Footer Actions */}
      <div className="ytd-playlist-footer">
        <div className="ytd-playlist-footer-info">
          <span className="ytd-playlist-selected-count">
            {selectedVideoIds.size} Selected
          </span>
          <div className="ytd-playlist-concurrency-wrapper">
            <span>Batch Concurrency:</span>
            <select
              className="ytd-playlist-concurrency-select"
              value={playlistBatchSize}
              onChange={(e) => setPlaylistBatchSize(parseInt(e.target.value, 10))}
            >
              {[1, 2, 3, 5, 8].map((num) => (
                <option key={num} value={num}>{num} parallel</option>
              ))}
            </select>
          </div>
        </div>
        <button
          className="ytd-playlist-download-btn"
          disabled={selectedVideoIds.size === 0}
          onClick={handlePlaylistDownload}
        >
          Download Batch
        </button>
      </div>
    </>
  );
};
