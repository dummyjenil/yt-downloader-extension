import React from "react";
import { themeStyles } from "../styles/theme";

export const Placeholder: React.FC = () => {
  return (
    <div style={themeStyles.placeholder}>
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ marginBottom: "16px", opacity: 0.4 }}
      >
        <path d="M23 7 16 12 23 17 23 7z" />
        <rect x="1" y="5" width="15" height="14" rx="3" ry="3" />
      </svg>
      <span style={{ fontSize: "14px", fontWeight: 600, marginBottom: "6px" }}>
        Ready to download
      </span>
      <span style={{ fontSize: "12px", opacity: 0.6, lineHeight: "1.4", maxWidth: "240px" }}>
        Open a YouTube video or paste a link above to fetch high-speed streams locally.
      </span>
    </div>
  );
};
