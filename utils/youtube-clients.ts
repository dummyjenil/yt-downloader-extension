export type YouTubeClientKey =
  "ANDROID_VR" | "TV" | "IOS" | "ANDROID" | "MWEB" | "WEB"

export interface YouTubeClientConfig {
  key: YouTubeClientKey
  label: string
  description: string
  clientNameHeader: string
  clientVersionHeader: string
  userAgent: string
  payloadClient: {
    clientName: string
    clientVersion: string
    deviceMake?: string
    deviceModel?: string
    osName?: string
    osVersion?: string
    androidSdkVersion?: string
    platform?: string
    hl?: string
    visitorData?: string
    [key: string]: any
  }
}

export const YOUTUBE_CLIENT_CONFIGS: Record<
  YouTubeClientKey,
  YouTubeClientConfig
> = {
  ANDROID_VR: {
    key: "ANDROID_VR",
    label: "Android VR (Oculus Quest 3)",
    description: "Highest success rate for bypassing SABR & cipher restriction",
    clientNameHeader: "28",
    clientVersionHeader: "1.65.10",
    userAgent:
      "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
    payloadClient: {
      clientName: "ANDROID_VR",
      clientVersion: "1.65.10",
      deviceMake: "Oculus",
      deviceModel: "Quest 3",
      osName: "Android",
      osVersion: "12L",
      androidSdkVersion: "32",
      hl: "en"
    }
  },
  TV: {
    key: "TV",
    label: "TV HTML5 (Cobalt Platform)",
    description: "Reliable TV client format extraction",
    clientNameHeader: "7",
    clientVersionHeader: "7.20260114.12.00",
    userAgent:
      "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/25.lts.30.1034943-gold (unlike Gecko), Unknown_TV_Unknown_0/Unknown (Unknown, Unknown)",
    payloadClient: {
      clientName: "TVHTML5",
      clientVersion: "7.20260114.12.00",
      platform: "TV",
      hl: "en"
    }
  },
  IOS: {
    key: "IOS",
    label: "iOS (iPhone 16 Pro)",
    description:
      "Official iOS client format extraction (supports HLS & 60fps streams)",
    clientNameHeader: "5",
    clientVersionHeader: "21.02.3",
    userAgent:
      "com.google.ios.youtube/21.02.3 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
    payloadClient: {
      clientName: "IOS",
      clientVersion: "21.02.3",
      deviceMake: "Apple",
      deviceModel: "iPhone16,2",
      osName: "iPhone",
      osVersion: "18.3.2.22D82",
      hl: "en"
    }
  },
  ANDROID: {
    key: "ANDROID",
    label: "Android Main App",
    description: "Official YouTube Android App client",
    clientNameHeader: "3",
    clientVersionHeader: "21.02.35",
    userAgent:
      "com.google.android.youtube/21.02.35 (Linux; U; Android 11) gzip",
    payloadClient: {
      clientName: "ANDROID",
      clientVersion: "21.02.35",
      osName: "Android",
      osVersion: "11",
      androidSdkVersion: "30",
      hl: "en"
    }
  },
  MWEB: {
    key: "MWEB",
    label: "Mobile Web (iPad)",
    description: "YouTube Mobile Web client",
    clientNameHeader: "2",
    clientVersionHeader: "2.20260115.01.00",
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 16_7_10 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1,gzip(gfe)",
    payloadClient: {
      clientName: "MWEB",
      clientVersion: "2.20260115.01.00",
      hl: "en"
    }
  },
  WEB: {
    key: "WEB",
    label: "Desktop Web",
    description: "Standard YouTube Desktop Web client",
    clientNameHeader: "1",
    clientVersionHeader: "2.20260114.08.00",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    payloadClient: {
      clientName: "WEB",
      clientVersion: "2.20260114.08.00",
      hl: "en"
    }
  }
}

/**
 * Fallback priority list derived from yt-dlp priority sequence
 */
export const DEFAULT_CLIENT_FALLBACK_ORDER: YouTubeClientKey[] = [
  "ANDROID_VR",
  "TV",
  "IOS",
  "ANDROID",
  "MWEB",
  "WEB"
]

/**
 * Returns complete client config with visitorData attached
 */
export function getClientConfig(
  key: YouTubeClientKey,
  visitorData?: string
): YouTubeClientConfig {
  const base = YOUTUBE_CLIENT_CONFIGS[key] || YOUTUBE_CLIENT_CONFIGS.ANDROID_VR
  return {
    ...base,
    payloadClient: {
      ...base.payloadClient,
      visitorData: visitorData || undefined
    }
  }
}

/**
 * Builds fallback sequence prioritizing preferred key
 */
export function getClientFallbackSequence(
  preferredKey?: string
): YouTubeClientKey[] {
  const sequence: YouTubeClientKey[] = []

  if (
    preferredKey &&
    preferredKey !== "AUTO" &&
    YOUTUBE_CLIENT_CONFIGS[preferredKey as YouTubeClientKey]
  ) {
    sequence.push(preferredKey as YouTubeClientKey)
  }

  for (const clientKey of DEFAULT_CLIENT_FALLBACK_ORDER) {
    if (!sequence.includes(clientKey)) {
      sequence.push(clientKey)
    }
  }

  return sequence
}
