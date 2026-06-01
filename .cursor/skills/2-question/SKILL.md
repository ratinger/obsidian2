---
name: 2-question
description: >-
  Asks the user what they want to know, then answers from obsidian2 vault
  knowledge using 01_index/index.md and linked 02_stored notes. Use when the
  user runs /2_question, says 2_question, or wants Q&A over their indexed notes.
---

# 2_question — インデックスベース Q&A

Vault の整理済みノート（`01_index/index.md` → `02_stored/`）を根拠に、ユーザーの質問へ答える。

## フェーズ 1: 質問を聞く（必須）

コマンド開始時、**ユーザーがまだ具体的な質問を書いていない場合**は、回答の前に必ず次のように聞く（1回でよい）:

> どんなことを知りたいですか？  
> （例: Obsidian と日記の連携、Claude × MCP の使い方、整理済みノートのテーマなど）

- ユーザーが同じメッセージで質問も書いている場合（例: `/2_question NotebookLMとの違いは？`）は、このフェーズを省略してフェーズ 2 へ進む。
- **フェーズ 1 の時点では index を読まない。** 質問が確定してから読む。

## フェーズ 2: インデックスとノートを読む

1. `01_index/index.md` を読む
2. 各行から次を抽出する:
   - インラインタグ（`#タグ`）
   - 概要（`—` で区切られた中央部分）
   - wikilink（`[[02_stored/...]]`）
3. ユーザーの質問に関連しそうなエントリを選ぶ（タグ・概要・リンク先ファイル名の一致）
4. 選んだリンク先の **全文** を `02_stored/` から読む（複数可）
5. インデックスに該当が薄い場合は `02_stored/` をキーワード検索して補完してよい

### index 行の形式

```markdown
- #タグ1 #タグ2 — 概要テキスト — [[02_stored/YYYYMMDD_ファイル名]]
```

## フェーズ 3: 回答する

日本語で、次の構成を守る:

1. **結論**（1〜3文）
2. **根拠**（読んだノートの要点。推測は「推測」と明記）
3. **参照ノート**（使った `[[02_stored/...]]` を列挙）

### ルール

- **優先する情報源**: `01_index/index.md` と、そこから辿った `02_stored/` の本文
- インデックス・ノートに無い内容は一般知識で補ってよいが、「Vault 内の記録には見当たらない」と区別する
- 該当ノートがゼロのときは、その旨を伝え、index の登録状況（件数・タグ一覧）を簡潔に示す
- ユーザーへの追加質問は、回答が不可能なときだけ行う

## 補助スクリプト（任意）

インデックス一覧の確認:

```bash
node .cursor/skills/2-question/scripts/list-index.mjs
```

## 関連

- ノート整理: `1-seiri` スキル（`/1_seiri`）
- インデックス更新は `1_seiri` 実行後に増える
