import React from "react";

interface PopupSettingsTabProps {
  defaultDirName: string | null;
  chunkSize: number;
  concurrency: number;
  handleSelectDirectory: () => void;
  handleClearDirectory: () => void;
  setChunkSize: (val: number) => void;
  setConcurrency: (val: number) => void;
}

export const PopupSettingsTab: React.FC<PopupSettingsTabProps> = ({
  defaultDirName,
  chunkSize,
  concurrency,
  handleSelectDirectory,
  handleClearDirectory,
  setChunkSize,
  setConcurrency
}) => {
  return (
    <div className="flex flex-col gap-3.5 flex-1">
      <h3 className="text-xs font-bold text-zinc-200">Settings</h3>

      {/* Directory Access */}
      <div>
        <span className="text-xs font-semibold text-zinc-300 block mb-1.5">
          Default Folder
        </span>
        <div className="flex gap-2 items-center">
          <button
            onClick={handleSelectDirectory}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl px-3 py-1.5 text-xs font-semibold shadow-md transition-all active:scale-95"
          >
            {defaultDirName ? "Change" : "Choose Folder"}
          </button>
          {defaultDirName && (
            <button
              onClick={handleClearDirectory}
              className="bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 rounded-xl px-3 py-1.5 text-xs font-medium transition-all"
            >
              Clear
            </button>
          )}
        </div>
        {defaultDirName && (
          <span className="text-[10px] text-violet-300 mt-1 block truncate">
            Saving directly to: {defaultDirName}
          </span>
        )}
      </div>

      {/* Chunk Size Selector */}
      <div>
        <span className="text-xs font-semibold text-zinc-300 block mb-1.5">
          Chunk Size
        </span>
        <select
          value={chunkSize}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            setChunkSize(val);
            chrome.storage.local.set({ chunkSize: val });
          }}
          className="bg-zinc-900 border border-white/10 rounded-xl text-zinc-100 p-2 text-xs w-full outline-none focus:border-violet-500/50 cursor-pointer"
        >
          <option value={1 * 1024 * 1024}>1 MB</option>
          <option value={2 * 1024 * 1024}>2 MB</option>
          <option value={5 * 1024 * 1024}>5 MB (Default)</option>
          <option value={10 * 1024 * 1024}>10 MB</option>
          <option value={20 * 1024 * 1024}>20 MB</option>
        </select>
      </div>

      {/* Concurrency limit */}
      <div>
        <span className="text-xs font-semibold text-zinc-300 block mb-1.5">
          Parallel Chunk Fetches
        </span>
        <select
          value={concurrency}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            setConcurrency(val);
            chrome.storage.local.set({ concurrency: val });
          }}
          className="bg-zinc-900 border border-white/10 rounded-xl text-zinc-100 p-2 text-xs w-full outline-none focus:border-violet-500/50 cursor-pointer"
        >
          <option value={1}>1 (Sequential)</option>
          <option value={2}>2 Parallel Chunks</option>
          <option value={3}>3 Parallel Chunks</option>
          <option value={5}>5 Parallel Chunks</option>
        </select>
      </div>
    </div>
  );
};
