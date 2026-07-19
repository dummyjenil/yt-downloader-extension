import React from "react";

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
  return (
    <form onSubmit={onSubmit} className="flex gap-2 mb-4">
      <input
        type="text"
        placeholder="Paste YouTube Link..."
        value={urlInput}
        onChange={(e) => setUrlInput(e.target.value)}
        className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 hover:border-white/20 transition-all font-sans disabled:opacity-50"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-gradient-to-r from-rose-500 to-violet-600 hover:from-rose-400 hover:to-violet-500 text-white rounded-xl px-4 py-2.5 text-xs font-semibold shadow-md shadow-violet-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
      >
        {loading ? "..." : "Fetch"}
      </button>
    </form>
  );
};
