import type { JobState } from "./types";

export async function fetchChunkWithRetry(
  job: JobState,
  chunkIdx: number,
  totalChunks: number,
  size: number
): Promise<ArrayBuffer | null> {
  const start = chunkIdx * size;
  const end = Math.min((chunkIdx + 1) * size, job.totalSize) - 1;

  let chunkUrl = job.url;
  if (chunkUrl.includes("range=")) {
    chunkUrl = chunkUrl.replace(/([?&])range=[^&]*/, `$1range=${start}-${end}`);
  } else {
    const sep = chunkUrl.includes("?") ? "&" : "?";
    chunkUrl = `${chunkUrl}${sep}range=${start}-${end}`;
  }
  if (!chunkUrl.includes("ext_download=true")) {
    const sep = chunkUrl.includes("?") ? "&" : "?";
    chunkUrl = `${chunkUrl}${sep}ext_download=true`;
  }

  let attempt = 0;
  const maxAttempts = 5;

  while (attempt < maxAttempts) {
    if (job.paused || job.cancelled) return null;

    try {
      const response = await fetch(chunkUrl);
      if (!response.ok) throw new Error(`HTTP Status ${response.status}`);
      return await response.arrayBuffer();
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) throw err;
      const delay = 500 * Math.pow(2, attempt - 1); // exponential backoff
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

export async function fetchAudioChunkWithRetry(
  job: JobState,
  chunkIdx: number,
  totalChunks: number,
  size: number
): Promise<ArrayBuffer | null> {
  if (!job.audioUrl) return null;
  const start = chunkIdx * size;
  const end = Math.min((chunkIdx + 1) * size, job.audioSize || 0) - 1;

  let chunkUrl = job.audioUrl;
  if (chunkUrl.includes("range=")) {
    chunkUrl = chunkUrl.replace(/([?&])range=[^&]*/, `$1range=${start}-${end}`);
  } else {
    const sep = chunkUrl.includes("?") ? "&" : "?";
    chunkUrl = `${chunkUrl}${sep}range=${start}-${end}`;
  }
  if (!chunkUrl.includes("ext_download=true")) {
    const sep = chunkUrl.includes("?") ? "&" : "?";
    chunkUrl = `${chunkUrl}${sep}ext_download=true`;
  }

  let attempt = 0;
  const maxAttempts = 5;

  while (attempt < maxAttempts) {
    if (job.paused || job.cancelled) return null;

    try {
      const response = await fetch(chunkUrl);
      if (!response.ok) throw new Error(`HTTP Status ${response.status}`);
      return await response.arrayBuffer();
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) throw err;
      const delay = 500 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

export async function downloadRangeInParallel(
  url: string,
  rangeStart: number,
  rangeEnd: number,
  chunkSize: number,
  concurrency: number,
  job: JobState,
  onProgress?: (addedBytes: number) => void
): Promise<Uint8Array> {
  const totalSize = rangeEnd - rangeStart + 1;
  const totalChunks = Math.ceil(totalSize / chunkSize);
  const chunks = new Map<number, Uint8Array>();

  let launched = 0;
  const activeFetches = new Set<number>();

  return new Promise<Uint8Array>((resolve, reject) => {
    const checkNext = () => {
      if (job.paused || job.cancelled) {
        reject(new Error("Job paused or cancelled."));
        return;
      }

      if (chunks.size === totalChunks) {
        const result = new Uint8Array(totalSize);
        let offset = 0;
        for (let i = 0; i < totalChunks; i++) {
          const c = chunks.get(i)!;
          result.set(c, offset);
          offset += c.byteLength;
        }
        resolve(result);
        return;
      }

      while (activeFetches.size < concurrency && launched < totalChunks) {
        const chunkIdx = launched++;
        activeFetches.add(chunkIdx);

        const start = rangeStart + chunkIdx * chunkSize;
        const end = Math.min(rangeStart + (chunkIdx + 1) * chunkSize - 1, rangeEnd);

        let chunkUrl = url;
        if (chunkUrl.includes("range=")) {
          chunkUrl = chunkUrl.replace(/([?&])range=[^&]*/, `$1range=${start}-${end}`);
        } else {
          const sep = chunkUrl.includes("?") ? "&" : "?";
          chunkUrl = `${chunkUrl}${sep}range=${start}-${end}`;
        }
        if (!chunkUrl.includes("ext_download=true")) {
          const sep = chunkUrl.includes("?") ? "&" : "?";
          chunkUrl = `${chunkUrl}${sep}ext_download=true`;
        }

        (async () => {
          let attempt = 0;
          const maxAttempts = 5;
          while (attempt < maxAttempts) {
            if (job.paused || job.cancelled) throw new Error("Job paused or cancelled.");
            try {
              const res = await fetch(chunkUrl);
              if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
              const ab = await res.arrayBuffer();
              return new Uint8Array(ab);
            } catch (err) {
              attempt++;
              if (attempt >= maxAttempts) throw err;
              await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
            }
          }
          throw new Error(`Failed to download range chunk ${chunkIdx}`);
        })()
          .then((buf) => {
            activeFetches.delete(chunkIdx);
            chunks.set(chunkIdx, buf);
            if (onProgress) onProgress(buf.byteLength);
            checkNext();
          })
          .catch((err) => {
            activeFetches.delete(chunkIdx);
            reject(err);
          });
      }
    };

    checkNext();
  });
}
