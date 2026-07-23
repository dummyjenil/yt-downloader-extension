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

export interface MultiLangAudioResult {
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

function extractJsonFromHtml(html: string): any | null {
  // Exactly matching prototype/audio-track-info-getter.ts regex patterns
  console.log(
    "[MultiLang] HTML contains 'ytInitialPlayerResponse':",
    html.includes("ytInitialPlayerResponse")
  )
  console.log(
    "[MultiLang] HTML contains 'streamingData':",
    html.includes("streamingData")
  )
  console.log(
    "[MultiLang] HTML contains 'audioTrack':",
    html.includes("audioTrack")
  )

  const match1 = html.match(
    /var ytInitialPlayerResponse\s*=\s*({.+?});<\/script>/
  )
  const match2 = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});var /)
  const match3 = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/)

  console.log("[MultiLang] Regex match1 (var...;/script>):", !!match1)
  console.log("[MultiLang] Regex match2 (...= ...;var):", !!match2)
  console.log("[MultiLang] Regex match3 (...= ...;):", !!match3)

  const match = match1 || match2 || match3

  if (match && match[1]) {
    console.log("[MultiLang] Matched JSON length:", match[1].length)
    try {
      const parsed = JSON.parse(match[1])
      console.log("[MultiLang] Parsed JSON keys:", Object.keys(parsed))
      console.log("[MultiLang] Has streamingData:", !!parsed.streamingData)
      if (parsed.streamingData) {
        console.log(
          "[MultiLang] streamingData keys:",
          Object.keys(parsed.streamingData)
        )
        const af = parsed.streamingData.adaptiveFormats || []
        const f = parsed.streamingData.formats || []
        console.log(
          `[MultiLang] adaptiveFormats: ${af.length}, formats: ${f.length}`
        )
        const audioFmts = [...af, ...f].filter((x: any) =>
          x.mimeType?.startsWith("audio/")
        )
        console.log(`[MultiLang] Total audio formats: ${audioFmts.length}`)
        if (audioFmts.length > 0) {
          console.log(
            "[MultiLang] First audio format:",
            JSON.stringify(audioFmts[0], null, 2)
          )
        }
      }
      return parsed
    } catch (e) {
      console.warn("[MultiLang] JSON.parse failed:", e)
      console.log(
        "[MultiLang] First 500 chars of matched string:",
        match[1].slice(0, 500)
      )
      return null
    }
  }

  // Fallback: search for audioTrack in raw HTML
  const audioTrackIdx = html.indexOf('"audioTrack"')
  console.log("[MultiLang] audioTrack found in HTML at index:", audioTrackIdx)
  if (audioTrackIdx > -1) {
    console.log(
      "[MultiLang] Context around audioTrack:",
      html.slice(Math.max(0, audioTrackIdx - 200), audioTrackIdx + 200)
    )
  }

  return null
}

async function fetchPlayerResponseFromHTML(videoId: string): Promise<any> {
  const url = `https://www.youtube.com/watch?v=${videoId}`
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9"
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube webpage: ${response.status}`)
  }

  const html = await response.text()
  console.log(`[MultiLang] Fetched HTML page (${html.length} bytes)`)

  const playerResponse = extractJsonFromHtml(html)
  if (!playerResponse) {
    throw new Error("Could not parse ytInitialPlayerResponse from HTML")
  }

  return playerResponse
}

async function fetchPlayerResponseWithWEBClient(
  videoId: string,
  apiKey: string,
  visitorData?: string
): Promise<any> {
  await setDNRHeadersForClient("WEB")

  const url = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false`
  const payload = {
    videoId: videoId,
    contentCheckOk: true,
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20251021.01.00",
        osName: "Windows",
        osVersion: "10.0",
        platform: "DESKTOP",
        visitorData: visitorData || undefined
      }
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    credentials: "include"
  })

  if (!response.ok) {
    throw new Error(`WEB client API failed: ${response.status}`)
  }

  const data = await response.json()
  const playabilityStatus = data.playabilityStatus || {}

  // Even if status is not OK, check if streamingData exists with audio formats
  if (playabilityStatus.status !== "OK") {
    const hasAudio = (data.streamingData?.adaptiveFormats || []).some(
      (f: any) =>
        f.mimeType?.startsWith("audio/") && (f.url || f.signatureCipher)
    )
    if (!hasAudio) {
      throw new Error(
        `Playability not OK: ${playabilityStatus.reason || "unknown"}`
      )
    }
    console.log(
      `[MultiLang] WEB API status=${playabilityStatus.status} but has audio URLs`
    )
  }

  return data
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

  // Don't filter by URL — for multi-language detection we only need langCode/displayName
  return audioStreams
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

async function resolveJsCode(playerResponse: any): Promise<string> {
  const rawFormats = playerResponse.streamingData?.formats || []
  const rawAdaptive = playerResponse.streamingData?.adaptiveFormats || []
  const hasCipher =
    rawFormats.some((f: any) => f.signatureCipher || f.cipher) ||
    rawAdaptive.some((f: any) => f.signatureCipher || f.cipher)
  return hasCipher ? await getPlayerJsCode() : ""
}

export async function fetchMultiLanguageAudioTracks(
  videoId: string,
  apiKey: string,
  visitorData?: string
): Promise<MultiLangAudioResult> {
  // Approach 1: Try InnerTube API with WEB client (fast, reliable)
  try {
    console.log("[MultiLang] Trying WEB client InnerTube API...")
    const apiRes = await fetchPlayerResponseWithWEBClient(
      videoId,
      apiKey,
      visitorData
    )
    const jsCode = await resolveJsCode(apiRes)
    const apiStreams = parseAllAudioStreams(apiRes, jsCode)
    const apiLangs = extractLanguages(apiStreams)

    console.log(
      `[MultiLang] WEB API: ${apiStreams.length} audio streams, ${apiLangs.length} languages`
    )

    if (apiLangs.length > 1) {
      console.log("[MultiLang] ✓ Multi-language detected via WEB API!")
      console.log(
        "[MultiLang] Languages found:",
        apiLangs.map((l) => `${l.name}[${l.code}]`)
      )
      console.log(
        "[MultiLang] Full player response:",
        JSON.stringify(apiRes, null, 2)
      )
      return {
        audioStreams: apiStreams,
        languages: apiLangs,
        hasMultiLanguageAudio: true
      }
    }
  } catch (err: any) {
    console.warn("[MultiLang] WEB API approach failed:", err.message)
  }

  // Approach 2: Fetch HTML page and parse ytInitialPlayerResponse (full data)
  try {
    console.log("[MultiLang] Trying HTML page parse...")
    const htmlRes = await fetchPlayerResponseFromHTML(videoId)
    console.log(
      "[MultiLang] HTML parsed successfully, keys:",
      Object.keys(htmlRes)
    )
    const jsCode = await resolveJsCode(htmlRes)
    const htmlStreams = parseAllAudioStreams(htmlRes, jsCode)
    const htmlLangs = extractLanguages(htmlStreams)

    console.log(
      `[MultiLang] HTML page: ${htmlStreams.length} audio streams, ${htmlLangs.length} languages`
    )

    // Always log all audio stream details for debugging
    if (htmlStreams.length > 0) {
      console.log("[MultiLang] HTML audio streams detail:")
      for (const s of htmlStreams) {
        console.log(
          `  itag=${s.itag} lang=${s.langCode} name="${s.displayName}" trackId=${s.audioTrackId} default=${s.isDefaultAudio} hasUrl=${!!s.url}`
        )
      }
    }

    if (htmlLangs.length > 1) {
      console.log("[MultiLang] ✓ Multi-language detected via HTML parse!")
      console.log(
        "[MultiLang] Languages found:",
        htmlLangs.map((l) => `${l.name}[${l.code}]`)
      )
      console.log(
        "[MultiLang] Full player response:",
        JSON.stringify(htmlRes, null, 2)
      )
      return {
        audioStreams: htmlStreams,
        languages: htmlLangs,
        hasMultiLanguageAudio: true
      }
    }

    return {
      audioStreams: htmlStreams,
      languages: htmlLangs,
      hasMultiLanguageAudio: false
    }
  } catch (err: any) {
    console.warn("[MultiLang] HTML page approach failed:", err.message)
  }

  return { audioStreams: [], languages: [], hasMultiLanguageAudio: false }
}
