export class DownloadDB {
  private dbName = "ytd_downloads";
  private storeName = "chunks";
  private db: IDBDatabase | null = null;

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveChunk(downloadId: string, chunkIndex: number, data: ArrayBuffer): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const key = `${downloadId}_${chunkIndex}`;
      const request = store.put(data, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getChunks(downloadId: string, totalChunks: number): Promise<ArrayBuffer[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readonly");
      const store = transaction.objectStore(this.storeName);
      const chunks: ArrayBuffer[] = [];
      let loaded = 0;
      let failed = false;

      for (let i = 0; i < totalChunks; i++) {
        const key = `${downloadId}_${i}`;
        const request = store.get(key);
        request.onsuccess = () => {
          if (failed) return;
          chunks[i] = request.result as ArrayBuffer;
          loaded++;
          if (loaded === totalChunks) {
            resolve(chunks);
          }
        };
        request.onerror = () => {
          failed = true;
          reject(request.error);
        };
      }
    });
  }

  async clearDownload(downloadId: string, totalChunks: number): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      let deleted = 0;
      let failed = false;
      
      for (let i = 0; i < totalChunks; i++) {
        const key = `${downloadId}_${i}`;
        const request = store.delete(key);
        request.onsuccess = () => {
          if (failed) return;
          deleted++;
          if (deleted === totalChunks) resolve();
        };
        request.onerror = () => {
          failed = true;
          reject(request.error);
        };
      }
    });
  }
}
