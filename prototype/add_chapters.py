import subprocess
import tempfile
import os

def create_blank_video_with_chapters(output_file, duration, chapters):
    # FFmpeg metadata
    metadata = ";FFMETADATA1\n"

    for title, (start, end) in chapters.items():
        metadata += "[CHAPTER]\n"
        metadata += "TIMEBASE=1/1000\n"
        metadata += f"START={int(start * 1000)}\n"
        metadata += f"END={int(end * 1000)}\n"
        metadata += f"title={title}\n"

    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".txt",
        delete=False,
        encoding="utf-8"
    ) as f:
        f.write(metadata)
        metadata_file = f.name

    try:
        cmd = [
            "ffmpeg",
            "-f", "lavfi",
            "-i", f"color=c=black:s=1920x1080:d={duration}",
            "-i", metadata_file,
            "-map", "0:v",
            "-map_metadata", "1",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-t", str(duration),
            "-y",
            output_file,
        ]

        subprocess.run(cmd, check=True)

    finally:
        os.remove(metadata_file)


chapters = {
    "Intro": (0, 10),
    "Chapter 1": (10, 30),
    "Chapter 2": (30, 50),
    "Ending": (50, 60),
}

create_blank_video_with_chapters(
    output_file="blank_with_chapters.mp4",
    duration=60,
    chapters=chapters,
)