import urllib.request
import json
import os
import sys
import re
import time
from yt_dlp.cookies import extract_cookies_from_browser

DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def get_chrome_cookies():
    """Extract YouTube cookies from Chrome browser if available."""
    try:
        cj = extract_cookies_from_browser("chrome")
        yt_cookies = {c.name: c.value for c in cj if "youtube" in c.domain}
        cookie_header = "; ".join([f"{k}={v}" for k, v in yt_cookies.items()])
        return yt_cookies, cookie_header
    except Exception:
        return {}, ""

def fetch_player_response_from_webpage(video_id, cookie_header=""):
    """
    Fetch YouTube Webpage HTML with Chrome Cookies and parse ytInitialPlayerResponse.
    This extracts all multi-language audio tracks (Malayalam, Tamil, Telugu, English, etc.).
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9"
    }
    if cookie_header:
        headers["Cookie"] = cookie_header

    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode("utf-8")

    match = re.search(r'var ytInitialPlayerResponse\s*=\s*({.+?});</script>', html) or \
            re.search(r'ytInitialPlayerResponse\s*=\s*({.+?});var ', html) or \
            re.search(r'ytInitialPlayerResponse\s*=\s*({.+?});', html)

    if match:
        return json.loads(match.group(1))

    raise RuntimeError("Could not find ytInitialPlayerResponse in YouTube webpage")

def parse_all_audio_tracks(player_response):
    """
    Extract all audio format streams and multi-language track info (identical to yt-dlp -F).
    """
    streaming_data = player_response.get("streamingData", {})
    adaptive_formats = streaming_data.get("adaptiveFormats", [])
    formats = streaming_data.get("formats", [])
    all_formats = adaptive_formats + formats

    # Discover language index ordering
    known_langs = []
    for fmt in all_formats:
        mime = fmt.get("mimeType", "")
        if mime.startswith("audio/"):
            raw_id = fmt.get("audioTrack", {}).get("id", "")
            code = raw_id.split(".")[0] if raw_id else "und"
            if code not in known_langs:
                known_langs.append(code)

    audio_streams = []
    seen_keys = set()

    for fmt in all_formats:
        mime = fmt.get("mimeType", "")
        if not mime.startswith("audio/"):
            continue

        track_info = fmt.get("audioTrack", {})
        display_name = track_info.get("displayName", "Default / Original")
        raw_track_id = track_info.get("id", "default")
        lang_code = raw_track_id.split(".")[0] if raw_track_id != "default" else "und"
        is_default = track_info.get("audioIsDefault", False)

        itag = str(fmt.get("itag"))
        bitrate = fmt.get("bitrate", 0)
        tbr = round(bitrate / 1000) if bitrate else 0
        content_length = int(fmt.get("contentLength", 0))
        size_mb = content_length / (1024 * 1024) if content_length else 0
        
        ext = "m4a" if "mp4" in mime else "webm"
        codec = mime.split('codecs="')[1].split('"')[0] if 'codecs="' in mime else mime.split(";")[0]
        quality_note = "low" if tbr < 75 else ("medium" if tbr < 160 else "high")
        
        stream_key = f"{itag}_{lang_code}_{raw_track_id}"
        if stream_key in seen_keys:
            continue
        seen_keys.add(stream_key)

        lang_idx = known_langs.index(lang_code) if lang_code in known_langs else 0
        fmt_id_str = f"{itag}-{lang_idx}"

        audio_streams.append({
            "fmt_id": fmt_id_str,
            "itag": itag,
            "ext": ext,
            "codec": codec,
            "tbr": tbr,
            "size_mb": size_mb,
            "contentLength": content_length,
            "lang_code": lang_code,
            "display_name": display_name,
            "track_id": raw_track_id,
            "is_default": is_default,
            "quality_note": quality_note,
            "url": fmt.get("url")
        })

    return audio_streams

def print_format_table(audio_streams, video_title):
    print("\n" + "=" * 105)
    print(f" YouTube Multi-Language Audio Formats & Tracks (yt-dlp format table)")
    print("=" * 105)
    print(f"Title: \"{video_title}\"")
    print("-" * 105)
    print(f"{'ID':<10} {'EXT':<5} {'TYPE':<12} {'FILESIZE':<10} {'TBR':<6} {'ACODEC':<14} {'[LANG] AUDIO TRACK / LANGUAGE NAME'}")
    print("-" * 105)

    unique_langs = {}

    for f in audio_streams:
        size_str = f"{f['size_mb']:.2f}MiB" if f['size_mb'] > 0 else "unknown"
        lang_tag = f"[{f['lang_code']}]" if f['lang_code'] != "und" else ""
        default_str = " (default)" if f['is_default'] else ""
        info_str = f"{lang_tag} {f['display_name']}{default_str}, {f['quality_note']}, {f['ext']}_dash".strip()
        
        print(f"{f['fmt_id']:<10} {f['ext']:<5} {'audio only':<12} {size_str:<10} {str(f['tbr']) + 'k':<6} {f['codec']:<14} {info_str}")

        key = f"[{f['lang_code']}] {f['display_name']}"
        if key not in unique_langs:
            unique_langs[key] = 0
        unique_langs[key] += 1

    print("-" * 105)
    print(f"\nTotal Unique Audio Languages Detected: {len(unique_langs)}")
    for lang, count in unique_langs.items():
        print(f"  - {lang} ({count} bitrate/container options)")
    print("=" * 105)

def download_audio_stream(url, output_filename, total_bytes):
    print(f"\nDownloading audio to {output_filename} ({total_bytes / (1024*1024):.2f} MB)...")
    req = urllib.request.Request(url, headers={"User-Agent": DEFAULT_USER_AGENT})
    
    start_time = time.time()
    downloaded = 0
    chunk_size = 1024 * 1024 # 1MB chunk
    
    with urllib.request.urlopen(req) as resp, open(output_filename, "wb") as out_file:
        while True:
            chunk = resp.read(chunk_size)
            if not chunk:
                break
            out_file.write(chunk)
            downloaded += len(chunk)
            elapsed = time.time() - start_time or 0.001
            speed = (downloaded * 8) / (1024 * 1024 * elapsed)
            percent = (downloaded / total_bytes * 100) if total_bytes else 0
            sys.stdout.write(f"\rProgress: {percent:.1f}% ({downloaded / (1024*1024):.2f} MB / {total_bytes / (1024*1024):.2f} MB) | Speed: {speed:.2f} Mbps")
            sys.stdout.flush()
    print(f"\nSuccessfully downloaded in {time.time() - start_time:.2f}s!")

def main():
    video_id = sys.argv[1] if len(sys.argv) > 1 else "wk62YFS3gqc"
    
    print(f"=== YouTube Multi-Audio Track Extractor & Downloader ===")
    print(f"Video ID: {video_id}")
    print("Extracting Chrome cookies...")
    cookies_dict, cookie_header = get_chrome_cookies()
    print(f"Loaded {len(cookies_dict)} Chrome cookies.")

    print("\nFetching YouTube Webpage HTML & Parsing ytInitialPlayerResponse...")
    player_res = fetch_player_response_from_webpage(video_id, cookie_header)
    video_title = player_res.get("videoDetails", {}).get("title", "YouTube Audio")
    
    audio_streams = parse_all_audio_tracks(player_res)
    if not audio_streams:
        print("No audio streams found!")
        return

    print_format_table(audio_streams, video_title)

    if len(sys.argv) > 2 and sys.argv[2] == "--download":
        selected = audio_streams[0]
        output_filename = os.path.join(os.path.dirname(__file__), f"audio_{video_id}_{selected['lang_code']}_{selected['itag']}.{selected['ext']}")
        download_audio_stream(selected["url"], output_filename, selected["contentLength"])

if __name__ == "__main__":
    main()
