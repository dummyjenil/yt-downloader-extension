# AGENTS.md

## What this is

Chrome extension (Manifest V3) for downloading YouTube videos/audio, built with **Plasmo + React 19 + TypeScript + Tailwind CSS**. Uses pnpm.

## Commands

```bash
pnpm dev          # Start Plasmo dev server (hot-reload)
pnpm build        # Production build → build/<browser>-mv3-dev/
pnpm test         # vitest run (no vitest.config file — uses defaults)
```

No separate lint/typecheck scripts exist. Run manually:
```bash
npx eslint .      # Uses eslint.config.mjs
npx tsc --noEmit  # Type checking
```

## Architecture

| Layer | Files | Role |
|-------|-------|------|
| **Background service worker** | `background.ts`, `background/` | YouTube InnerTube API calls, DNR header rules, download job orchestration |
| **Content script** | `contents/youtube.tsx`, `contents/youtube/` | Injected on `*.youtube.com`; renders FAB + modal overlay for stream extraction |
| **Popup** | `popup.tsx`, `components/`, `hooks/` | Extension popup: stream extractor, download dashboard, settings, history |
| **Download page** | `tabs/download.tsx`, `tabs/download-*` | Full-page download manager (opened in extension tab) |
| **Playlist page** | `tabs/playlist.tsx`, `tabs/playlist-*` | Batch playlist downloader |
| **FFmpeg sandbox** | `tabs/sandbox.tsx` | Isolated sandboxed page running `@ffmpeg/ffmpeg` WASM (required by CSP) |
| **Shared utilities** | `utils/`, `types/`, `context/`, `styles/` | Helpers, types, theme context, global CSS |

## Key gotchas

- **Sandbox for FFmpeg**: `tabs/sandbox.tsx` runs in a sandboxed iframe (see `manifest.sandbox` in `package.json`). The download page (`tabs/download.tsx`) embeds it as `<iframe id="ffmpeg-sandbox">` and communicates via `postMessage`. FFmpeg WASM core is cached in IndexedDB (`utils/ffmpeg-helper.ts`).
- **DNR rules**: `background/dnr.ts` dynamically sets request headers (User-Agent, client name/version) for YouTube InnerTube API calls. Rule IDs 100-101 are session rules updated on each client switch (WEB, ANDROID_VR, TV).
- **YouTube signature deciphering**: `decipherer.ts` parses YouTube's obfuscated `base.js` to decode `signatureCipher` streams. Only invoked when formats have `signatureCipher`/`cipher` fields.
- **Client fallback**: `fetchVideoInfo` in `background/youtube-video.ts` tries ANDROID_VR client first, then TV client. Both use the `ext_request` DNR rule.
- **Path alias**: `~` maps to project root in tsconfig (e.g. `import { x } from "~/utils/foo"`).
- **Prettier**: No semicolons, double quotes, trailing commas off, import sorting via `@ianvs/prettier-plugin-sort-imports`.
- **ESLint ignores**: `node_modules/`, `build/`, `.plasmo/`, `prototype/`. The `no-explicit-any` rule is off.

## Conventions

- All pages (popup, content script, download page, playlist page) wrap content in `<ThemeProvider>` from `context/ThemeContext.tsx`.
- Download state lives in the background service worker (`activeDownloads` Map) and is broadcast to all listeners via `DOWNLOADS_UPDATED` messages.
- Content script loads Google Fonts (Outfit) dynamically at runtime.
- `prototype/` directory contains experimental Python/TS scripts — not part of the extension, excluded from lint.
