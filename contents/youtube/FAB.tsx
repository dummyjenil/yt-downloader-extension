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
    <div className="ytd-fab-container">
      <svg className="ytd-progress-ring">
        <circle 
          className="ytd-progress-ring-circle-bg" 
          cx="34" 
          cy="34" 
          r="28" 
        />
        <circle 
          className="ytd-progress-ring-circle-fg" 
          cx="34" 
          cy="34" 
          r="28" 
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <button 
        className="ytd-fab" 
        onClick={onClick} 
        title="Download Options"
      >
        {isCurrentlyDownloading && currentDownloadStatus === "downloading" ? (
          /* Pulsing download icon when download is active */
          <svg 
            viewBox="0 0 24 24" 
            style={{ animation: "spin 2.5s linear infinite" }}
          >
            <path d="M12 15V3m0 12l-4-4m4 4l4-4M5 20h14" />
          </svg>
        ) : (
          /* Standard material download icon */
          <svg viewBox="0 0 24 24">
            <path d="M12 15V3m0 12l-4-4m4 4l4-4M5 20h14" />
          </svg>
        )}
      </button>
    </div>
  );
};
