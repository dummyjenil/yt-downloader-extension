import argparse
import json
import os
import re
import struct
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

# Default values if no arguments provided
DEFAULT_VIDEO_ID = "C8QYVwX0M6g"
DEFAULT_START_TIME = 17.0
DEFAULT_END_TIME = 79.0
TEST_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUTPUT = os.path.join(TEST_DIR, "sidx_output.mp4")

CHUNK_SIZE = 5 * 1024 * 1024  # 5MB chunks
CONCURRENCY = 3               # 3 parallel workers


def extract_video_id(url_or_id):
    """Extract YouTube 11-char video ID from URL or return raw ID."""
    if len(url_or_id) == 11 and re.match(r"^[a-zA-Z0-9_-]{11}$", url_or_id):
        return url_or_id
    match = re.search(r"(?:v=|\/|be\/)([a-zA-Z0-9_-]{11})", url_or_id)
    if match:
        return match.group(1)
    return url_or_id


def parse_time(time_str):
    """Convert float, int, or HH:MM:SS / MM:SS string into seconds float."""
    if isinstance(time_str, (int, float)):
        return float(time_str)
    time_str = str(time_str).strip()
    if ":" in time_str:
        parts = list(map(float, time_str.split(":")))
        if len(parts) == 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
        elif len(parts) == 2:
            return parts[0] * 60 + parts[1]
    return float(time_str)


def fetch_youtube_streams(video_id):
    print(f"[1/4] Fetching YouTube streaming URLs for videoId: {video_id}...")
    api_key = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
    player_url = f"https://www.youtube.com/youtubei/v1/player?key={api_key}&prettyPrint=false&ext_request=true"

    web_req = urllib.request.Request(
        player_url,
        data=json.dumps({
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
        }).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    )

    visitor_data = ""
    try:
        with urllib.request.urlopen(web_req) as resp:
            data_web = json.loads(resp.read().decode("utf-8"))
            visitor_data = data_web.get("responseContext", {}).get("visitorData", "")
    except Exception as e:
        print(f"   Warning: Failed to fetch visitorData: {e}")

    vr_req = urllib.request.Request(
        player_url,
        data=json.dumps({
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
        }).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip"
        }
    )

    with urllib.request.urlopen(vr_req) as resp:
        data_vr = json.loads(resp.read().decode("utf-8"))
        details = data_vr.get("videoDetails", {})
        title = details.get("title", "Unknown")
        length_sec = float(details.get("lengthSeconds", 0))

        adaptive = data_vr.get("streamingData", {}).get("adaptiveFormats", [])
        video_format = None
        audio_format = None

        for f in adaptive:
            mime = f.get("mimeType", "")
            if "video/mp4" in mime and "avc1" in mime:
                if not video_format or int(f.get("contentLength", 0)) > int(video_format.get("contentLength", 0)):
                    video_format = f

        for f in adaptive:
            mime = f.get("mimeType", "")
            if "audio/mp4" in mime and "mp4a" in mime:
                if not audio_format or int(f.get("contentLength", 0)) > int(audio_format.get("contentLength", 0)):
                    audio_format = f

        if not video_format or not audio_format:
            raise RuntimeError("Failed to locate adaptive MP4 video and AAC audio formats")

        print(f"   Title: '{title}' (Total Duration: {length_sec}s)")
        print(f"   Video Stream: itag {video_format.get('itag')} ({video_format.get('qualityLabel')}), Content-Length: {video_format.get('contentLength')} bytes")
        print(f"   Audio Stream: itag {audio_format.get('itag')}, Content-Length: {audio_format.get('contentLength')} bytes")

        return video_format, audio_format, title


def download_chunk(url, start_byte, end_byte):
    chunk_url = url
    if "range=" in chunk_url:
        chunk_url = re.sub(r"([?&])range=[^&]*", f"\\1range={start_byte}-{end_byte}", chunk_url)
    else:
        sep = "&" if "?" in chunk_url else "?"
        chunk_url = f"{chunk_url}{sep}range={start_byte}-{end_byte}"

    if "ext_download=true" not in chunk_url:
        sep = "&" if "?" in chunk_url else "?"
        chunk_url = f"{chunk_url}{sep}ext_download=true"

    req = urllib.request.Request(chunk_url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    })

    for attempt in range(5):
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.read()
        except Exception as e:
            if attempt == 4:
                raise e
            time.sleep(0.5 * (2 ** attempt))


def download_stream_parallel_range(url, range_start, range_end, name):
    range_size = range_end - range_start + 1
    total_chunks = (range_size + CHUNK_SIZE - 1) // CHUNK_SIZE
    chunks = [None] * total_chunks

    def worker(idx):
        start = range_start + (idx * CHUNK_SIZE)
        end = min(range_start + ((idx + 1) * CHUNK_SIZE) - 1, range_end)
        data = download_chunk(url, start, end)
        return idx, data

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = [executor.submit(worker, i) for i in range(total_chunks)]
        for fut in as_completed(futures):
            idx, data = fut.result()
            chunks[idx] = data

    for i, c in enumerate(chunks):
        if c is None:
            raise RuntimeError(f"Chunk {i} failed in download for {name}!")

    payload = b"".join(chunks)
    print(f"   Downloaded {name}: {len(payload)} bytes in {round(time.time() - t0, 2)}s")
    return payload


def parse_sidx(buf, index_end):
    box_size, box_type = struct.unpack(">I4s", buf[:8])
    if box_type != b"sidx":
        raise ValueError("Buffer is not a valid sidx box")

    version = buf[8]
    timescale = struct.unpack(">I", buf[16:20])[0]
    offset = 20
    if version == 0:
        pts = struct.unpack(">I", buf[offset:offset+4])[0]
        first_offset = struct.unpack(">I", buf[offset+4:offset+8])[0]
        offset += 8
    else:
        pts = struct.unpack(">Q", buf[offset:offset+8])[0]
        first_offset = struct.unpack(">Q", buf[offset+8:offset+16])[0]
        offset += 16

    offset += 2
    ref_count = struct.unpack(">H", buf[offset:offset+2])[0]
    offset += 2

    current_byte = index_end + 1 + first_offset
    current_time = pts / timescale
    segments = []

    for i in range(ref_count):
        ref_info, sub_dur = struct.unpack(">II", buf[offset:offset+8])
        ref_size = ref_info & 0x7FFFFFFF
        dur_sec = sub_dur / timescale
        segments.append({
            "index": i,
            "startByte": current_byte,
            "endByte": current_byte + ref_size - 1,
            "size": ref_size,
            "startTime": current_time,
            "endTime": current_time + dur_sec
        })
        current_byte += ref_size
        current_time += dur_sec
        offset += 12
    return segments


def get_sidx_byte_range(format_info, stream_url, target_start, target_end):
    init_end = int(format_info.get("initRange", {}).get("end", 0))
    idx_start = int(format_info.get("indexRange", {}).get("start", 0))
    idx_end = int(format_info.get("indexRange", {}).get("end", 0))

    init_bytes = download_chunk(stream_url, 0, init_end)
    sidx_bytes = download_chunk(stream_url, idx_start, idx_end)

    segments = parse_sidx(sidx_bytes, idx_end)
    matching = [s for s in segments if s["endTime"] > target_start and s["startTime"] < target_end]

    if not matching:
        raise RuntimeError(f"No SIDX subsegments found matching time window {target_start}s - {target_end}s")

    range_start = matching[0]["startByte"]
    range_end = matching[-1]["endByte"]
    segment_start_time = matching[0]["startTime"]

    return init_bytes, range_start, range_end, segment_start_time


def run_sidx_smart_merge(v_path, a_path, out_path, v_start_sec, a_start_sec, target_start, duration):
    v_seek = max(0.0, target_start - v_start_sec)
    a_seek = max(0.0, target_start - a_start_sec)

    cmd = [
        "ffmpeg", "-y", "-v", "warning",
        "-ss", str(v_seek), "-i", v_path,
        "-ss", str(a_seek), "-i", a_path,
        "-t", str(duration),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy",
        "-bsf:v", "h264_mp4toannexb",
        "-c:a", "aac",
        out_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"SIDX merge command failed: {res.stderr}")


def download_sidx_clip(video_id_or_url, start_time_sec, end_time_sec, output_path):
    video_id = extract_video_id(video_id_or_url)
    duration_sec = end_time_sec - start_time_sec
    if duration_sec <= 0:
        raise ValueError("end_time must be greater than start_time")

    print("=" * 60)
    print("🚀 PURE SIDX-BASED YOUTUBE CLIP DOWNLOADER")
    print(f"   Video ID:    {video_id}")
    print(f"   Time Window: {start_time_sec}s -> {end_time_sec}s (Duration: {duration_sec}s)")
    print(f"   Output File: {output_path}")
    print("=" * 60)

    # Temporary files
    temp_dir = os.path.dirname(os.path.abspath(output_path)) or "."
    v_temp_path = os.path.join(temp_dir, f"_temp_{video_id}_v.mp4")
    a_temp_path = os.path.join(temp_dir, f"_temp_{video_id}_a.m4a")

    try:
        t0 = time.time()
        # 1. Fetch formats
        video_f, audio_f, title = fetch_youtube_streams(video_id)

        full_v_size = int(video_f.get("contentLength", 0))
        full_a_size = int(audio_f.get("contentLength", 0))
        full_total = full_v_size + full_a_size

        # 2. Get SIDX range info & init header
        print("\n[2/4] Resolving SIDX Byte Ranges for target clip...")
        v_init, v_rstart, v_rend, v_sub_start = get_sidx_byte_range(video_f, video_f["url"], start_time_sec, end_time_sec)
        a_init, a_rstart, a_rend, a_sub_start = get_sidx_byte_range(audio_f, audio_f["url"], start_time_sec, end_time_sec)

        print(f"   Video Range: {v_rstart}-{v_rend} ({v_rend - v_rstart + 1} bytes, subsegment start: {v_sub_start:.2f}s)")
        print(f"   Audio Range: {a_rstart}-{a_rend} ({a_rend - a_rstart + 1} bytes, subsegment start: {a_sub_start:.2f}s)")

        # 3. Parallel Download Smart SIDX Ranges
        print("\n[3/4] Downloading Smart Range Subsegments...")
        v_sidx_bytes = v_init + download_stream_parallel_range(video_f["url"], v_rstart, v_rend, "Video Subsegment")
        with open(v_temp_path, "wb") as f:
            f.write(v_sidx_bytes)

        a_sidx_bytes = a_init + download_stream_parallel_range(audio_f["url"], a_rstart, a_rend, "Audio Subsegment")
        with open(a_temp_path, "wb") as f:
            f.write(a_sidx_bytes)

        sidx_downloaded_size = len(v_sidx_bytes) + len(a_sidx_bytes)

        # 4. Merge with FFmpeg
        print("\n[4/4] Merging with FFmpeg...")
        run_sidx_smart_merge(v_temp_path, a_temp_path, output_path, v_sub_start, a_sub_start, start_time_sec, duration_sec)

        elapsed = round(time.time() - t0, 2)
        saved_pct = round((1 - (sidx_downloaded_size / full_total)) * 100, 1) if full_total > 0 else 0

        print("\n" + "=" * 60)
        print("✅ SUCCESS! CLIP DOWNLOAD COMPLETE")
        print("=" * 60)
        print(f"Output Path:         {os.path.abspath(output_path)}")
        print(f"Downloaded Size:     {sidx_downloaded_size} bytes ({round(sidx_downloaded_size / (1024*1024), 2)} MB)")
        print(f"Full Video Payload:  {full_total} bytes ({round(full_total / (1024*1024), 2)} MB)")
        print(f"Bandwidth Saved:     {saved_pct}%")
        print(f"Total Time Taken:    {elapsed}s")
        print("=" * 60)

    finally:
        for p in [v_temp_path, a_temp_path]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass


def main():
    parser = argparse.ArgumentParser(description="Pure SIDX-Based YouTube Video Clip Downloader")
    parser.add_argument("video", nargs="?", default=DEFAULT_VIDEO_ID, help="YouTube Video ID or URL (default: C8QYVwX0M6g)")
    parser.add_argument("--start", "-s", type=parse_time, default=DEFAULT_START_TIME, help="Start time in seconds or HH:MM:SS (default: 17.0)")
    parser.add_argument("--end", "-e", type=parse_time, default=DEFAULT_END_TIME, help="End time in seconds or HH:MM:SS (default: 79.0)")
    parser.add_argument("--output", "-o", type=str, default=DEFAULT_OUTPUT, help="Output MP4 filename")

    args = parser.parse_args()

    download_sidx_clip(
        video_id_or_url=args.video,
        start_time_sec=args.start,
        end_time_sec=args.end,
        output_path=args.output
    )


if __name__ == "__main__":
    main()

