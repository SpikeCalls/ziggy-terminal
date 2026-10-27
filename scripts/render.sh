#!/usr/bin/env bash
# Full pipeline: serve the studio, render 495 frames on 2 workers, synthesize the soundtrack, mux to MP4.
set -euo pipefail
cd "$(dirname "$0")/../studio"
python3 -m http.server 8765 >/dev/null 2>&1 & SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 1
rm -rf frames && mkdir frames
node tools/frames.mjs 0 248 & node tools/frames.mjs 248 495 & wait
python3 music.py
ffmpeg -y -loglevel error -framerate 30 -i frames/f%04d.jpg -i ziggy_music.wav \
  -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart \
  ../media/ziggy-terminal.mp4
echo "→ media/ziggy-terminal.mp4"
