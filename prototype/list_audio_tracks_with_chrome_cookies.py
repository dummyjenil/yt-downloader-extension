import urllib.request
import json
import sys
from yt_dlp.cookies import extract_cookies_from_browser

DEFAULT_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"

def get_chrome_youtube_cookies():
    try:
        cj = extract_cookies_from_browser("chrome")
        yt_cookies = {}
        for c in cj:
            if "youtube" in c.domain:
                yt_cookies[c.name] = c.value
        cookie_header = "; ".join([f"{k}={v}" for k, v in yt_cookies.items()])
        return yt_cookies, cookie_header
    except Exception as e:
        print(f"Warning: Could not extract Chrome cookies: {e}")
        return {}, ""

def fetch_player_response_with_cookies(video_id, cookie_header, api_key=DEFAULT_API_KEY):
    url = f"https://www.youtube.com/youtubei/v1/player?key={api_key}&prettyPrint=false&ext_request=true"
    
    # First get visitorData with WEB client + Cookie header
    web_payload = {
        "videoId": video_id,
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20251021.01.00",
                "osName": "Windows",
                "osVersion": "10.0",
                "platform": "DESKTOP"
            }
        }
    }
    web_headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
        "Cookie": cookie_header
    }
    
    visitor_data = ""
    try:
        req = urllib.request.Request(url, data=json.dumps(web_payload).encode("utf-8"), headers=web_headers)
        with urllib.request.urlopen(req) as resp:
            res = json.loads(resp.read().decode("utf-8"))
            visitor_data = res.get("responseContext", {}).get("visitorData", "")
    except Exception as e:
        print(f"WEB client initial call: {e}")

    # Now call ANDROID_VR client with visitorData + Cookie header
    vr_payload = {
        "videoId": video_id,
        "contentCheckOk": True,
        "context": {
            "client": {
                "clientName": "ANDROID_VR",
                "clientVersion": "1.60.19",
                "deviceMake": "Oculus",
                "deviceModel": "Quest 3",
                "osName": "Android",
                "osVersion": "12L",
                "androidSdkVersion": "32",
                "visitorData": visitor_data
            }
        }
    }
    vr_headers = {
        "Content-Type": "application/json",
        "User-Agent": "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
        "x-youtube-client-name": "28",
        "x-youtube-client-version": "1.60.19",
        "Cookie": cookie_header
    }
    
    req = urllib.request.Request(url, data=json.dumps(vr_payload).encode("utf-8"), headers=vr_headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def main():
    video_id = sys.argv[1] if len(sys.argv) > 1 else "wk62YFS3gqc"
    print("==========================================================")
    print(" YouTube Audio Track List Extractor (With Chrome Cookies)")
    print("==========================================================")
    print(f"Target Video ID: {video_id}")

    print("\n1. Extracting Chrome cookies...")
    cookies_dict, cookie_header = get_chrome_youtube_cookies()
    print(f"Successfully loaded {len(cookies_dict)} Chrome cookies for YouTube!")
    if "LOGIN_INFO" in cookies_dict:
        print("Status: Logged In Cookie Detected! (LOGIN_INFO present)")
    else:
        print("Status: Visitor / Anonymous Cookie State")

    print("\n2. Querying YouTube Player API with Chrome cookies...")
    player_res = fetch_player_response_with_cookies(video_id, cookie_header)
    
    video_details = player_res.get("videoDetails", {})
    title = video_details.get("title", "Unknown Title")
    author = video_details.get("author", "Unknown Author")
    duration = int(video_details.get("lengthSeconds", 0))
    print(f"\nTitle: '{title}'")
    print(f"Author: {author}")
    print(f"Duration: {duration // 60}m {duration % 60}s ({duration}s)")

    adaptive_formats = player_res.get("streamingData", {}).get("adaptiveFormats", [])
    audio_formats = [f for f in adaptive_formats if f.get("mimeType", "").startswith("audio/")]

    print(f"\n3. Detection Results: {len(audio_formats)} Audio Formats / Streams Found:")
    print("-" * 90)

    unique_languages = set()
    for i, fmt in enumerate(audio_formats):
        track = fmt.get("audioTrack", {})
        lang_name = track.get("displayName", "Default / Original")
        track_id = track.get("id", "default")
        is_default = track.get("audioIsDefault", False)
        itag = fmt.get("itag")
        mime = fmt.get("mimeType", "").split(";")[0]
        bitrate = fmt.get("bitrate", 0) // 1000
        size_mb = int(fmt.get("contentLength", 0)) / (1024 * 1024)
        
        unique_languages.add(f"{lang_name} (ID: {track_id})")
        
        default_str = " [DEFAULT]" if is_default else ""
        print(f"[{i+1}] Itag: {itag:<4} | Lang: {lang_name}{default_str:<12} | Format: {mime:<10} | Bitrate: {bitrate:<4} kbps | Size: {size_mb:.2f} MB | Track ID: {track_id}")

    print("-" * 90)
    print(f"\nTotal Unique Audio Language Tracks Detected: {len(unique_languages)}")
    for lang in unique_languages:
        print(f"  - Track: {lang}")
    print("==========================================================")

if __name__ == "__main__":
    main()
