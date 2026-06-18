import React from "react";

interface PlaylistDetailCardProps {
  playlistInfo: {
    thumbnail: string;
    title: string;
    author: string;
    totalVideos: number;
  };
}

export const PlaylistDetailCard: React.FC<PlaylistDetailCardProps> = ({ playlistInfo }) => {
  return (
    <div className="ytd-detail-card">
      <img 
        className="ytd-thumb" 
        src={playlistInfo.thumbnail} 
        alt="Playlist Thumbnail" 
      />
      <div className="ytd-detail-meta">
        <span className="ytd-meta-title">{playlistInfo.title}</span>
        <span className="ytd-meta-channel">{playlistInfo.author}</span>
        <span className="ytd-duration-badge" style={{ backgroundColor: "rgba(244, 63, 94, 0.1)", color: "#fda4af", borderColor: "rgba(244, 63, 94, 0.2)" }}>
          {playlistInfo.totalVideos} Videos
        </span>
      </div>
    </div>
  );
};
