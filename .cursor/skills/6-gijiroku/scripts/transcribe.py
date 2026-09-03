"""Transcribe one audio file with gemini-3.5-transcribe (not Gemini CLI)."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

ENV_PATH = Path.home() / ".gemini" / ".env"
MODEL = "gemini-3.5-transcribe"
GENERATION_CONFIG = {
    "transcription_config": {
        "mode": {
            "type": "verbatim",
            "diarization_mode": "speaker",
            "timestamp_granularities": ["word"],
        }
    }
}


def load_api_key(path: Path) -> None:
    if not path.is_file():
        raise SystemExit(f"APIキーがありません: {path}")
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        if key.strip() == "GEMINI_API_KEY":
            os.environ["GEMINI_API_KEY"] = value.strip().strip('"').strip("'")
            return
    raise SystemExit(f"GEMINI_API_KEY が {path} にありません")


def _as_mapping(obj: Any) -> dict[str, Any] | None:
    if obj is None:
        return None
    if isinstance(obj, dict):
        return obj
    for name in ("model_dump", "to_json_dict", "to_dict"):
        fn = getattr(obj, name, None)
        if callable(fn):
            try:
                dumped = fn()
            except TypeError:
                dumped = fn(mode="python") if name == "model_dump" else None
            if isinstance(dumped, dict):
                return dumped
    return None


def _walk(obj: Any):
    mapping = _as_mapping(obj)
    if mapping is not None:
        yield mapping
        for value in mapping.values():
            yield from _walk(value)
        return
    if isinstance(obj, (list, tuple)):
        for item in obj:
            yield from _walk(item)


def _parse_offset(val: Any) -> float:
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    text = str(val).strip().rstrip("sS")
    try:
        return float(text)
    except ValueError:
        return 0.0


def _fmt_mmss(sec: float) -> str:
    total = max(0, int(sec))
    return f"{total // 60}:{total % 60:02d}"


def format_diarized(result: Any) -> str | None:
    words: list[tuple[str, str, float]] = []
    for node in _walk(result):
        if str(node.get("type", "")).lower() != "word_info":
            continue
        text = str(node.get("text") or "").strip()
        if not text:
            continue
        speaker = str(node.get("speaker") or "spk_1")
        words.append((speaker, text, _parse_offset(node.get("start_offset"))))
    if not words:
        return None

    lines: list[str] = []
    current_speaker = words[0][0]
    current_start = words[0][2]
    buf: list[str] = []

    def flush() -> None:
        if not buf:
            return
        joined = "".join(buf).strip()
        if joined:
            lines.append(f"**{current_speaker}（{_fmt_mmss(current_start)}）**\n")
            lines.append(joined)
            lines.append("")

    for speaker, text, start in words:
        if speaker != current_speaker and buf:
            flush()
            current_speaker = speaker
            current_start = start
            buf = [text]
        else:
            if not buf:
                current_speaker = speaker
                current_start = start
            buf.append(text)
    flush()
    return "\n".join(lines).strip() + "\n" if lines else None


def transcribe(audio_path: Path) -> str:
    from google import genai

    client = genai.Client()
    audio = client.files.upload(file=str(audio_path))
    result = client.interactions.create(
        model=MODEL,
        input=[
            {
                "type": "audio",
                "uri": audio.uri,
                "mime_type": audio.mime_type,
            }
        ],
        generation_config=GENERATION_CONFIG,
    )
    status = getattr(result, "status", None)
    formatted = format_diarized(result)
    text = formatted or getattr(result, "output_text", None) or ""
    if status and status != "completed":
        raise SystemExit(f"status={status}")
    if not str(text).strip():
        raise SystemExit("文字起こしが空です")
    return str(text)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="gemini-3.5-transcribe で音声を文字起こしする")
    parser.add_argument("audio", type=Path, help="mp3 / wav など（mkv は先に ffmpeg で変換）")
    parser.add_argument("-o", "--out", type=Path, help="UTF-8 で書き出す先（PowerShell 経由の文字化け回避）")
    args = parser.parse_args()
    audio_path = args.audio.expanduser().resolve()
    if not audio_path.is_file():
        raise SystemExit(f"ファイルがありません: {audio_path}")

    load_api_key(ENV_PATH)
    text = transcribe(audio_path)
    if not text.endswith("\n"):
        text += "\n"
    if args.out:
        out_path = args.out.expanduser().resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(text, encoding="utf-8")
        print(f"wrote {out_path} ({len(text)} chars)", file=sys.stderr)
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()
