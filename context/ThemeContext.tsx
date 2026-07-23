import React, { createContext, useContext, useEffect, useState } from "react"

import {
  getThemeConfig,
  type ThemeConfig,
  type ThemeId
} from "../styles/themeConfig"

interface ThemeContextType {
  theme: ThemeId
  themeConfig: ThemeConfig
  setTheme: (theme: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "glassmorphism",
  themeConfig: getThemeConfig("glassmorphism"),
  setTheme: () => {}
})

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [theme, setThemeState] = useState<ThemeId>("glassmorphism")

  useEffect(() => {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      chrome.storage.local.get(["selectedTheme"], (res) => {
        if (res.selectedTheme) {
          setThemeState(res.selectedTheme as ThemeId)
        }
      })
    }
  }, [])

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme)
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      chrome.storage.local.set({ selectedTheme: newTheme })
    }
  }

  const themeConfig = getThemeConfig(theme)

  return (
    <ThemeContext.Provider value={{ theme, themeConfig, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
