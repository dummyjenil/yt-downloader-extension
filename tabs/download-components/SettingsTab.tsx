import React, { useState, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import { themes, type ThemeId } from "../../styles/themeConfig";
import { isFFmpegInstalled, downloadFFmpeg } from "../../utils/ffmpeg-helper";

interface SettingsTabProps {
  chunkSize: number;
  concurrency: number;
  maxConcurrentJobs: number;
  saveMode?: "directory" | "browser";
  defaultDirName: string | null;
  handleSelectDirectory: () => void;
  handleClearDirectory: () => void;
  updateSetting: (key: "chunkSize" | "concurrency" | "maxConcurrentJobs" | "saveMode", val: any) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  chunkSize,
  concurrency,
  maxConcurrentJobs,
  saveMode = "directory",
  defaultDirName,
  handleSelectDirectory,
  handleClearDirectory,
  updateSetting
}) => {
  const { theme, themeConfig, setTheme } = useTheme();

  const [status, setStatus] = useState<"not_installed" | "downloading" | "installed" | "error">("not_installed");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isFFmpegInstalled().then((installed) => {
      if (installed) {
        setStatus("installed");
        setProgress(100);
      } else {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(["ffmpeg_status", "ffmpeg_progress", "ffmpeg_error"], (res) => {
            if (res.ffmpeg_status) {
              setStatus(res.ffmpeg_status as any);
              setProgress((res.ffmpeg_progress as number) || 0);
              setError((res.ffmpeg_error as string) || null);
            }
          });
        }
      }
    });

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === "local") {
        if (changes.ffmpeg_status) {
          setStatus(changes.ffmpeg_status.newValue as any);
        }
        if (changes.ffmpeg_progress) {
          setProgress(changes.ffmpeg_progress.newValue as number);
        }
        if (changes.ffmpeg_error) {
          setError((changes.ffmpeg_error.newValue as string) || null);
        }
      }
    };

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }
  }, []);

  const handleDownloadTrigger = async () => {
    setStatus("downloading");
    setProgress(0);
    setError(null);
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        ffmpeg_status: "downloading",
        ffmpeg_progress: 0,
        ffmpeg_error: ""
      });
    }

    try {
      await downloadFFmpeg("0.12.10", (pct) => {
        setProgress(pct);
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ ffmpeg_progress: pct });
        }
      });
      setStatus("installed");
      setProgress(100);
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ ffmpeg_status: "installed", ffmpeg_progress: 100 });
      }
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      const errMsg = err.message || "Failed to download and store FFmpeg.";
      setError(errMsg);
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          ffmpeg_status: "error",
          ffmpeg_error: errMsg
        });
      }
    }
  };

  return (
    <div className={`${themeConfig.card} ${themeConfig.radius} p-8 ${themeConfig.shadow}`}>
      <h2 className="text-2xl font-extrabold mb-6">Extension Settings</h2>

      {/* Save Mode Selector */}
      <div className="mb-7">
        <label className="block text-sm font-bold mb-2">
          File Storage & Save Mode
        </label>
        <p className={`text-xs ${themeConfig.mutedText} mb-3 leading-relaxed`}>
          Choose how downloaded files are written to disk.
        </p>
        <div className="flex flex-col gap-2 max-w-lg">
          <label className={`flex items-start gap-3 p-3 ${themeConfig.input} ${themeConfig.radius} cursor-pointer select-none`}>
            <input
              type="radio"
              name="saveMode"
              value="directory"
              checked={saveMode === "directory"}
              onChange={() => updateSetting("saveMode", "directory")}
              className="mt-0.5 accent-violet-500 w-4 h-4 cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold">1. Direct Folder Save (File System API)</span>
              <span className={`text-[11px] ${themeConfig.mutedText} mt-0.5`}>
                Saves directly into your selected custom folder without opening save popups.
              </span>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-3 ${themeConfig.input} ${themeConfig.radius} cursor-pointer select-none`}>
            <input
              type="radio"
              name="saveMode"
              value="browser"
              checked={saveMode === "browser"}
              onChange={() => updateSetting("saveMode", "browser")}
              className="mt-0.5 accent-violet-500 w-4 h-4 cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold">2. Browser Anchor Download (Chrome Downloads)</span>
              <span className={`text-[11px] ${themeConfig.mutedText} mt-0.5`}>
                Downloads directly via Chrome's download manager into your default Downloads folder without prompt popups.
              </span>
            </div>
          </label>
        </div>
      </div>

      <hr className={`border-t ${themeConfig.border} my-6`} />

      {/* Visual Theme Picker */}
      <div className="mb-7">
        <label className="block text-sm font-bold mb-2">
          Visual UI Theme
        </label>
        <p className={`text-xs ${themeConfig.mutedText} mb-3 leading-relaxed`}>
          Customize the aesthetic theme across the extension popup and full dashboard page.
        </p>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemeId)}
          className={`${themeConfig.input} ${themeConfig.radius} p-3 text-sm w-full max-w-sm outline-none font-bold cursor-pointer`}
        >
          {Object.values(themes).map((t) => (
            <option key={t.id} value={t.id} className="bg-zinc-900 text-zinc-100 py-1">
              {t.name} - {t.description}
            </option>
          ))}
        </select>
      </div>

      <hr className={`border-t ${themeConfig.border} my-6`} />

      {/* Default Folder Access */}
      <div className="mb-7">
        <label className="block text-sm font-bold mb-2">
          Default Download Folder
        </label>
        <p className={`text-xs ${themeConfig.mutedText} mb-3 leading-relaxed`}>
          Choose a default directory handle for Direct Folder Save mode.
        </p>
        <div className="flex gap-3 items-center">
          <button
            onClick={handleSelectDirectory}
            className={`${themeConfig.primaryBtn} ${themeConfig.radius} px-5 py-2.5 text-xs font-bold transition-all cursor-pointer`}
          >
            {defaultDirName ? "Change Folder" : "Select Default Folder"}
          </button>
          {defaultDirName && (
            <button
              onClick={handleClearDirectory}
              className={`${themeConfig.dangerBtn} ${themeConfig.radius} px-4 py-2.5 text-xs font-bold transition-all cursor-pointer`}
            >
              Clear
            </button>
          )}
        </div>
        {defaultDirName && (
          <div className={`mt-3 text-xs ${themeConfig.accentText} font-semibold`}>
            Active Folder: <span className="underline">{defaultDirName}</span>
          </div>
        )}
      </div>

      <hr className={`border-t ${themeConfig.border} my-6`} />

      {/* Chunk Size */}
      <div className="mb-7">
        <label className="block text-sm font-bold mb-2">
          Download Chunk Size
        </label>
        <p className={`text-xs ${themeConfig.mutedText} mb-3 leading-relaxed`}>
          Adjusting this can improve speed depending on your connection. Larger chunk size uses slightly more memory buffering but makes fewer network requests.
        </p>
        <select
          value={chunkSize}
          onChange={(e) => updateSetting("chunkSize", parseInt(e.target.value, 10))}
          className={`${themeConfig.input} ${themeConfig.radius} p-3 text-sm w-full max-w-xs outline-none font-bold cursor-pointer`}
        >
          <option value={1 * 1024 * 1024} className="bg-zinc-900 text-zinc-100">1 MB</option>
          <option value={2 * 1024 * 1024} className="bg-zinc-900 text-zinc-100">2 MB</option>
          <option value={5 * 1024 * 1024} className="bg-zinc-900 text-zinc-100">5 MB (Default)</option>
          <option value={10 * 1024 * 1024} className="bg-zinc-900 text-zinc-100">10 MB</option>
          <option value={15 * 1024 * 1024} className="bg-zinc-900 text-zinc-100">15 MB</option>
          <option value={20 * 1024 * 1024} className="bg-zinc-900 text-zinc-100">20 MB</option>
        </select>
      </div>

      {/* Concurrency settings */}
      <div className="mb-7">
        <label className="block text-sm font-bold mb-2">
          Parallel Chunk Fetches
        </label>
        <p className={`text-xs ${themeConfig.mutedText} mb-3 leading-relaxed`}>
          Number of chunks to fetch simultaneously. Higher values speed up download but can trigger YouTube rate-limiting.
        </p>
        <select
          value={concurrency}
          onChange={(e) => updateSetting("concurrency", parseInt(e.target.value, 10))}
          className={`${themeConfig.input} ${themeConfig.radius} p-3 text-sm w-full max-w-xs outline-none font-bold cursor-pointer`}
        >
          <option value={1} className="bg-zinc-900 text-zinc-100">1 (Sequential)</option>
          <option value={2} className="bg-zinc-900 text-zinc-100">2 Parallel Chunks</option>
          <option value={3} className="bg-zinc-900 text-zinc-100">3 Parallel Chunks (Recommended)</option>
          <option value={5} className="bg-zinc-900 text-zinc-100">5 Parallel Chunks (Fast)</option>
          <option value={8} className="bg-zinc-900 text-zinc-100">8 Parallel Chunks (Aggressive)</option>
        </select>
      </div>

      <hr className={`border-t ${themeConfig.border} my-6`} />

      {/* Max Concurrent Jobs */}
      <div className="mb-7">
        <label className="block text-sm font-bold mb-2">
          Max Parallel Video Downloads (Batch Size)
        </label>
        <p className={`text-xs ${themeConfig.mutedText} mb-3 leading-relaxed`}>
          Control how many videos in a playlist download in parallel. Other videos will wait in queue automatically.
        </p>
        <select
          value={maxConcurrentJobs}
          onChange={(e) => updateSetting("maxConcurrentJobs", parseInt(e.target.value, 10))}
          className={`${themeConfig.input} ${themeConfig.radius} p-3 text-sm w-full max-w-xs outline-none font-bold cursor-pointer`}
        >
          {[1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
            <option key={num} value={num} className="bg-zinc-900 text-zinc-100">{num} {num === 1 ? "video" : "videos"}</option>
          ))}
        </select>
      </div>

      <hr className={`border-t ${themeConfig.border} my-6`} />

      {/* FFmpeg Integration Status */}
      <div className="mb-3">
        <label className="block text-sm font-bold mb-2">
          FFmpeg Integration (Required for HD Merging)
        </label>
        <p className={`text-xs ${themeConfig.mutedText} mb-3 leading-relaxed`}>
          FFmpeg is used at runtime to fuse high-definition adaptive video with audio tracks. To avoid bulkier extension packages, it is downloaded and installed locally on demand.
        </p>

        <div className={`flex flex-col gap-3 ${themeConfig.card} ${themeConfig.radius} p-4 border ${themeConfig.border}`}>
          <div className="flex justify-between items-center">
            <span className={`text-xs ${themeConfig.mutedText} font-semibold`}>Status:</span>
            <span
              className={`text-xs font-bold px-3 py-1 ${themeConfig.radius} ${
                status === "installed"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : status === "downloading"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
              }`}
            >
              {status === "installed"
                ? "Ready / Installed"
                : status === "downloading"
                ? `Downloading (${progress}%)`
                : "Not Installed"}
            </span>
          </div>

          {error && (
            <div className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
              Error: {error}
            </div>
          )}

          {status === "downloading" && (
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <button
            onClick={handleDownloadTrigger}
            disabled={status === "downloading"}
            className={`self-start ${
              status === "installed" ? themeConfig.secondaryBtn : themeConfig.primaryBtn
            } ${themeConfig.radius} px-4 py-2 text-xs font-bold transition-all cursor-pointer disabled:opacity-50`}
          >
            {status === "installed" ? "Reinstall FFmpeg" : "Download & Install FFmpeg"}
          </button>
        </div>
      </div>
    </div>
  );
};
