import subprocess
import os

input_video = "input.mp4"
subtitle_file = "subtitle.srt"
output_video = "output_soft.mp4"

# Check files
if not os.path.exists(input_video):
    raise FileNotFoundError(f"Video not found: {input_video}")

if not os.path.exists(subtitle_file):
    raise FileNotFoundError(f"Subtitle file not found: {subtitle_file}")

# FFmpeg command
command = [
    "ffmpeg",
    "-y",
    "-i", input_video,
    "-i", subtitle_file,
    "-c:v", "copy",          # Video without re-encoding
    "-c:a", "copy",          # Audio without re-encoding
    "-c:s", "mov_text",      # MP4 subtitle format
    "-metadata:s:s:0", "language=eng",
    output_video
]

try:
    subprocess.run(command, check=True)
    print(f"Done! Soft subtitles added to: {output_video}")
except subprocess.CalledProcessError as e:
    print("FFmpeg failed!")
    print(e)