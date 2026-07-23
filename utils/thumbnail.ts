export async function fetchVideoThumbnailBuffer(videoId: string): Promise<Uint8Array | null> {
  if (!videoId) return null;

  const urls = [
    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const ab = await response.arrayBuffer();
        if (ab.byteLength > 1000) { // Ensure valid image payload
          return new Uint8Array(ab);
        }
      }
    } catch (_) {}
  }
  return null;
}
