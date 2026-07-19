import React from "react";

export const Placeholder: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-10 px-2 text-center text-zinc-400">
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mb-4 opacity-40 text-violet-400"
      >
        <path d="M23 7 16 12 23 17 23 7z" />
        <rect x="1" y="5" width="15" height="14" rx="3" ry="3" />
      </svg>
      <span className="text-sm font-semibold text-zinc-200 mb-1">
        Ready to download
      </span>
      <span className="text-xs text-zinc-500 leading-relaxed max-w-[240px]">
        Open a YouTube video or paste a link above to fetch high-speed streams locally.
      </span>
    </div>
  );
};
