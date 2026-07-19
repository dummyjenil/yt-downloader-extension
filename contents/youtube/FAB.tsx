import React from "react";

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
  return (
    <div className="fixed bottom-6 right-6 w-[68px] h-[68px] z-[999999] flex items-center justify-center font-sans">
      <svg className="absolute top-0 left-0 w-[68px] h-[68px] -rotate-90 pointer-events-none">
        <circle
          className="fill-transparent stroke-white/10 stroke-[3.5px]"
          cx="34"
          cy="34"
          r="28"
        />
        <circle
          className="fill-transparent stroke-violet-500 stroke-[3.5px] stroke-round transition-all duration-150"
          cx="34"
          cy="34"
          r="28"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <button
        onClick={onClick}
        title="Download Options"
        className="absolute w-[54px] h-[54px] rounded-full bg-gradient-to-r from-rose-500 to-red-600 hover:scale-105 active:scale-95 text-white flex items-center justify-center border-none cursor-pointer shadow-lg shadow-rose-600/40 transition-all p-0"
      >
        {isCurrentlyDownloading && currentDownloadStatus === "downloading" ? (
          <svg
            className="w-5 h-5 animate-spin text-white"
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
            className="w-5 h-5 text-white"
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
