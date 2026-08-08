#!/usr/bin/env python3
import time
import pychromecast

# === 設定 ===
DEVICE_NAME = "全体"  # スピーカーグループ（3台同時）。1台のみ: キッチン / オフィス / ベッドルーム
PI_IP = "192.168.124.20"
MP3_FILE = "12_SchoolChime.mp3"
HTTP_PORT = 8000
# ============

MEDIA_URL = f"http://{PI_IP}:{HTTP_PORT}/{MP3_FILE}"


def main():
    chromecasts, browser = pychromecast.get_chromecasts()
    cast = next(
        (c for c in chromecasts if c.name == DEVICE_NAME),
        None,
    )

    if cast is None:
        pychromecast.discovery.stop_discovery(browser)
        names = [c.name for c in chromecasts]
        raise SystemExit(f"「{DEVICE_NAME}」が見つかりません。一覧: {names}")

    cast.wait()
    pychromecast.discovery.stop_discovery(browser)
    mc = cast.media_controller
    print(f"再生: {MEDIA_URL} → {DEVICE_NAME} ({cast.cast_info.host})")
    mc.play_media(MEDIA_URL, "audio/mp3")
    mc.block_until_active()
    print("再生開始。停止するまで待機…")
    time.sleep(30)  # テスト用。本番は曲長に合わせる


if __name__ == "__main__":
    main()
