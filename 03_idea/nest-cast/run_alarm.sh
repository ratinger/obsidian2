#!/bin/bash
cd /home/pi/nest-cast
source venv/bin/activate

# HTTP サーバー（既に動いていれば省略可）
cd media
python3 -m http.server 8000 &
HTTP_PID=$!
sleep 2
cd ..

python3 play_mp3.py

kill $HTTP_PID 2>/dev/null
