#!/bin/bash
set -euo pipefail
cd /home/pi/nest-cast
source venv/bin/activate

# HTTP サーバー（未起動なら起動）
if ! pgrep -f "python3 -m http.server 8000" >/dev/null 2>&1; then
  cd media
  python3 -m http.server 8000 &
  sleep 2
  cd ..
fi

python3 play_mp3.py
