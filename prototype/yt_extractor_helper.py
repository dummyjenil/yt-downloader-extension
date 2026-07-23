import sys
import json
import yt_dlp

def extract_formats(video_id):
    ydl_opts = {
        'quiet': True,
        'cookiesfrombrowser': ('chrome',),
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
        
    title = info.get('title', 'YouTube_Audio')
    formats = info.get('formats', [])
    audio_streams = []

    for f in formats:
        if f.get('acodec') != 'none' and f.get('vcodec') == 'none':
            track = f.get('audio_track')
            lang = f.get('language') or ''
            disp = ''
            if isinstance(track, dict):
                disp = track.get('displayName') or ''
                if not lang and track.get('id'):
                    lang = track['id'].split('.')[0]
            elif isinstance(track, str):
                disp = track

            if not lang and f.get('format_note'):
                disp = disp or f.get('format_note')

            audio_streams.append({
                'formatId': str(f.get('format_id') or ''),
                'itag': int(f.get('itag') or 0),
                'ext': str(f.get('ext') or ''),
                'codec': str(f.get('acodec') or ''),
                'bitrate': int(f.get('tbr') or 0),
                'contentLength': int(f.get('filesize') or f.get('filesize_approx') or 0),
                'langCode': str(lang or 'und'),
                'displayName': str(disp or 'Default'),
                'url': str(f.get('url') or '')
            })

    return {'title': title, 'audioStreams': audio_streams}

if __name__ == '__main__':
    video_id = sys.argv[1] if len(sys.argv) > 1 else 'wk62YFS3gqc'
    res = extract_formats(video_id)
    print(json.dumps(res))
