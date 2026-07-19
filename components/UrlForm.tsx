import React from "react";
import { useTheme } from "../context/ThemeContext";

interface UrlFormProps {
  urlInput: string;
  setUrlInput: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}

export const UrlForm: React.FC<UrlFormProps> = ({
  urlInput,
  setUrlInput,
  onSubmit,
  loading
}) => {
  const { themeConfig } = useTheme();

  return (
    <form onSubmit={onSubmit} className="flex gap-2.5 mb-5">
      <input
        type="text"
        placeholder="Paste YouTube Link or Watch URL..."
        value={urlInput}
        onChange={(e) => setUrlInput(e.target.value)}
        className={`flex-1 ${themeConfig.input} ${themeConfig.radius} px-4 py-3 text-sm transition-all disabled:opacity-50`}
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading}
        className={`${themeConfig.primaryBtn} ${themeConfig.radius} px-5 py-3 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading ? "Fetching..." : "Fetch"}
      </button>
    </form>
  );
};
