import os
import subprocess

# Define names for temporary test files
video_in = "temp_video.mp4"
audio_en = "temp_audio_en.mp3"
audio_hi = "temp_audio_hi.mp3"
sub_en = "temp_sub_en.srt"
sub_hi = "temp_sub_hi.srt"
final_output = "test_output.mp4"

print("1. Creating 10-second dummy assets for testing...")

# Create a blank 10-second video clip
subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=640x360:d=10', '-pix_fmt', 'yuv420p', video_in], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# Create 2 different audio files (Track 1: Low tone, Track 2: High tone)
subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i', 'sine=f=440:d=10', '-c:a', 'libmp3lame', audio_en], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i', 'sine=f=880:d=10', '-c:a', 'libmp3lame', audio_hi], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# Create English Subtitle File (.srt)
with open(sub_en, "w", encoding="utf-8") as f:
    f.write("1\n00:00:01,000 --> 00:00:05,000\nHello! This is the English Audio Track.\n\n2\n00:00:06,000 --> 00:00:09,000\nTesting multi-track setup.")

# Create Hindi Subtitle File (.srt)
with open(sub_hi, "w", encoding="utf-8") as f:
    f.write("1\n00:00:01,000 --> 00:00:05,000\nनमस्ते! यह हिंदी ऑडियो ट्रैक है।\n\n2\n00:00:06,000 --> 00:00:09,000\nमल्टी-ट्रैक टेस्टिंग सफल रही।")


print("2. Merging all tracks into a single MP4...")

# FFmpeg execution command
ffmpeg_command = [
    'ffmpeg', '-y',
    '-i', video_in,     # Input 0
    '-i', audio_en,     # Input 1
    '-i', audio_hi,     # Input 2
    '-i', sub_en,       # Input 3
    '-i', sub_hi,       # Input 4
    
    # Mapping streams to output file
    '-map', '0:v',      # Video from input 0
    '-map', '1:a',      # First audio from input 1
    '-map', '2:a',      # Second audio from input 2
    '-map', '3:s',      # First subtitle from input 3
    '-map', '4:s',      # Second subtitle from input 4
    
    # Stream codecs (copying streams saves encoding time and quality)
    '-c:v', 'copy',
    '-c:a', 'copy',
    '-c:s', 'mov_text', # Required conversion format for MP4 text subtitles
    
    # Metadata labels for Audio
    '-metadata:s:a:0', 'language=eng', '-metadata:s:a:0', 'title=English Audio',
    '-metadata:s:a:1', 'language=hin', '-metadata:s:a:1', 'title=Hindi Audio',
    
    # Metadata labels for Subtitles
    '-metadata:s:s:0', 'language=eng', '-metadata:s:s:0', 'title=English Subtitles',
    '-metadata:s:s:1', 'language=hin', '-metadata:s:s:1', 'title=Hindi Subtitles',
    
    final_output
]

# Run the merge operation
result = subprocess.run(ffmpeg_command, capture_output=True, text=True)

if result.returncode == 0:
    print(f"\nSuccess! Open '{final_output}' in VLC Media Player to test track selection.")
    
    # Optional clean up of temporary source files
    for file in [video_in, audio_en, audio_hi, sub_en, sub_hi]:
        os.remove(file)
else:
    print("\nAn error occurred:")
    print(result.stderr)
