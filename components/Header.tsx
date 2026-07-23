import React from "react"

import { useTheme } from "../context/ThemeContext"

export const Header: React.FC = () => {
  const { themeConfig } = useTheme()

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-md text-sm">
          ▶
        </div>
        <div className="text-xl font-extrabold bg-gradient-to-r from-rose-500 via-purple-400 to-violet-400 bg-clip-text text-transparent tracking-tight">
          YTD Premium
        </div>
      </div>
      <div
        className={`${themeConfig.badge} px-3 py-1 text-xs font-bold tracking-wider uppercase shadow-sm`}>
        {themeConfig.name}
      </div>
    </div>
  )
}
