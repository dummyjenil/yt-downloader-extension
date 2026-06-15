import React from "react";
import { themeStyles } from "../styles/theme";

export const Header: React.FC = () => {
  return (
    <div style={themeStyles.header}>
      <div style={themeStyles.logo}>YTD Premium</div>
      <div style={themeStyles.badge}>Local-First</div>
    </div>
  );
};
