import { decipherSignature, getPlayerJsCode } from "../decipherer"
import { setDNRHeadersForClient } from "./dnr"

interface MultiLangAudioStream {
  itag: number
  url: string
  mimeType: string
  contentLength?: string
  bitrate?: number
  langCode?: string
  displayName?: string
  audioTrackId?: string
  isDefaultAudio?: boolean
  initRange?: { start: string; end: string }
  indexRange?: { start: string; end: string }
}

interface AudioLanguage {
  code: string
  name: string
  isDefault: boolean
}

interface MultiLangAudioResult {
  audioStreams: MultiLangAudioStream[]
  languages: AudioLanguage[]
  hasMultiLanguageAudio: boolean
}

function parseFormatUrl(f: any, jsCode: string): string | undefined {
  if (f.url) return f.url
  const cipherStr = f.signatureCipher || f.cipher
  if (!cipherStr) return undefined

  try {
    const params = new URLSearchParams(cipherStr)
    const rawUrl = params.get("url")
    if (!rawUrl) return undefined

    const s = params.get("s")
    const sp = params.get("sp") || "sig"

    if (s) {
      const deciphered = decipherSignature(s, jsCode)
      return `${rawUrl}&${sp}=${encodeURIComponent(deciphered)}`
    }
    return rawUrl
  } catch {
    return undefined
  }
}

async function fetchPlayerResponseFromWebpage(videoId: string): Promise<any> {
  await setDNRHeadersForClient("WEB")

  const url = `https://www.youtube.com/watch?v=${videoId}`
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9"
    },
    credentials: "include"
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube webpage: ${response.status}`)
  }

  const html = await response.text()

  const match =
    html.match(/var ytInitialPlayerResponse\s*=\s*({.+?});<\/script>/) ||
    html.match(/ytInitialPlayerResponse\s*=\s*({.+?});var /) ||
    html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/)

  if (match && match[1]) {
    return JSON.parse(match[1])
  }
  throw new Error(
    "Could not parse ytInitialPlayerResponse from YouTube webpage HTML"
  )
}

function parseAllAudioStreams(
  playerResponse: any,
  jsCode: string
): MultiLangAudioStream[] {
  const adaptiveFormats: any[] =
    playerResponse.streamingData?.adaptiveFormats || []
  const formats: any[] = playerResponse.streamingData?.formats || []
  const allFormats = [...adaptiveFormats, ...formats]

  const audioStreams: MultiLangAudioStream[] = []
  const seenKeys = new Set<string>()

  for (const fmt of allFormats) {
    if (!fmt.mimeType?.startsWith("audio/")) continue

    const track = fmt.audioTrack || {}
    const displayName = track.displayName || "Default / Original"
    const rawTrackId = track.id || "default"
    const langCode = rawTrackId !== "default" ? rawTrackId.split(".")[0] : "und"
    const isDefault = !!track.audioIsDefault

    const itag = fmt.itag
    const key = `${itag}_${langCode}_${rawTrackId}`
    if (seenKeys.has(key)) continue
    seenKeys.add(key)

    const url = parseFormatUrl(fmt, jsCode)

    audioStreams.push({
      itag,
      url,
      mimeType: fmt.mimeType,
      contentLength: fmt.contentLength,
      bitrate: fmt.bitrate,
      langCode,
      displayName,
      audioTrackId: rawTrackId,
      isDefaultAudio: isDefault,
      initRange: fmt.initRange,
      indexRange: fmt.indexRange
    })
  }

  return audioStreams.filter((s) => !!s.url)
}

function extractLanguages(
  audioStreams: MultiLangAudioStream[]
): AudioLanguage[] {
  const langMap = new Map<string, AudioLanguage>()

  for (const stream of audioStreams) {
    const code = stream.langCode || "und"
    const name = stream.displayName || "Default / Original"
    if (!langMap.has(code)) {
      langMap.set(code, {
        code,
        name,
        isDefault: !!stream.isDefaultAudio
      })
    } else if (stream.isDefaultAudio) {
      langMap.get(code)!.isDefault = true
    }
  }

  return Array.from(langMap.values())
}

export async function fetchMultiLanguageAudioTracks(
  videoId: string
): Promise<MultiLangAudioResult> {
  try {
    const playerRes = await fetchPlayerResponseFromWebpage(videoId)

    const rawFormats = playerRes.streamingData?.formats || []
    const rawAdaptive = playerRes.streamingData?.adaptiveFormats || []
    const hasCipher =
      rawFormats.some((f: any) => f.signatureCipher || f.cipher) ||
      rawAdaptive.some((f: any) => f.signatureCipher || f.cipher)
    const jsCode = hasCipher ? await getPlayerJsCode() : ""

    const audioStreams = parseAllAudioStreams(playerRes, jsCode)
    const languages = extractLanguages(audioStreams)
    const hasMultiLanguageAudio = languages.length > 1

    return { audioStreams, languages, hasMultiLanguageAudio }
  } catch (err: any) {
    console.warn("Multi-language audio fetch failed:", err.message)
    return { audioStreams: [], languages: [], hasMultiLanguageAudio: false }
  }
}
