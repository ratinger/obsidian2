#!/usr/bin/env python3
import pychromecast

chromecasts, browser = pychromecast.get_chromecasts()
pychromecast.discovery.stop_discovery(browser)

if not chromecasts:
    print("Cast デバイスが見つかりません")
    raise SystemExit(1)

print("見つかった Cast デバイス:")
for cc in chromecasts:
    info = cc.cast_info
    print(f"  名前: {info.friendly_name}")
    print(f"  IP:   {info.host}:{info.port}")
    print(f"  種別: {info.cast_type}")
    print()
