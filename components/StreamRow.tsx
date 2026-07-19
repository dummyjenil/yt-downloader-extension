import React from "react";

interface StreamRowProps {
  label: string;
  meta: string;
  isDownloading: boolean;
  onDownload: () => void;
}

export const StreamRow: React.FC<StreamRowProps> = ({
  label,
  meta,
  isDownloading,
  onDownload
}) => {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.015] hover:bg-white/[0.06] border border-white/10 hover:border-white/20 transition-all group">
      <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-2">
        <span className="text-xs font-semibold text-zinc-100 truncate">{label}</span>
        <span className="text-[10px] text-zinc-400 truncate">{meta}</span>
      </div>
      <button
        onClick={onDownload}
        disabled={isDownloading}
        title="Download Stream"
        className="w-8 h-8 rounded-lg bg-white/[0.03] group-hover:bg-white/10 border border-white/10 group-hover:border-white/20 text-zinc-200 flex items-center justify-center transition-all disabled:opacity-50 active:scale-95 shrink-0"
      >
        {isDownloading ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="animate-spin text-violet-400"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        )}
      </button>
    </div>
  );
};
