import React from "react";
import { useTheme } from "../../context/ThemeContext";
import type { ConfiguredPlaylistItem } from "../playlist-hooks/usePlaylistManager";
import { formatDuration } from "../../utils/youtube";

interface PlaylistItemRowProps {
  item: ConfiguredPlaylistItem;
  index: number;
  onUpdate: (updates: Partial<ConfiguredPlaylistItem>) => void;
}

export const PlaylistItemRow: React.FC<PlaylistItemRowProps> = ({
  item,
  index,
  onUpdate
}) => {
  const { themeConfig } = useTheme();

  return (
    <div
      className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 ${themeConfig.card} ${themeConfig.radius} p-4 mb-3 border ${
        item.selected ? themeConfig.border : "border-transparent"
      } shadow-md transition-all hover:border-violet-500/40`}
    >
      {/* Selection Checkbox & Index */}
      <div className="flex items-center gap-3 shrink-0">
        <input
          type="checkbox"
          checked={item.selected}
          onChange={(e) => onUpdate({ selected: e.target.checked })}
          className="accent-violet-500 cursor-pointer w-5 h-5 rounded"
        />
        <span className={`text-xs font-mono font-bold ${themeConfig.mutedText} w-6`}>
          #{index + 1}
        </span>
      </div>

      {/* Spacious Thumbnail Box */}
      <div className="relative w-full sm:w-44 h-24 shrink-0 rounded-xl overflow-hidden bg-black/40 border border-white/10 group">
        <img
          src={item.thumbnail}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute bottom-1.5 right-1.5 bg-black/85 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
          {formatDuration(item.lengthSeconds)}
        </span>
      </div>

      {/* Video Info (Title, Channel Name, Badge) */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
        <div>
          <h3 className="text-sm sm:text-base font-extrabold m-0 mb-1 leading-snug line-clamp-2 text-white hover:text-violet-300 transition-colors">
            <a href={item.url} target="_blank" rel="noreferrer" className="no-underline text-inherit">
              {item.title}
            </a>
          </h3>
          <span className={`text-xs font-bold ${themeConfig.mutedText} inline-flex items-center gap-1.5`}>
            <span>📺 {item.author}</span>
          </span>
        </div>

        {/* Feature Checkboxes (Embed Thumbnail & Chapters) */}
        <div className="flex items-center gap-4 mt-3">
          <label className="flex items-center gap-1.5 text-[11px] font-bold cursor-pointer select-none text-zinc-300 hover:text-white">
            <input
              type="checkbox"
              checked={item.embedThumbnail}
              onChange={(e) => onUpdate({ embedThumbnail: e.target.checked })}
              className="accent-violet-500 rounded cursor-pointer w-3.5 h-3.5"
            />
            <span>Cover Art</span>
          </label>

          <label className="flex items-center gap-1.5 text-[11px] font-bold cursor-pointer select-none text-zinc-300 hover:text-white">
            <input
              type="checkbox"
              checked={item.embedChapters}
              onChange={(e) => onUpdate({ embedChapters: e.target.checked })}
              className="accent-violet-500 rounded cursor-pointer w-3.5 h-3.5"
            />
            <span>Chapters</span>
          </label>
        </div>
      </div>

      {/* Per-Video Quality Dropdown & Status */}
      <div className="flex flex-col items-end gap-2 shrink-0 w-full sm:w-auto">
        <select
          value={item.formatOption}
          onChange={(e) => onUpdate({ formatOption: e.target.value as any })}
          disabled={!item.selected}
          className={`w-full sm:w-36 appearance-none ${themeConfig.input} ${themeConfig.radius} px-3 py-2 text-xs font-bold outline-none cursor-pointer disabled:opacity-40`}
        >
          <option value="1080p" className="bg-zinc-900 text-zinc-100">1080p Full HD</option>
          <option value="720p" className="bg-zinc-900 text-zinc-100">720p HD MP4</option>
          <option value="480p" className="bg-zinc-900 text-zinc-100">480p SD MP4</option>
          <option value="audio" className="bg-zinc-900 text-zinc-100">Audio Only (M4A)</option>
        </select>

        {/* Status indicator */}
        {item.status === "fetching_info" && (
          <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span> Fetching details...
          </span>
        )}
        {item.status === "queued" && (
          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Queued for Download
          </span>
        )}
        {item.status === "error" && (
          <span className="text-[11px] font-bold text-rose-400" title={item.errorMessage}>
            ⚠️ Error: {item.errorMessage || "Failed"}
          </span>
        )}
      </div>
    </div>
  );
};
