// Helper for storing and retrieving the directory handle using IndexedDB.
// Directory Handles from the File System Access API are serializable and can be stored in IndexedDB.

const DB_NAME = "ytd_settings_db"
const STORE_NAME = "handles"
const KEY_DIR_HANDLE = "default_dir_handle"

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function storeDirectoryHandle(
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    store.put(handle, KEY_DIR_HANDLE)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(KEY_DIR_HANDLE)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function clearDirectoryHandle(): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    store.delete(KEY_DIR_HANDLE)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
