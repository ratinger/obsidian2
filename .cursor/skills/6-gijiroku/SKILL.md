---
name: 6-gijiroku
description: >-
  Transcribes the newest recording (Web会議 mkv or 電話 mp3) with Python
  gemini-3.5-transcribe. Writes the transcript next to the audio and
  minutes under 11_名古屋/ or 12_八千代/. Always AskQuestion first: Web会議
  or 電話, then the counterpart name. 伸一郎 is always a participant.
  Use when the user runs /6_gijiroku, says 6_gijiroku, or wants a 議事録 from
  a Web会議 or phone recording.
---

# 6_gijiroku — Web会議／電話から議事録

文字起こしは音声と同じ日付フォルダ。議事録だけ Vault。根拠は [[02_stored/20260825_braveの録音]] と [[02_stored/20260829_八千代との電話を録音する]]。

前提: 備考１（`google-genai` + APIキー）。文字起こしは `scripts/transcribe.py`。`gemini` CLI は使わない。

## 主な登場人物

話者ラベル（`spk`）と議事録の呼び方は、この名前に割り当てる。全員が毎回出るわけではない。音声に出てきた人だけ書く。

- **名古屋**: 谷津さん、伸一郎、美奈子さん、和子さん
- **八千代**: 染川さん、伸一郎、有子さん、健一さん、栞さん

「母親」は和子さん、「ケンさん」は健一さん、と読む。

## ワークフロー

0. **最初に止まる。** AskQuestion で聞く。答えが来るまでファイルを取らない・分割しない・起こさない。チャットで聞き返さない。**伸一郎は必ず参加**するので、選択肢に出さない。

   **1つ目（必須）:** 今回は Web会議か、電話か。

   | id | label |
   | --- | --- |
   | web | Web会議 |
   | phone | 電話 |

   **2つ目（1つ目の答えのあと。同じターンで出さない）:** 相手は誰か（ファイル名用。複数可）。

   Web会議の選択肢:

   | id | label |
   | --- | --- |
   | wazuko | 和子さん |
   | yatsu | 谷津さん |
   | minako | 美奈子さん |
   | kenichi | 健一さん |

   電話の選択肢:

   | id | label |
   | --- | --- |
   | shiori | 栞さん |
   | somekawa | 染川さん |

   強調・除外・その他は聞かない。ユーザーが書いたときだけ使う。

   種類ごとの置き場:

   | | Web会議 | 電話 |
   | --- | --- | --- |
   | 相手名 | 上で選んだ人（複数なら主たる相手、または並べる） | 同じ |
   | 参加者 | 伸一郎 ＋ 選んだ相手（音声に出た人だけ書く） | 同じ |
   | 音声フォルダ | `C:\Users\ozeki\Videos\Web会議` | `C:\Users\ozeki\Videos\電話` |
   | 探す拡張子 | `.mkv`（直下なら日付フォルダへ移す） | `.mp3`（mkv が電話フォルダにあれば mp3 にしてから） |
   | 議事録 | `11_名古屋` | `12_八千代` |

1. 選んだ種類のフォルダから、更新日時が **最新** の対象ファイルを1本取る（日付フォルダも含めて再帰）。0件なら止めて報告する。

```powershell
Get-ChildItem -LiteralPath "C:\Users\ozeki\Videos\Web会議" -Filter "*.mkv" -Recurse |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1

Get-ChildItem -LiteralPath "C:\Users\ozeki\Videos\電話" -Filter "*.mp3" -Recurse |
  Where-Object { $_.Name -notmatch '^part\d+\.mp3$' } |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
```

Web会議の mkv が `Web会議` 直下なら、ファイル名から日付を取り `YYYYMMDD` フォルダを作って移してから進む。電話の本体 mp3 が直下なら同様。

2. 長さを秒で取る。**900秒超**なら **15分（900秒）単位** で分割。分割ファイルは **元音声と同じ日付フォルダ** に置く。話者識別付きは1本あたり約30分が上限なので、15分の方が欠けにくい

```powershell
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "入力"
```

3. Web会議は mkv のまま上げない。mp3 にする。電話はすでに mp3 なら変換しない（15分超だけ分割）。

```powershell
cd "C:\Users\ozeki\Videos\Web会議\YYYYMMDD"
ffmpeg -i "YYYYMMDD_HHMMSS.mkv" -vn -acodec libmp3lame "YYYYMMDD_HHMMSS.mp3"
```

分割時（Web会議・電話とも。15分＝900秒）:

```powershell
ffmpeg -i "入力" -vn -ss 0 -t 900 -acodec libmp3lame "part0.mp3"
ffmpeg -i "入力" -vn -ss 900 -t 900 -acodec libmp3lame "part1.mp3"
ffmpeg -i "入力" -vn -ss 1800 -acodec libmp3lame "part2.mp3"
```

42分なら part0 / part1 / part2。後半の時刻は切れ目（15:00、30:00）を足す。

4. `scripts/transcribe.py` で起こす（Vault ルートで実行）。`gemini` CLI は使わない。

```powershell
python .cursor/skills/6-gijiroku/scripts/transcribe.py "C:\Users\ozeki\Videos\Web会議\YYYYMMDD\part0.mp3" -o "C:\Users\ozeki\Videos\Web会議\YYYYMMDD\part0_文字起こし.txt"
```

5. `transcribe.py` は話者（`spk_1` など）と時刻を付けて出す。それを **主な登場人物** の名前に割り当てる。途中で入れ替わることがある。分割分は **この順で1本に**つなぐ。後半の時刻は切れ目（15:00、30:00）を足す。

6. **文字起こし** は日付フォルダへ。**議事録** だけ地域フォルダへ。音声と文字起こしは Vault にコピーしない。同じ日付の出力が既にあるときは、上書き前に確認する。

日付はファイル名の先頭8桁（`20260828_165302.mkv` → `20260828`）。古い `2026-08-28 16-53-02.mkv` も `20260828` に読む。

### Web会議の出力

| 種類 | フォルダ名 | ファイル名 |
| --- | --- | --- |
| 音声（元） | `C:\Users\ozeki\Videos\Web会議\YYYYMMDD` | `YYYYMMDD_HHMMSS.mkv` |
| 音声（分割） | 同じ | `part0.mp3` / `part1.mp3` / `part2.mp3`（15分単位） |
| 文字起こし | 同じ | `YYYYMMDD_相手_文字起こし.md` |
| 議事録 | `11_名古屋` | `YYYYMMDD_相手_議事録.md` |

### 電話の出力

| 種類 | フォルダ名 | ファイル名 |
| --- | --- | --- |
| 音声 | `C:\Users\ozeki\Videos\電話\YYYYMMDD` | `YYYYMMDD_相手.mp3` |
| 音声（分割） | 同じ | `part0.mp3` / `part1.mp3` / `part2.mp3`（15分単位） |
| 文字起こし | 同じ | `YYYYMMDD_相手_文字起こし.md` |
| 議事録 | `12_八千代` | `YYYYMMDD_相手_議事録.md` |

### 文字起こしの先頭

Web会議:

```markdown
# YYYY-MM-DD 相手とのテレビ会議（文字起こし）

日時:
参加者:
元録音: `C:\Users\ozeki\Videos\Web会議\YYYYMMDD\YYYYMMDD_HHMMSS.mkv`
文字起こし: Gemini 3.5 Transcribe（Python）
```

電話:

```markdown
# YYYY-MM-DD 相手との電話（文字起こし）

日時:
参加者:
元録音: `C:\Users\ozeki\Videos\電話\YYYYMMDD\YYYYMMDD_相手.mp3`
文字起こし: Gemini 3.5 Transcribe（Python）
```

### 議事録

文字起こしを要約する。無いことは書かない。推測は「推測」と明記する。文字起こしへはフルパス（`[[リンク]]` は使わない）。聞いておいた考慮事項を使う。

```markdown
# YYYY-MM-DD 相手とのテレビ会議（議事録）
# または: # YYYY-MM-DD 相手との電話（議事録）

日時:
参加者:
元録音: （フルパス）
文字起こし: （フルパス）

## 結論
## 決まったこと
## やること（誰が）
## 保留・次回
```

## 止まるとき

- 対象フォルダに録音が無い
- `ffmpeg` / `ffprobe` / Python（`google-genai`・APIキー）が動かない → 備考１
- 無料枠のトークン上限 → より短い分割で再試行
- 録音は個人情報。Vault に残すのは議事録だけ（`11_名古屋` または `12_八千代`）
