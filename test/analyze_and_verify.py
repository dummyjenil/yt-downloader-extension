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

# Default values for testing
DEFAULT_VIDEO_ID = "C8QYVwX0M6g"
DEFAULT_START_TIME = 17.0
DEFAULT_END_TIME = 79.0
TEST_DIR = os.path.dirname(os.path.abspath(__file__))

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


def get_file_duration(filepath):
    """Get actual media duration in seconds using ffprobe."""
    if not os.path.exists(filepath):
        return 0.0
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        filepath
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        try:
            return float(res.stdout.strip())
        except ValueError:
            return 0.0
    return 0.0


def fetch_youtube_streams(video_id):
    """Fetch video, audio, and standard streaming formats from YouTube API with retries."""
    api_key = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
    player_url = f"https://www.youtube.com/youtubei/v1/player?key={api_key}&prettyPrint=false&ext_request=true"

    for attempt in range(4):
        try:
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
                pass

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

                streaming_data = data_vr.get("streamingData", {})
                adaptive = streaming_data.get("adaptiveFormats", [])
                formats = streaming_data.get("formats", [])

                video_format = None
                audio_format = None
                standard_format = None

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

                for f in formats:
                    mime = f.get("mimeType", "")
                    if "video/mp4" in mime:
                        if not standard_format or int(f.get("contentLength", 0)) > int(standard_format.get("contentLength", 0)):
                            standard_format = f

                if not standard_format and formats:
                    standard_format = formats[0]

                if video_format or audio_format or standard_format:
                    print(f"   Title: '{title}' (Duration: {length_sec}s)")
                    return video_format, audio_format, standard_format, title
        except Exception as err:
            if attempt == 3:
                raise err
            time.sleep(1)

    raise RuntimeError("Failed to fetch stream details from YouTube API.")


def download_chunk(url, start_byte, end_byte):
    """Download specific byte range from URL."""
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
    """Download range in parallel chunks."""
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
    """Parse binary SIDX box and return segment list with byte ranges and timestamps."""
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
    """Resolve init bytes, subsegment byte range, and segment start timestamp from SIDX box."""
    init_end = int(format_info.get("initRange", {}).get("end", 0))
    idx_start = int(format_info.get("indexRange", {}).get("start", 0))
    idx_end = int(format_info.get("indexRange", {}).get("end", 0))

    if init_end == 0 or idx_end == 0:
        raise ValueError("Format missing initRange or indexRange; SIDX extraction unavailable.")

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


def execute_ffmpeg(cmd, err_msg):
    """Run ffmpeg subprocess command with error handling."""
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"{err_msg}: {res.stderr}")


def run_mode_audio(video_id, start_time_sec, end_time_sec, output_path):
    """Audio Only Mode using SIDX byte range extraction."""
    duration_sec = end_time_sec - start_time_sec
    video_f, audio_f, _, title = fetch_youtube_streams(video_id)
    if not audio_f:
        raise RuntimeError("Audio stream format not found")

    temp_a_path = os.path.join(TEST_DIR, f"_temp_{video_id}_audio.m4a")

    try:
        t0 = time.time()
        print("   [1/3] Resolving Audio SIDX Byte Range...")
        a_init, a_rstart, a_rend, a_sub_start = get_sidx_byte_range(audio_f, audio_f["url"], start_time_sec, end_time_sec)
        print(f"   Audio Subsegment Range: {a_rstart}-{a_rend} ({a_rend - a_rstart + 1} bytes, sub_start: {a_sub_start:.2f}s)")

        print("   [2/3] Downloading Audio Subsegment...")
        a_bytes = a_init + download_stream_parallel_range(audio_f["url"], a_rstart, a_rend, "Audio Stream")
        with open(temp_a_path, "wb") as f:
            f.write(a_bytes)

        print("   [3/3] Trimming Audio with FFmpeg...")
        a_seek = max(0.0, start_time_sec - a_sub_start)
        cmd = [
            "ffmpeg", "-y", "-v", "warning",
            "-ss", str(a_seek), "-i", temp_a_path,
            "-t", str(duration_sec),
            "-c:a", "copy",
            output_path
        ]
        execute_ffmpeg(cmd, "Audio FFmpeg trim failed")

        actual_dur = get_file_duration(output_path)
        dur_diff = actual_dur - duration_sec
        print(f"   ✅ Audio Mode Success! Saved to {output_path} ({len(a_bytes)} bytes in {round(time.time() - t0, 2)}s)")
        print(f"      Duration Verification: Target={duration_sec:.2f}s, Actual={actual_dur:.2f}s (Diff={dur_diff:+.2f}s)")
    finally:
        if os.path.exists(temp_a_path):
            os.remove(temp_a_path)


def run_mode_video(video_id, start_time_sec, end_time_sec, output_path):
    """Video Only Mode using SIDX byte range extraction."""
    duration_sec = end_time_sec - start_time_sec
    video_f, audio_f, _, title = fetch_youtube_streams(video_id)
    if not video_f:
        raise RuntimeError("Video stream format not found")

    temp_v_path = os.path.join(TEST_DIR, f"_temp_{video_id}_video.mp4")

    try:
        t0 = time.time()
        print("   [1/3] Resolving Video SIDX Byte Range...")
        v_init, v_rstart, v_rend, v_sub_start = get_sidx_byte_range(video_f, video_f["url"], start_time_sec, end_time_sec)
        print(f"   Video Subsegment Range: {v_rstart}-{v_rend} ({v_rend - v_rstart + 1} bytes, sub_start: {v_sub_start:.2f}s)")

        print("   [2/3] Downloading Video Subsegment...")
        v_bytes = v_init + download_stream_parallel_range(video_f["url"], v_rstart, v_rend, "Video Stream")
        with open(temp_v_path, "wb") as f:
            f.write(v_bytes)

        print("   [3/3] Trimming Video with FFmpeg...")
        v_seek = max(0.0, start_time_sec - v_sub_start)
        cmd = [
            "ffmpeg", "-y", "-v", "warning",
            "-ss", str(v_seek), "-i", temp_v_path,
            "-t", str(duration_sec),
            "-c:v", "copy",
            output_path
        ]
        execute_ffmpeg(cmd, "Video FFmpeg trim failed")

        actual_dur = get_file_duration(output_path)
        dur_diff = actual_dur - duration_sec
        print(f"   ✅ Video Mode Success! Saved to {output_path} ({len(v_bytes)} bytes in {round(time.time() - t0, 2)}s)")
        print(f"      Duration Verification: Target={duration_sec:.2f}s, Actual={actual_dur:.2f}s (Diff={dur_diff:+.2f}s)")
    finally:
        if os.path.exists(temp_v_path):
            os.remove(temp_v_path)


def run_mode_fusion(video_id, start_time_sec, end_time_sec, output_path):
    """Fusion Mode (Video + Audio) using SIDX byte range extraction."""
    duration_sec = end_time_sec - start_time_sec
    video_f, audio_f, _, title = fetch_youtube_streams(video_id)
    if not video_f or not audio_f:
        raise RuntimeError("Required video and audio formats not found")

    temp_v_path = os.path.join(TEST_DIR, f"_temp_{video_id}_fusion_v.mp4")
    temp_a_path = os.path.join(TEST_DIR, f"_temp_{video_id}_fusion_a.m4a")

    try:
        t0 = time.time()
        print("   [1/4] Resolving Video & Audio SIDX Byte Ranges...")
        v_init, v_rstart, v_rend, v_sub_start = get_sidx_byte_range(video_f, video_f["url"], start_time_sec, end_time_sec)
        a_init, a_rstart, a_rend, a_sub_start = get_sidx_byte_range(audio_f, audio_f["url"], start_time_sec, end_time_sec)

        print("   [2/4] Downloading Video Subsegment...")
        v_bytes = v_init + download_stream_parallel_range(video_f["url"], v_rstart, v_rend, "Video Subsegment")
        with open(temp_v_path, "wb") as f:
            f.write(v_bytes)

        print("   [3/4] Downloading Audio Subsegment...")
        a_bytes = a_init + download_stream_parallel_range(audio_f["url"], a_rstart, a_rend, "Audio Subsegment")
        with open(temp_a_path, "wb") as f:
            f.write(a_bytes)

        print("   [4/4] Merging Video & Audio with FFmpeg...")
        v_seek = max(0.0, start_time_sec - v_sub_start)
        a_seek = max(0.0, start_time_sec - a_sub_start)

        cmd = [
            "ffmpeg", "-y", "-v", "warning",
            "-ss", str(v_seek), "-i", temp_v_path,
            "-ss", str(a_seek), "-i", temp_a_path,
            "-t", str(duration_sec),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "copy",
            "-bsf:v", "h264_mp4toannexb",
            "-c:a", "aac",
            output_path
        ]
        execute_ffmpeg(cmd, "Fusion FFmpeg merge failed")

        total_dl = len(v_bytes) + len(a_bytes)
        actual_dur = get_file_duration(output_path)
        dur_diff = actual_dur - duration_sec
        print(f"   ✅ Fusion Mode Success! Saved to {output_path} ({total_dl} bytes in {round(time.time() - t0, 2)}s)")
        print(f"      Duration Verification: Target={duration_sec:.2f}s, Actual={actual_dur:.2f}s (Diff={dur_diff:+.2f}s)")
    finally:
        for p in [temp_v_path, temp_a_path]:
            if os.path.exists(p):
                os.remove(p)


def run_mode_standard(video_id, start_time_sec, end_time_sec, output_path):
    """Standard MP4 / Progressive Stream Mode."""
    duration_sec = end_time_sec - start_time_sec
    video_f, audio_f, standard_f, title = fetch_youtube_streams(video_id)

    target_fmt = standard_f or video_f
    if not target_fmt:
        raise RuntimeError("No suitable stream format found for standard mode")

    temp_path = os.path.join(TEST_DIR, f"_temp_{video_id}_standard.mp4")

    try:
        t0 = time.time()
        print("   [1/3] Resolving Standard Stream Range...")
        has_sidx = bool(target_fmt.get("initRange") and target_fmt.get("indexRange"))

        if has_sidx:
            s_init, s_rstart, s_rend, s_sub_start = get_sidx_byte_range(target_fmt, target_fmt["url"], start_time_sec, end_time_sec)
            s_bytes = s_init + download_stream_parallel_range(target_fmt["url"], s_rstart, s_rend, "Standard Stream")
            seek_val = max(0.0, start_time_sec - s_sub_start)
        else:
            c_len = int(target_fmt.get("contentLength", 0))
            if c_len > 0:
                s_bytes = download_stream_parallel_range(target_fmt["url"], 0, c_len - 1, "Standard Full Stream")
            else:
                s_bytes = download_chunk(target_fmt["url"], 0, 10 * 1024 * 1024)
            seek_val = start_time_sec

        with open(temp_path, "wb") as f:
            f.write(s_bytes)

        print("   [2/3] Trimming Standard Stream with FFmpeg...")
        cmd = [
            "ffmpeg", "-y", "-v", "warning",
            "-ss", str(seek_val), "-i", temp_path,
            "-t", str(duration_sec),
            "-c", "copy",
            output_path
        ]
        execute_ffmpeg(cmd, "Standard stream FFmpeg trim failed")

        actual_dur = get_file_duration(output_path)
        dur_diff = actual_dur - duration_sec
        print(f"   ✅ Standard Mode Success! Saved to {output_path} ({len(s_bytes)} bytes in {round(time.time() - t0, 2)}s)")
        print(f"      Duration Verification: Target={duration_sec:.2f}s, Actual={actual_dur:.2f}s (Diff={dur_diff:+.2f}s)")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def run_all_tests(video_id, start_time, end_time):
    """Run test suite for all 4 download modes with duration verification."""
    target_dur = end_time - start_time
    print("=" * 70)
    print("🚀 RUNNING FULL SIDX MULTI-MODE TEST SUITE WITH DURATION VERIFICATION")
    print(f"   Video ID:        {video_id}")
    print(f"   Time Range:      {start_time}s -> {end_time}s")
    print(f"   Target Duration: {target_dur:.2f}s")
    print("=" * 70)

    modes = [
        ("AUDIO ONLY", "audio", os.path.join(TEST_DIR, "test_out_audio.m4a"), run_mode_audio),
        ("VIDEO ONLY", "video", os.path.join(TEST_DIR, "test_out_video.mp4"), run_mode_video),
        ("FUSION (VIDEO+AUDIO)", "fusion", os.path.join(TEST_DIR, "test_out_fusion.mp4"), run_mode_fusion),
        ("STANDARD MP4", "standard", os.path.join(TEST_DIR, "test_out_standard.mp4"), run_mode_standard),
    ]

    results = {}

    for name, mode_key, out_file, func in modes:
        print(f"\n--- [TEST MODE: {name}] ---")
        try:
            func(video_id, start_time, end_time, out_file)
            if os.path.exists(out_file) and os.path.getsize(out_file) > 0:
                act_dur = get_file_duration(out_file)
                diff = act_dur - target_dur
                if abs(diff) <= 1.0:
                    results[mode_key] = f"PASSED (Duration: {act_dur:.2f}s, Target: {target_dur:.2f}s, Diff: {diff:+.2f}s)"
                else:
                    results[mode_key] = f"FAILED (Duration mismatch: Actual {act_dur:.2f}s vs Target {target_dur:.2f}s)"
            else:
                results[mode_key] = "FAILED (Output file empty or missing)"
        except Exception as e:
            results[mode_key] = f"FAILED ({e})"

    print("\n" + "=" * 70)
    print("📊 MULTI-MODE TEST SUITE DURATION SUMMARY")
    print("=" * 70)
    all_passed = True
    for name, mode_key, out_file, _ in modes:
        status = results.get(mode_key, "UNKNOWN")
        icon = "✅" if "PASSED" in status else "❌"
        print(f"  {icon} {name:<25}: {status}")
        if "FAILED" in status:
            all_passed = False
        # Clean test output files
        if os.path.exists(out_file):
            try:
                os.remove(out_file)
            except Exception:
                pass
    print("=" * 70)

    if all_passed:
        print("\n🎉 ALL 4 SIDX DOWNLOAD MODES MATCHED TARGET DURATION NEARLY PERFECTLY!")
        sys.exit(0)
    else:
        print("\n❌ SOME TEST MODES FAILED DURATION VERIFICATION!")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="SIDX Multi-Mode YouTube Downloader & Duration Verifier")
    parser.add_argument("video", nargs="?", default=DEFAULT_VIDEO_ID, help="YouTube Video ID or URL (default: C8QYVwX0M6g)")
    parser.add_argument("--start", "-s", type=parse_time, default=DEFAULT_START_TIME, help="Start time in seconds or HH:MM:SS (default: 17.0)")
    parser.add_argument("--end", "-e", type=parse_time, default=DEFAULT_END_TIME, help="End time in seconds or HH:MM:SS (default: 79.0)")
    parser.add_argument("--mode", "-m", choices=["audio", "video", "fusion", "standard", "all"], default="all", help="Download mode (default: all)")
    parser.add_argument("--output", "-o", type=str, help="Output file path for single mode execution")

    args = parser.parse_args()
    video_id = extract_video_id(args.video)

    if args.mode == "all":
        run_all_tests(video_id, args.start, args.end)
    else:
        out_ext = ".m4a" if args.mode == "audio" else ".mp4"
        output = args.output or os.path.join(TEST_DIR, f"sidx_{args.mode}_out{out_ext}")

        print("=" * 60)
        print(f"🚀 RUNNING SIDX DOWNLOADER [MODE: {args.mode.upper()}]")
        print(f"   Video ID:    {video_id}")
        print(f"   Time Window: {args.start}s -> {args.end}s (Target Duration: {args.end - args.start:.2f}s)")
        print(f"   Output File: {output}")
        print("=" * 60)

        if args.mode == "audio":
            run_mode_audio(video_id, args.start, args.end, output)
        elif args.mode == "video":
            run_mode_video(video_id, args.start, args.end, output)
        elif args.mode == "fusion":
            run_mode_fusion(video_id, args.start, args.end, output)
        elif args.mode == "standard":
            run_mode_standard(video_id, args.start, args.end, output)


if __name__ == "__main__":
    main()
