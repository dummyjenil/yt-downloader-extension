import React from "react";

interface StreamTabsProps {
  activeTab: "video" | "audio" | "adaptive" | "fusion" | "subtitle";
  setActiveTab: (tab: "video" | "audio" | "adaptive" | "fusion" | "subtitle") => void;
}

export const StreamTabs: React.FC<StreamTabsProps> = ({
  activeTab,
  setActiveTab
}) => {
  const tabs: { id: "video" | "audio" | "adaptive" | "subtitle" | "fusion"; label: string }[] = [
    { id: "video", label: "Standard MP4" },
    { id: "audio", label: "Audio Only" },
    { id: "adaptive", label: "Video Only (HD)" },
    { id: "subtitle", label: "Subtitles (SRT)" },
    { id: "fusion", label: "Custom Fusion" }
  ];

  return (
    <div className="flex gap-1.5 mb-3.5 bg-white/[0.02] p-1 rounded-xl border border-white/10 overflow-x-auto no-scrollbar">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setActiveTab(t.id)}
          className={`flex-1 min-w-[70px] py-1.5 px-2 text-[10px] font-semibold rounded-lg transition-all text-center whitespace-nowrap ${
            activeTab === t.id
              ? "bg-white/10 text-violet-300 border border-violet-500/30 shadow-sm"
              : "text-zinc-400 border border-transparent hover:text-zinc-200 hover:bg-white/[0.03]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
};
