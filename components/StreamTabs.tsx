import React from "react";
import { getTabButtonStyle, themeStyles } from "../styles/theme";

interface StreamTabsProps {
  activeTab: "video" | "audio" | "adaptive";
  setActiveTab: (tab: "video" | "audio" | "adaptive") => void;
}

export const StreamTabs: React.FC<StreamTabsProps> = ({
  activeTab,
  setActiveTab
}) => {
  return (
    <div style={themeStyles.tabs}>
      <button
        onClick={() => setActiveTab("video")}
        style={getTabButtonStyle(activeTab === "video")}
      >
        Standard MP4
      </button>
      <button
        onClick={() => setActiveTab("audio")}
        style={getTabButtonStyle(activeTab === "audio")}
      >
        Audio Only
      </button>
      <button
        onClick={() => setActiveTab("adaptive")}
        style={getTabButtonStyle(activeTab === "adaptive")}
      >
        Video Only (HD)
      </button>
    </div>
  );
};
