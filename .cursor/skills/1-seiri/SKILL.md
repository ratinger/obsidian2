---
name: 1-seiri
description: >-
  Organizes obsidian2 vault notes from 00_temporary to 02_stored with date
  prefixes, YAML/inline tags (2–5), ~40-char summaries, and index updates.
  Use when the user runs /1_seiri, says 1_seiri, 整理, or wants to file
  temporary Obsidian notes into 02_stored and 01_index/index.md.
---

# 1_seiri — 一時ノート整理

obsidian2 Vault の `00_temporary` 直下ファイルを整理し、`02_stored` へ格納する。Obsidian プラグイン `vault-seiri` と同じ仕様で実行する。

## 優先順位

1. **Obsidian が開いている** → ユーザーに `/1_seiri`（Vault Seiri プラグイン）の実行を案内してもよい。ユーザーが Cursor からの実行を求めている場合は以下をファイル操作で実施。
2. **Cursor から実行** → 下記ワークフローをエージェントが直接実施するか、次を実行する:

```bash
node .cursor/skills/1-seiri/scripts/seiri.mjs
```

（ワークスペースルート = Vault ルートで実行）

## ワークフロー

```
00_temporary/*  →  メタデータ付与  →  YYYYMMDD_リネーム  →  02_stored/
                                              ↓
                                   01_index/index.md へ追記
```

### 対象

- `00_temporary/` **直下のファイルのみ**（サブフォルダは対象外）
- 対象が 0 件なら停止し、その旨を報告

### 日付

- ファイル名接頭辞: `YYYYMMDD_`（ローカル日付）
- index 見出し: `## YYYY-MM-DD`
- 既に `YYYYMMDD_` で始まるファイル名には接頭辞を二重付けしない

### 各ファイルの先頭（検索用）

1. **YAML frontmatter**（既存はマージ）
   - `tags`: 2〜5 個（配列）
   - `summary`: 概要（約 40 字）
2. **表示ブロック**（`<!-- vault-seiri:start -->` 〜 `end -->` で囲む）
   - 1 行目: `#タグ1 #タグ2 …`（YAML と同じタグ）
   - 空行
   - `> 概要テキスト`
3. その下に元本文（既存の seiri ブロックは除去してから再挿入）

### タグ（2〜5 個）

優先順で候補を集め、重複除去後に最大 5 個:

1. 既存 frontmatter の `tags`
2. 本文の `#タグ`
3. キーワード（Obsidian, Claude, MCP, 日記, AI, 記事, 介護, 開発 など）
4. タイトル・ファイル名からの語
5. 不足時のフォールバック: メモ, 整理済み, ストック, インプット, 参考

タグは `/[\\/:*?"<>|]/` を含まない。Obsidian で検索可能な短い語にする。

### 概要（約 40 字）

優先順:

1. 既存 `summary`
2. frontmatter `title`（`|` 以降は除去）を約 40 字に整形
3. 本文最初の段落
4. ファイル名

句点・読点で自然に切る。超過時は `…` で終える。

### 移動

- 先に内容を更新してから移動
- 移動先: `02_stored/YYYYMMDD_元ファイル名`
- 同名衝突時: `_2`, `_3` … を拡張子直前に付与

### index 更新（`01_index/index.md`）

- ファイルが無ければヘッダーを作成:

```markdown
# インデックス

整理済みノートの一覧。
```

- 当日の `## YYYY-MM-DD` セクションに 1 行追記（同一行が既にあれば重複追加しない）:

```markdown
- #タグ1 #タグ2 — 概要 — [[02_stored/YYYYMMDD_ファイル名（拡張子なし）]]
```

## 完了報告

- 処理件数
- 移動先パス一覧
- 付与したタグ・概要の例
- エラーがあればファイル名と理由

## 参照

- 実装の正: `.obsidian/plugins/vault-seiri/main.js`
- 自動実行スクリプト: [scripts/seiri.mjs](scripts/seiri.mjs)
