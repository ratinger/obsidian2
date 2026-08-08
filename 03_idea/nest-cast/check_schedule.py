#!/usr/bin/env python3
"""time_schedule.csv の時刻に合わせて run_scheduled.sh を実行する。"""
import subprocess
import sys
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent
CONFIG = BASE / "config.txt"
SCHEDULE = BASE / "time_schedule.csv"
ONCE = BASE / "time_schedule_once.csv"
STATE = BASE / ".last_triggered"
RUN_SCRIPT = BASE / "run_scheduled.sh"


def log(msg: str) -> None:
    print(f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}")


def is_enabled() -> bool:
    """config.txt の enabled=1/0 で定時再生 ON/OFF。ファイル無しは ON。"""
    if not CONFIG.exists():
        return True
    for line in CONFIG.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        if key.strip().lower() != "enabled":
            continue
        v = value.strip().lower()
        if v in ("1", "true", "on", "yes"):
            return True
        if v in ("0", "false", "off", "no"):
            return False
    return True


def normalize_time(raw: str) -> str | None:
    raw = raw.strip()
    if not raw or raw.startswith("#"):
        return None
    if "," in raw:
        raw = raw.split(",", 1)[0].strip()
    parts = raw.split(":")
    if len(parts) != 2:
        return None
    try:
        hour, minute = int(parts[0]), int(parts[1])
    except ValueError:
        return None
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    return f"{hour:02d}:{minute:02d}"


def load_times(path: Path) -> list[str]:
    if not path.exists():
        return []
    times: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        t = normalize_time(line)
        if t:
            times.append(t)
    return times


def already_played(now_key: str) -> bool:
    return STATE.exists() and STATE.read_text(encoding="utf-8").strip() == now_key


def mark_played(now_key: str) -> None:
    STATE.write_text(now_key, encoding="utf-8")


def remove_once_time(matched: str) -> None:
    if not ONCE.exists():
        return
    kept: list[str] = []
    for line in ONCE.read_text(encoding="utf-8").splitlines():
        t = normalize_time(line)
        if t != matched:
            kept.append(line)
    ONCE.write_text("\n".join(kept) + ("\n" if kept else ""), encoding="utf-8")


def main() -> int:
    now = datetime.now()
    now_key = now.strftime("%Y-%m-%d %H:%M")
    current = now.strftime("%H:%M")

    recurring = load_times(SCHEDULE)
    once_times = load_times(ONCE)
    matched_once = current in once_times

    if current not in recurring and not matched_once:
        return 0

    if not is_enabled():
        return 0

    if already_played(now_key):
        return 0

    mark_played(now_key)
    source = "once" if matched_once else "daily"
    log(f"スケジュール一致 ({source}): {current} → 再生開始")

    try:
        subprocess.run([str(RUN_SCRIPT)], check=True, cwd=BASE)
    except subprocess.CalledProcessError as exc:
        log(f"再生失敗: exit {exc.returncode}")
        return 1

    if matched_once:
        remove_once_time(current)
        log(f"一度きりスケジュール削除: {current}")

    log("再生完了")
    return 0


if __name__ == "__main__":
    sys.exit(main())
