import React from "react";
import { useTheme } from "../../context/ThemeContext";

interface FABProps {
  onClick: () => void;
  isCurrentlyDownloading: boolean;
  currentDownloadStatus: string | null;
  circumference: number;
  strokeDashoffset: number;
}

export const FAB: React.FC<FABProps> = ({
  onClick,
  isCurrentlyDownloading,
  currentDownloadStatus,
  circumference,
  strokeDashoffset
}) => {
  const { themeConfig } = useTheme();

  return (
    <div className="fixed bottom-8 right-8 w-[84px] h-[84px] z-[999999] flex items-center justify-center font-sans">
      <svg className="absolute top-0 left-0 w-[84px] h-[84px] -rotate-90 pointer-events-none">
        <circle
          className="fill-transparent stroke-white/15 stroke-[4px]"
          cx="42"
          cy="42"
          r="34"
        />
        <circle
          className="fill-transparent stroke-violet-400 stroke-[4px] stroke-round transition-all duration-150"
          cx="42"
          cy="42"
          r="34"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <button
        onClick={onClick}
        title="Download YouTube Video/Audio"
        className={`absolute w-[68px] h-[68px] rounded-full ${themeConfig.primaryBtn} hover:scale-105 active:scale-95 text-white flex items-center justify-center cursor-pointer shadow-2xl transition-all p-0`}
      >
        {isCurrentlyDownloading && currentDownloadStatus === "downloading" ? (
          <svg
            className="w-7 h-7 animate-spin text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 15V3m0 12l-4-4m4 4l4-4M5 20h14" />
          </svg>
        ) : (
          <svg
            className="w-7 h-7 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 15V3m0 12l-4-4m4 4l4-4M5 20h14" />
          </svg>
        )}
      </button>
    </div>
  );
};
