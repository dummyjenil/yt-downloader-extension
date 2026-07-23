import React from "react"

import { useTheme } from "../../context/ThemeContext"

interface HeaderProps {
  activeTab: "downloads" | "settings" | "history"
  setActiveTab: (tab: "downloads" | "settings" | "history") => void
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const { themeConfig } = useTheme()

  return (
    <header
      className={`flex items-center justify-between px-8 py-5 border-b ${themeConfig.border} sticky top-0 z-50 backdrop-blur-md`}>
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_12px_#f43f5e]" />
        <span className="text-xl font-extrabold bg-gradient-to-r from-rose-500 via-purple-400 to-violet-400 bg-clip-text text-transparent tracking-tight">
          YTD Premium Dashboard
        </span>
        <span className={`${themeConfig.badge} ml-2 font-bold uppercase`}>
          {themeConfig.name}
        </span>
      </div>

      <nav className={`flex gap-2 ${themeConfig.navContainer}`}>
        {[
          { id: "downloads", label: "Active Downloads" },
          { id: "settings", label: "Settings" },
          { id: "history", label: "History" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-2 text-sm font-bold ${themeConfig.radius} transition-all cursor-pointer ${
              activeTab === tab.id
                ? themeConfig.navTabActive
                : themeConfig.navTabInactive
            }`}>
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
