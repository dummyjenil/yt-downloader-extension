import React from "react";
import { useTheme } from "../context/ThemeContext";

interface StreamTabsProps {
  activeTab: "video" | "audio" | "adaptive" | "fusion" | "subtitle";
  setActiveTab: (tab: "video" | "audio" | "adaptive" | "fusion" | "subtitle") => void;
}

export const StreamTabs: React.FC<StreamTabsProps> = ({
  activeTab,
  setActiveTab
}) => {
  const { themeConfig } = useTheme();

  const tabs: { id: "video" | "audio" | "adaptive" | "subtitle" | "fusion"; label: string }[] = [
    { id: "video", label: "Standard MP4" },
    { id: "audio", label: "Audio Only" },
    { id: "adaptive", label: "Video Only" },
    { id: "subtitle", label: "Subtitles (SRT)" },
    { id: "fusion", label: "Custom Fusion" }
  ];

  return (
    <div className={`flex gap-1.5 ${themeConfig.navContainer} mb-4`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex-1 py-2 text-xs font-bold ${themeConfig.radius} transition-all cursor-pointer ${activeTab === tab.id
            ? themeConfig.navTabActive
            : themeConfig.navTabInactive
            }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
