import { useEffect, useState } from "react"

import {
  clearDirectoryHandle,
  getDirectoryHandle,
  storeDirectoryHandle
} from "../utils/storage"

export type SaveMode = "directory" | "browser"

export function useSettings() {
  const [chunkSize, setChunkSizeState] = useState<number>(5 * 1024 * 1024)
  const [concurrency, setConcurrencyState] = useState<number>(3)
  const [saveMode, setSaveModeState] = useState<SaveMode>("directory")
  const [defaultDirName, setDefaultDirName] = useState<string | null>(null)

  useEffect(() => {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      chrome.storage.local.get(
        ["chunkSize", "concurrency", "saveMode"],
        (res) => {
          if (res.chunkSize) setChunkSizeState(res.chunkSize as number)
          if (res.concurrency) setConcurrencyState(res.concurrency as number)
          if (res.saveMode) setSaveModeState(res.saveMode as SaveMode)
        }
      )
    }

    getDirectoryHandle()
      .then((handle) => {
        if (handle) setDefaultDirName(handle.name)
      })
      .catch(console.error)
  }, [])

  const setChunkSize = (val: number) => {
    setChunkSizeState(val)
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      chrome.storage.local.set({ chunkSize: val })
    }
  }

  const setConcurrency = (val: number) => {
    setConcurrencyState(val)
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      chrome.storage.local.set({ concurrency: val })
    }
  }

  const setSaveMode = (val: SaveMode) => {
    setSaveModeState(val)
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      chrome.storage.local.set({ saveMode: val })
    }
  }

  const handleSelectDirectory = async () => {
    try {
      if (!(window as any).showDirectoryPicker) {
        alert(
          "Your browser does not support directory picking. Please use Google Chrome."
        )
        return
      }
      const handle = await (window as any).showDirectoryPicker({
        mode: "readwrite"
      })
      await storeDirectoryHandle(handle)
      setDefaultDirName(handle.name)
      setSaveMode("directory")
    } catch (err: any) {
      console.error(err)
      alert("Failed to select directory: " + err.message)
    }
  }

  const handleClearDirectory = async () => {
    await clearDirectoryHandle()
    setDefaultDirName(null)
  }

  return {
    chunkSize,
    setChunkSize,
    concurrency,
    setConcurrency,
    saveMode,
    setSaveMode,
    defaultDirName,
    handleSelectDirectory,
    handleClearDirectory
  }
}
