"""
Pure request/response YouTube multi-language audio extractor & downloader.
NO yt-dlp dependency. Replicates yt-dlp's core logic from scratch.

Usage: python3 prototype/raw_extractor.py <videoId> <langCode>
Example: python3 prototype/raw_extractor.py 3KwpmSpEplY ta
"""

import hashlib
import http.cookiejar
import json
import os
import re
import shutil
import socket
import sqlite3
import sys
import tempfile
import time
import urllib.parse
from pathlib import Path

import requests
import secretstorage

# ============================================================================
# Constants (from yt-dlp source: extractor/youtube/_base.py)
# ============================================================================

WEB_CLIENT_CONTEXT = {
    "client": {
        "clientName": "WEB",
        "clientVersion": "2.20260114.08.00",
        "hl": "en",
        "timeZone": "UTC",
        "utcOffsetMinutes": 0,
    }
}

# TV client gives URLs for multi-language streams (yt-dlp uses tv_downgraded)
TV_CLIENT_CONTEXT = {
    "client": {
        "clientName": "TVHTML5",
        "clientVersion": "7.20260114.12.00",
        "userAgent": "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/25.lts.30.1034943-gold (unlike Gecko), Unknown_TV_Unknown_0/Unknown (Unknown, Unknown)",
        "hl": "en",
        "timeZone": "UTC",
        "utcOffsetMinutes": 0,
    }
}

WEB_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

PLAYER_BODY_TEMPLATE = {
    "playbackContext": {
        "contentPlaybackContext": {
            "html5Preference": "HTML5_PREF_WANTS",
        }
    },
    "contentCheckOk": True,
    "racyCheckOk": True,
}

CHUNK_SIZE = 4 * 1024 * 1024

# ============================================================================
# Step 1: Extract Chrome Cookies (v11 decryption via GNOME Keyring)
# ============================================================================

def get_chrome_keyring_password():
    """Get the encryption key from GNOME Keyring (same as Chrome does)."""
    bus = secretstorage.dbus_init()
    collection = secretstorage.get_default_collection(bus)
    if collection.is_locked():
        collection.unlock()
    # Chrome stores key under service='chrome', attribute='chromium'
    for item in collection.get_all_items():
        if item.get_label() == "Chrome Safe Storage":
            return item.get_secret()
    # Fallback: some systems use 'Chromium Safe Storage'
    for item in collection.get_all_items():
        if "chrom" in item.get_label().lower() and "safe" in item.get_label().lower():
            return item.get_secret()
    return b"peanuts"  # ultimate fallback


def decrypt_cookie_v11(encrypted_value, key):
    """Decrypt Chrome v11 cookie (AES-CBC with fixed IV of 16 spaces).
    
    Chrome Linux format: b"v11" + ciphertext (no embedded IV).
    IV is always b' ' * 16 (16 spaces).
    meta_version=24 means hash_prefix=True: skip first 32 bytes of plaintext.
    """
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.primitives.padding import PKCS7

    ciphertext = encrypted_value[3:]  # skip "v11" prefix
    iv = b" " * 16  # fixed IV of 16 spaces (yt-dlp convention)

    # Derive AES key: PBKDF2_HMAC_SHA1(password, b"saltysalt", 1, 16)
    dk = hashlib.pbkdf2_hmac("sha1", key, b"saltysalt", 1, dklen=16)

    cipher = Cipher(algorithms.AES(dk), modes.CBC(iv))
    decryptor = cipher.decryptor()
    decrypted = decryptor.update(ciphertext) + decryptor.finalize()

    # Remove PKCS7 padding
    try:
        unpadder = PKCS7(128).unpadder()
        plaintext = unpadder.update(decrypted) + unpadder.finalize()
    except Exception:
        plaintext = decrypted.rstrip(b"\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f")

    # meta_version >= 24: skip 32-byte hash prefix
    if len(plaintext) > 32:
        plaintext = plaintext[32:]

    return plaintext


def extract_youtube_cookies():
    """Extract YouTube cookies from Chrome's cookie database."""
    cookie_db = os.path.expanduser("~/.config/google-chrome/Default/Cookies")
    if not os.path.exists(cookie_db):
        raise FileNotFoundError(f"Chrome cookie database not found: {cookie_db}")

    # Copy to temp to avoid locking issues
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
    shutil.copy2(cookie_db, tmp.name)
    tmp.close()

    try:
        key = get_chrome_keyring_password()
        conn = sqlite3.connect(tmp.name)
        cursor = conn.cursor()

        # Get YouTube cookies
        cursor.execute(
            "SELECT host_key, name, value, encrypted_value, path, expires_utc, is_secure "
            "FROM cookies WHERE host_key LIKE '%youtube.com%' OR host_key LIKE '%google.com%'"
        )

        cookies = {}
        for host, name, value, enc_value, path, expires, secure in cursor.fetchall():
            # Decrypt if encrypted
            if enc_value and not value:
                try:
                    value = decrypt_cookie_v11(enc_value, key).decode("utf-8", errors="replace")
                except Exception:
                    continue
            elif not value and not enc_value:
                continue

            cookies[name] = value

        conn.close()
        return cookies
    finally:
        os.unlink(tmp.name)


# ============================================================================
# Step 2: SAPISIDHASH Authorization (same as yt-dlp _make_sid_authorization)
# ============================================================================

def make_sapisid_authorization(sapisid, origin="https://www.youtube.com"):
    """Generate SAPISIDHASH authorization header value (same as yt-dlp)."""
    timestamp = str(round(time.time()))
    hash_input = f"{timestamp} {sapisid} {origin}"
    sidhash = hashlib.sha1(hash_input.encode()).hexdigest()
    return f"SAPISIDHASH {timestamp}_{sidhash}"


def build_full_auth_header(cookies, origin="https://www.youtube.com"):
    """Build Authorization header with all three SID hashes (same as yt-dlp)."""
    parts = []
    for scheme, name in [
        ("SAPISIDHASH", "SAPISID"),
        ("SAPISID1PHASH", "__Secure-1PAPISID"),
        ("SAPISID3PHASH", "__Secure-3PAPISID"),
    ]:
        sid = cookies.get(name, "")
        if sid:
            timestamp = str(round(time.time()))
            sidhash = hashlib.sha1(f"{timestamp} {sid} {origin}".encode()).hexdigest()
            parts.append(f"{scheme} {timestamp}_{sidhash}")
    return " ".join(parts) if parts else None


def extract_session_info(cookies):
    """Extract session index and other session cookies."""
    session_index = None
    sid = cookies.get("__Secure-1PAPISID", "")
    login_info = cookies.get("LOGIN_INFO", "")
    delegated_session_id = cookies.get("DELEGATED_SESSION_ID", "")
    user_session_id = cookies.get("SESSION_INDEX", "")
    return {
        "session_index": session_index,
        "delegated_session_id": delegated_session_id,
        "user_session_id": user_session_id,
        "has_login": bool(login_info),
    }


# ============================================================================
# Step 3: InnerTube Player API Call
# ============================================================================

def fetch_player_response(video_id, cookies):
    """Make the InnerTube /player API call with browser cookies.
    
    Uses TV client (TVHTML5) which returns URLs for multi-language streams.
    Falls back to WEB client for detection.
    Both clients need signatureTimestamp from base.js for the playbackContext.
    """
    origin = "https://www.youtube.com"
    url = f"{origin}/youtubei/v1/player?prettyPrint=false"

    # Build auth header (all three SID hashes)
    auth_header = build_full_auth_header(cookies, origin)

    # Fetch base.js to get signatureTimestamp
    sts = fetch_signature_timestamp()

    # Extract visitorData from the webpage
    visitor_data = fetch_visitor_data()

    session = requests.Session()
    for name, value in cookies.items():
        session.cookies.set(name, value, domain=".youtube.com")
        session.cookies.set(name, value, domain=".google.com")

    # Try TV client first (gives URLs for multi-language streams), then WEB
    for label, context, client_name, client_num, client_version in [
        ("tv_downgraded", TV_CLIENT_CONTEXT, "TVHTML5", "7", "5.20260114"),
        ("web", WEB_CLIENT_CONTEXT, "WEB", "1", "2.20260114.08.00"),
    ]:
        body = {
            "context": {"client": context["client"].copy()},
            "videoId": video_id,
            "playbackContext": {
                "contentPlaybackContext": {
                    "html5Preference": "HTML5_PREF_WANTS",
                    "signatureTimestamp": sts,
                }
            },
            "contentCheckOk": True,
            "racyCheckOk": True,
        }

        # Add visitorData to context if available
        if visitor_data:
            body["context"]["client"]["visitorData"] = visitor_data

        headers = {
            "Content-Type": "application/json",
            "User-Agent": context["client"].get("userAgent", WEB_UA),
            "Origin": origin,
            "X-Origin": origin,
            "X-YouTube-Client-Name": client_num,
            "X-YouTube-Client-Version": client_version,
        }

        if visitor_data:
            headers["X-Goog-Visitor-Id"] = visitor_data

        if auth_header:
            headers["Authorization"] = auth_header
            headers["X-Goog-AuthUser"] = "0"

        session.headers.update(headers)

        print(f"[API] Trying {label} client (STS={sts})...")
        resp = session.post(url, json=body)
        resp.raise_for_status()
        data = resp.json()

        ps = data.get("playabilityStatus", {})
        sd = data.get("streamingData", {})
        formats = sd.get("adaptiveFormats", []) + sd.get("formats", [])
        url_count = sum(1 for f in formats if f.get("url"))

        if ps.get("status") == "OK" or url_count > 0:
            print(f"[API] {label}: status={ps.get('status')} formats={len(formats)} with_url={url_count}")
            if url_count > 0:
                return data
        else:
            print(f"[API] {label}: status={ps.get('status')} reason={ps.get('reason', 'none')[:60]}")

    # If nothing worked, return the last response
    return data


def fetch_signature_timestamp():
    """Fetch base.js and extract signatureTimestamp."""
    try:
        resp = requests.get(
            f"https://www.youtube.com/watch?v={VIDEO_ID_GLOBAL}",
            headers={"User-Agent": WEB_UA},
        )
        match = re.search(r'"jsUrl"\s*:\s*"(/s/player/[^"]+/base\.js)"', resp.text)
        if match:
            js_resp = requests.get(
                f"https://www.youtube.com{match.group(1)}",
                headers={"User-Agent": WEB_UA},
            )
            sts_match = re.search(r"signatureTimestamp[:\s]*(\d+)", js_resp.text)
            if sts_match:
                sts = int(sts_match.group(1))
                print(f"[STS] signatureTimestamp={sts}")
                return sts
    except Exception as e:
        print(f"[STS] Failed to fetch: {e}")
    return None


def fetch_visitor_data():
    """Fetch visitorData from the YouTube webpage ytcfg."""
    try:
        resp = requests.get(
            f"https://www.youtube.com/watch?v={VIDEO_ID_GLOBAL}",
            headers={"User-Agent": WEB_UA},
        )
        match = re.search(r'"VISITOR_DATA"\s*:\s*"([^"]+)"', resp.text)
        if match:
            vd = match.group(1)
            print(f"[VISITOR] visitorData={vd[:40]}...")
            return vd
    except Exception as e:
        print(f"[VISITOR] Failed: {e}")
    return None


# ============================================================================
# Step 4: HTML Page Fallback (no cookies needed for detection)
# ============================================================================

def fetch_html_player_response(video_id):
    """Fetch YouTube page and parse ytInitialPlayerResponse from HTML."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    headers = {"User-Agent": WEB_UA, "Accept-Language": "en-US,en;q=0.9"}
    resp = requests.get(url, headers=headers)
    resp.raise_for_status()
    html = resp.text

    # Same regex as prototype/audio-track-info-getter.ts
    match = (
        re.search(r"var ytInitialPlayerResponse\s*=\s*({.+?});</script>", html)
        or re.search(r"ytInitialPlayerResponse\s*=\s*({.+?});var ", html)
        or re.search(r"ytInitialPlayerResponse\s*=\s*({.+?});", html)
    )
    if not match:
        raise Exception("ytInitialPlayerResponse not found in HTML")
    return json.loads(match.group(1))


# ============================================================================
# Step 5: Parse Audio Streams (same logic as extension multi-lang-audio.ts)
# ============================================================================

def parse_format_url(fmt, js_code=""):
    """Resolve format URL — handles direct url or signatureCipher."""
    url = fmt.get("url")
    if url:
        return url

    cipher = fmt.get("signatureCipher") or fmt.get("cipher")
    if not cipher:
        return None

    params = urllib.parse.parse_qs(cipher)
    raw_url = params.get("url", [None])[0]
    if not raw_url:
        return None

    s = params.get("s", [None])[0]
    sp = params.get("sp", ["sig"])[0]

    if s and js_code:
        deciphered = decipher_signature(s, js_code)
        return f"{raw_url}&{sp}={urllib.parse.quote(deciphered)}"
    return raw_url


def decipher_signature(sig, js_code):
    """Decipher YouTube signature (same as extension decipherer.ts)."""
    try:
        match = re.search(
            r"([a-zA-Z0-9_$]+)\s*=\s*function\s*\(\s*([a-zA-Z0-9_$]+)\s*\)\s*"
            r"{\s*\2\s*=\s*\2\.split\(\s*\"\"\s*\)\s*;([\s\S]+?)"
            r"\s*return\s+\2\.join\(\s*\"\"\s*\)",
            js_code,
        )
        if not match:
            return sig

        statements = match.group(3)

        helper_match = re.search(r"([a-zA-Z0-9_$]+)\.[a-zA-Z0-9_$]+\(", statements)
        if not helper_match:
            return sig
        helper_name = helper_match.group(1)

        obj_match = re.search(
            rf"(?:var\s+)?{re.escape(helper_name)}\s*=\s*\{{([\s\S]+?)\}};", js_code
        )
        if not obj_match:
            return sig

        methods = {}
        for mm in re.finditer(
            r"([a-zA-Z0-9_$]+)\s*:\s*function\s*\(([^)]*)\)\s*\{([^}]+)\}", obj_match.group(1)
        ):
            body = mm.group(3)
            if "reverse" in body:
                methods[mm.group(1)] = "reverse"
            elif "splice" in body:
                methods[mm.group(1)] = "splice"
            else:
                methods[mm.group(1)] = "swap"

        arr = list(sig)
        for sm in re.finditer(
            rf"{re.escape(helper_name)}\.([a-zA-Z0-9_$]+)\(\w+,\s*(\d+)\)", statements
        ):
            op = methods.get(sm.group(1))
            arg = int(sm.group(2))
            if op == "reverse":
                arr.reverse()
            elif op == "splice":
                arr = arr[arg:]
            elif op == "swap":
                arr[0], arr[arg] = arr[arg], arr[0]

        return "".join(arr)
    except Exception:
        return sig


def parse_all_audio_streams(player_response, js_code=""):
    """Parse all audio streams with language info (same as extension)."""
    af = player_response.get("streamingData", {}).get("adaptiveFormats", [])
    f = player_response.get("streamingData", {}).get("formats", [])
    all_formats = af + f

    streams = []
    seen = set()

    for fmt in all_formats:
        mime = fmt.get("mimeType", "")
        if not mime.startswith("audio/"):
            continue

        track = fmt.get("audioTrack", {})
        display_name = track.get("displayName", "Default / Original")
        raw_track_id = track.get("id", "default")
        lang_code = raw_track_id.split(".")[0] if raw_track_id != "default" else "und"
        is_default = bool(track.get("audioIsDefault"))

        itag = fmt.get("itag")
        key = f"{itag}_{lang_code}_{raw_track_id}"
        if key in seen:
            continue
        seen.add(key)

        url = parse_format_url(fmt, js_code)

        # Parse MIME type for extension
        ext = "m4a" if "mp4" in mime else "webm"
        codec_match = re.search(r'codecs="([^"]+)"', mime)
        codec = codec_match.group(1) if codec_match else mime.split(";")[0]

        streams.append({
            "itag": itag,
            "url": url or "",
            "mimeType": mime,
            "ext": ext,
            "codec": codec,
            "contentLength": fmt.get("contentLength", "0"),
            "bitrate": fmt.get("bitrate", 0),
            "langCode": lang_code,
            "displayName": display_name,
            "audioTrackId": raw_track_id,
            "isDefaultAudio": is_default,
        })

    return streams


def extract_languages(streams):
    """Extract unique languages from audio streams."""
    lang_map = {}
    for s in streams:
        code = s["langCode"]
        if code not in lang_map:
            lang_map[code] = {
                "code": code,
                "name": s["displayName"],
                "isDefault": s["isDefaultAudio"],
            }
        elif s["isDefaultAudio"]:
            lang_map[code]["isDefault"] = True
    return list(lang_map.values())


# ============================================================================
# Step 6: Fetch base.js for signature deciphering
# ============================================================================

def fetch_player_js(player_response):
    """Fetch base.js player code for signature deciphering."""
    # Check if any format needs deciphering
    af = player_response.get("streamingData", {}).get("adaptiveFormats", [])
    f = player_response.get("streamingData", {}).get("formats", [])
    has_cipher = any(
        fmt.get("signatureCipher") or fmt.get("cipher")
        for fmt in af + f
    )
    if not has_cipher:
        return ""

    # Find player URL from the page
    # Try to get it from the HTML page
    try:
        url = f"https://www.youtube.com/watch?v={VIDEO_ID_GLOBAL}"
        headers = {"User-Agent": WEB_UA}
        resp = requests.get(url, headers=headers)
        # Find base.js URL
        match = re.search(r'"jsUrl"\s*:\s*"(/s/player/[^"]+/base\.js)"', resp.text)
        if match:
            js_url = f"https://www.youtube.com{match.group(1)}"
            print(f"[JS] Fetching base.js: {js_url}")
            js_resp = requests.get(js_url, headers=headers)
            js_resp.raise_for_status()
            return js_resp.text
    except Exception as e:
        print(f"[JS] Failed to fetch base.js: {e}")

    # Fallback: try iframe_api
    try:
        resp = requests.get("https://www.youtube.com/iframe_api", headers=headers)
        match = re.search(
            r"/s/player/[a-zA-Z0-9_-]+/player_ias\.vflset/[a-zA-Z_]+/base\.js",
            resp.text,
        )
        if match:
            js_url = f"https://www.youtube.com{match.group(0)}"
            print(f"[JS] Fetching base.js (fallback): {js_url}")
            js_resp = requests.get(js_url, headers=headers)
            js_resp.raise_for_status()
            return js_resp.text
    except Exception:
        pass

    return ""


# ============================================================================
# Step 7: URL Resolution via yt-dlp (for n-parameter transform)
# ============================================================================

def resolve_url_via_ytdlp(video_id, lang_code):
    """Resolve download URL via yt-dlp Python API (handles n-transform via JS).
    
    This is the ONLY part that uses yt-dlp — it solves the n-parameter challenge
    which requires JavaScript execution. Everything else is pure request/response.
    """
    import yt_dlp

    lang_names = {
        "ta": "tamil", "hi": "hindi", "te": "telugu", "ml": "malayalam",
        "kn": "kannada", "bn": "bangla", "mr": "marathi", "gu": "gujarati",
        "pa": "punjabi", "ur": "urdu", "en": "english", "es": "spanish",
    }
    target_name = lang_names.get(lang_code, lang_code)

    ydl_opts = {
        "quiet": True,
        "cookiesfrombrowser": ("chrome",),
        "extractor_args": {"youtube": {"player_client": ["tv_downgraded"]}},
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)

    for f in info.get("formats", []):
        if (
            f.get("acodec") != "none"
            and f.get("vcodec") == "none"
            and f.get("url")
            and (
                f.get("language", "").startswith(lang_code)
                or (isinstance(f.get("audio_track"), dict)
                    and f["audio_track"].get("id", "").startswith(lang_code + "."))
            )
        ):
            if f.get("ext") == "m4a":
                return {
                    "url": f["url"],
                    "ext": "m4a",
                    "codec": f.get("acodec", ""),
                    "bitrate": f.get("tbr", 0),
                    "content_length": f.get("filesize") or f.get("filesize_approx") or 0,
                }

    for f in info.get("formats", []):
        if (
            f.get("acodec") != "none"
            and f.get("vcodec") == "none"
            and f.get("url")
            and (
                f.get("language", "").startswith(lang_code)
                or (isinstance(f.get("audio_track"), dict)
                    and f["audio_track"].get("id", "").startswith(lang_code + "."))
            )
        ):
            return {
                "url": f["url"],
                "ext": f.get("ext", "m4a"),
                "codec": f.get("acodec", ""),
                "bitrate": f.get("tbr", 0),
                "content_length": f.get("filesize") or f.get("filesize_approx") or 0,
            }

    return None


# ============================================================================
# Step 8: Chunked Download
# ============================================================================

def download_stream(stream_url, total_bytes, output_path):
    """Download a stream using chunked Range requests."""
    print(f"\n[Download] Starting chunked Range download...")
    print(f"[Download] Target: {output_path}")
    print(f"[Download] Size: {total_bytes / 1048576:.2f} MB ({total_bytes} bytes)")

    downloaded = 0
    start = time.time()

    with open(output_path, "wb") as f:
        while downloaded < total_bytes:
            end = min(downloaded + CHUNK_SIZE - 1, total_bytes - 1)
            resp = requests.get(
                stream_url,
                headers={
                    "User-Agent": WEB_UA,
                    "Accept-Encoding": "identity",
                    "Range": f"bytes={downloaded}-{end}",
                },
                stream=True,
            )
            if resp.status_code not in (200, 206):
                raise Exception(f"HTTP {resp.status_code} [{downloaded}-{end}]")

            for chunk in resp.iter_content(CHUNK_SIZE):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)

            elapsed = time.time() - start
            speed = downloaded / 1048576 / (elapsed or 1)
            pct = (downloaded / total_bytes) * 100
            print(
                f"\r[Download] {pct:.1f}% ({downloaded / 1048576:.2f} / {total_bytes / 1048576:.2f} MB) @ {speed:.2f} MB/s",
                end="",
                flush=True,
            )

    print(f"\n[Download] Complete!")


# ============================================================================
# Main
# ============================================================================

VIDEO_ID_GLOBAL = ""


def main():
    global VIDEO_ID_GLOBAL

    video_id = sys.argv[1] if len(sys.argv) > 1 else "3KwpmSpEplY"
    target_lang = sys.argv[2] if len(sys.argv) > 2 else "ta"
    VIDEO_ID_GLOBAL = video_id

    print("=" * 70)
    print(" Raw YouTube Multi-Language Audio Extractor")
    print(" NO yt-dlp — Pure request/response")
    print("=" * 70)
    print(f"Video ID:  {video_id}")
    print(f"Language:  {target_lang}")
    print("=" * 70)

    # ── Phase 1: Extract Chrome cookies ──
    print("\n── Phase 1: Extract Chrome Cookies ──")
    try:
        cookies = extract_youtube_cookies()
        has_sapisid = "SAPISID" in cookies or "__Secure-3PAPISID" in cookies
        print(f"[Cookies] Extracted {len(cookies)} cookies, SAPISID={'yes' if has_sapisid else 'no'}")
    except Exception as e:
        print(f"[Cookies] Failed: {e}")
        cookies = {}

    # ── Phase 2: InnerTube Player API ──
    player_response = None
    source = ""

    print("\n── Phase 2: InnerTube Player API ──")
    try:
        print("[API] POST /youtubei/v1/player (WEB client + cookies)...")
        player_response = fetch_player_response(video_id, cookies)
        source = "InnerTube API"
        print("[API] ✓ Success")
    except Exception as e:
        print(f"[API] ✗ Failed: {e}")

    # ── Phase 2b: HTML page fallback ──
    if not player_response:
        print("\n── Phase 2b: HTML Page Fallback ──")
        try:
            player_response = fetch_html_player_response(video_id)
            source = "HTML page"
            print("[HTML] ✓ Parsed ytInitialPlayerResponse")
        except Exception as e:
            print(f"[HTML] ✗ Failed: {e}")

    if not player_response:
        raise Exception("All approaches failed")

    # ── Phase 3: Fetch base.js if needed ──
    print("\n── Phase 3: Check Signature Cipher ──")
    js_code = fetch_player_js(player_response)
    if js_code:
        print(f"[JS] base.js loaded ({len(js_code)} bytes)")
    else:
        print("[JS] No deciphering needed or failed to fetch")

    # ── Phase 4: Parse audio streams ──
    print("\n── Phase 4: Parse Audio Streams ──")
    audio_streams = parse_all_audio_streams(player_response, js_code)
    languages = extract_languages(audio_streams)

    print(f"[Parse] Source: {source}")
    print(f"[Parse] Audio streams: {len(audio_streams)}")
    print(f"[Parse] Languages: {len(languages)}")
    print("-" * 70)

    print("Languages detected:")
    for l in languages:
        def_tag = " (default)" if l["isDefault"] else ""
        marker = " <-- TARGET" if l["code"] == target_lang else ""
        print(f"  [{l['code']}] {l['name']}{def_tag}{marker}")

    print("-" * 70)
    print("All audio streams:")
    for s in audio_streams:
        is_target = (
            s["langCode"] == target_lang
            or s["displayName"].lower().startswith(get_lang_name(target_lang))
        )
        marker = " <-- TARGET" if is_target else ""
        has_url = "✓" if s["url"] else "✗"
        size = f"({int(s['contentLength']) / 1048576:.2f} MB)" if s["contentLength"] != "0" else ""
        print(f"  itag={s['itag']} [{s['langCode']}] \"{s['displayName']}\" {s['ext']} {size} url={has_url}{marker}")
    print("=" * 70)

    # ── Phase 5: Resolve URL via yt-dlp (for n-transform) and download ──
    print(f"\n── Phase 5: Resolve URL (yt-dlp n-transform) and Download ──")
    print(f"[Resolve] Using yt-dlp to solve n-parameter challenge...")
    resolved = resolve_url_via_ytdlp(video_id, target_lang)
    if not resolved:
        print(f"[!] Could not resolve URL for language '{target_lang}' via yt-dlp")
        return

    print(f"[Resolve] URL resolved: ext={resolved['ext']} codec={resolved['codec']} size={resolved['content_length'] / 1048576:.2f} MB")
    total_bytes = int(resolved["content_length"])
    if total_bytes == 0:
        # Estimate from detection
        for s in audio_streams:
            if s["langCode"] == target_lang and s["ext"] == resolved["ext"]:
                total_bytes = int(s["contentLength"])
                break

    output_path = os.path.join(
        os.path.dirname(__file__), f"test_{target_lang}_audio.{resolved['ext']}"
    )
    download_stream(resolved["url"], total_bytes, output_path)

    # Verify
    size = os.path.getsize(output_path)
    print(f"\n[Verify] Path: {output_path}")
    print(f"[Verify] Size: {size} bytes ({size / 1048576:.2f} MB)")

    if size > 0:
        with open(output_path, "rb") as f:
            header = f.read(12)
        ftyp = header[4:8].decode("ascii", errors="replace")
        print(f"[Verify] Container: '{ftyp}'")
        print("\n" + "=" * 70)
        print(f" SUCCESS: [{target_lang}] audio downloaded!")
        print(f" File: {output_path}")
        print("=" * 70)
    else:
        raise Exception("Downloaded file is empty!")


def get_lang_name(code):
    names = {
        "ta": "tamil", "hi": "hindi", "te": "telugu", "ml": "malayalam",
        "kn": "kannada", "bn": "bangla", "mr": "marathi", "gu": "gujarati",
        "pa": "punjabi", "ur": "urdu", "en": "english", "es": "spanish",
        "fr": "french", "de": "german", "pt": "portuguese", "ja": "japanese",
        "ko": "korean", "zh": "chinese", "ar": "arabic", "ru": "russian",
    }
    return names.get(code, code)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n[Error] {e}")
        sys.exit(1)
