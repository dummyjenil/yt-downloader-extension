export interface PlaylistVideoItem {
  videoId: string
  title: string
  author: string
  lengthSeconds: string
  thumbnail: string
  url: string
}

export interface PlaylistDetails {
  playlistId: string
  title: string
  author: string
  videoCount: number
  videos: PlaylistVideoItem[]
}

export async function fetchPlaylistDetails(
  playlistId: string
): Promise<PlaylistDetails> {
  if (!playlistId) throw new Error("Invalid playlist ID")

  const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`
  const response = await fetch(playlistUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9"
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch playlist page. HTTP ${response.status}`)
  }

  const html = await response.text()
  const match =
    html.match(/var ytInitialData\s*=\s*({.+?});<\/script>/) ||
    html.match(/ytInitialData\s*=\s*({.+?});var /) ||
    html.match(/ytInitialData\s*=\s*({.+?});/)

  if (!match || !match[1]) {
    throw new Error("Could not parse playlist initial data from YouTube page")
  }

  const data = JSON.parse(match[1])

  const sidebar = data?.sidebar?.playlistSidebarRenderer?.items || []
  let playlistTitle = "YouTube Playlist"
  let playlistAuthor = "YouTube Channel"

  for (const item of sidebar) {
    const primary = item?.playlistSidebarPrimaryInfoRenderer
    if (primary && primary.title) {
      playlistTitle =
        primary.title.runs?.[0]?.text ||
        primary.title.simpleText ||
        playlistTitle
    }
    const secondary = item?.playlistSidebarSecondaryInfoRenderer
    if (secondary && secondary.owner) {
      playlistAuthor =
        secondary.owner.videoOwnerRenderer?.title?.runs?.[0]?.text ||
        playlistAuthor
    }
  }

  const videoItems: PlaylistVideoItem[] = []
  const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || []

  for (const tab of tabs) {
    const contents =
      tab?.tabRenderer?.content?.sectionListRenderer?.contents || []
    for (const section of contents) {
      const items =
        section?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer
          ?.contents || []
      for (const item of items) {
        const renderer = item?.playlistVideoRenderer
        if (!renderer || !renderer.videoId) continue

        const videoId = renderer.videoId
        const title =
          renderer.title?.runs?.[0]?.text ||
          renderer.title?.simpleText ||
          "YouTube Video"
        const author =
          renderer.shortBylineText?.runs?.[0]?.text || playlistAuthor
        const lengthSeconds = renderer.lengthSeconds || "0"
        const thumbnail =
          renderer.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
          `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

        videoItems.push({
          videoId,
          title,
          author,
          lengthSeconds,
          thumbnail,
          url: `https://www.youtube.com/watch?v=${videoId}`
        })
      }
    }
  }

  return {
    playlistId,
    title: playlistTitle,
    author: playlistAuthor,
    videoCount: videoItems.length,
    videos: videoItems
  }
}
