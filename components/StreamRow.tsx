import React from "react";
import { useTheme } from "../context/ThemeContext";

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
  const { themeConfig } = useTheme();

  return (
    <div className={`flex items-center justify-between p-3.5 ${themeConfig.radius} ${themeConfig.card} transition-all`}>
      <div className="flex flex-col gap-1 flex-1 min-w-0 pr-3">
        <span className="text-sm font-bold truncate">{label}</span>
        <span className={`text-xs ${themeConfig.mutedText} truncate`}>{meta}</span>
      </div>
      <button
        onClick={onDownload}
        disabled={isDownloading}
        title="Download Stream"
        className={`w-10 h-10 ${themeConfig.radius} ${themeConfig.primaryBtn} flex items-center justify-center transition-all disabled:opacity-50 shrink-0 cursor-pointer`}
      >
        {isDownloading ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="animate-spin"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
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
