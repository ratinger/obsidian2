# Claude CoworkとClaude Code比較

出典: [ChatGPT共有](https://chatgpt.com/s/t_6a9272edfccc8191a0bc41a50d83e1d0)（2026-08-29）

共有されていたのは会話の1ターン（ChatGPT側の訂正回答）です。

---

はい。**ここは前の回答を訂正する必要があります。**  
2026年8月現在、Claude Coworkはかなり進化していて、**「PC上でしか動かない」という説明はもう正しくありません。**

Anthropic公式情報を確認すると、現在は**Coworkに「クラウド実行」と「ローカルPC実行」の両方があります**。

## 結論

| 項目 | Claude Cowork |
|---|---|
| **クラウドだけで実行** | ✅ **できる** |
| PCを電源OFFにしても続く | ✅ **できる（クラウドセッション）** |
| スマホから指示 | ✅ できる |
| Webブラウザから指示 | ✅ できる |
| PCのローカルファイルを操作 | ✅ できる |
| PCのアプリを操作 | ✅ できるが**PC側のClaude Desktopが必要** |
| PCを操作する仕事 | ✅ 可能。ただしPCが起動している必要あり |
| 完全にクラウドだけでローカルPCを操作 | ❌ できない |

### ① 本当に「クラウドだけ」で動かす

これは現在できます。

たとえば、

> 「この資料を分析して、100ページのレポートを作って」

という仕事なら、**Anthropicのサーバー上でCoworkが動き続けます**。

PCを閉じても大丈夫です。

Anthropicは明確に、

> Cowork in the cloudでは、Claudeの作業はAnthropicのサーバー上で実行される

と説明しています。さらに、PCを閉じても作業を継続し、スケジュールタスクも端末がオンラインでなくても実行できます。

---

## ② では「PC上のファイル」はどうなる？

ここが面白いところです。

例えばあなたのPCに、

```text
C:\Users\あなた\Documents\母の介護資料
```

というフォルダがあるとします。

Coworkに

> 「このフォルダにあるPDFを全部整理して」

と頼む。

これは**クラウド上のCoworkからでも可能**です。

ただし、

**Claude DesktopがそのPC上で起動している必要があります。**

Anthropicの説明では、クラウドセッションからローカルファイルにアクセスする場合、

> Claude Desktop app must be open

となっています。つまり、

**Claude本体 → クラウド**

**Claude Desktop → あなたのPC**

という橋渡しをするわけです。

---

## ③ 「PCを遠隔操作する」は別

さらに一段違います。

例えば、

> 「Excelを開いて、この表を修正して保存して」

> 「Chromeを開いて、このWebサイトからデータを取得して」

> 「Windowsのアプリを操作して」

という仕事。

これは**Computer Use**という機能です。

この場合は、

**PCが起動していて、Claude Desktopも起動している必要があります。**

Anthropic公式にも、

> デスクトップがアクティブである必要がある  
> コンピューターがスリープせず、Claude Desktopが開いている必要がある

と明記されています。

---

## ④ つまり3種類ある

これで整理すると非常に分かりやすいです。

| | **Coworkクラウド** | **Cowork＋ローカルファイル** | **Cowork＋PC操作** |
|---|---|---|---|
| Claudeの実行場所 | ☁️ Anthropic | ☁️ Anthropic | ☁️ Anthropic |
| PC | 不要 | 必要 | 必要 |
| PCの電源 | OFFでもOK | **ON必要** | **ON必要** |
| Claude Desktop | 不要 | **必要** | **必要** |
| ローカルファイル | ❌ | ✅ | ✅ |
| Excel等のPCアプリ | ❌ | △ | **✅** |
| ブラウザ操作 | △ | △ | **✅** |
| 長時間作業 | **✅** | **✅** | △ |
| スケジュール実行 | **✅** | 条件あり | PCが必要 |

---

## ⑤ さらに重要なのが「スマホからPCを使わせる」

これ、あなたには結構面白い機能だと思います。

Anthropicには**Dispatch**という機能があります。

例えば外出中にスマホから、

> 「家のPCにある資料を整理しておいて」

とClaudeに指示する。

すると、

**スマホ → Claude → 自宅PC**

という形で仕事をさせられます。

ただし、この場合は**自宅PCが起動していて、Claude Desktopが動いている必要があります。**

---

## ⑥ 「リモートPC」でも使える？

**原理的には使えます。**

例えば、

```text
自宅PC
Windows
Claude Desktop
      ↑
      │
   インターネット
      │
      ↓
Claude
      ↑
      │
スマホ・別PC
```

という構成にできます。

つまり、**自宅に置いたPCをClaudeの作業マシンとして使う**ことができます。

ただし重要なのは、これは

**「Claudeがクラウド上の仮想Windowsを自由に操作する」**

という意味ではありません。

あくまで、

**Claudeのクラウドセッションが、Claude Desktopを経由してあなたのPCにアクセスする**

という仕組みです。

---

## そして、Claude Codeとの違いがさらに面白くなります

現在のCoworkは、単なる「ファイル整理AI」ではありません。

Anthropic自身がCoworkについて、

> Claude Code's agentic capabilitiesを、coding以外のknowledge work向けに提供する

という位置づけにしています。

なので、今のイメージは、

**Claude Code**  
→ AIエンジニア

**Claude Cowork**  
→ AI社員

くらいまで近づいています。

しかも現在のCoworkには、**Web・Desktop・Mobileから同じセッションを引き継ぐ機能、スケジュール実行、Skills、Plugins、Connectors、並列作業**などもあります。

---

### あなたの場合、かなり重要なのはここ

もし以前話していたように、

**自宅PCを常時稼働させて、Claude Code / Cursor / LM Studioなどを使う**

という環境を考えているなら、

> **「Coworkを自宅PCに常駐させて、外出先からスマホで仕事を投げる」**

という使い方ができます。

一方で、**PCを完全にOFFにしておきたい仕事なら、Coworkのクラウドセッションを使う**。

この2つを使い分けるのが、2026年8月現在のCoworkのかなり大きなポイントです。

---

## 続きの質問案（共有ページ側）

- 詳しく解説：Coworkの3種類の動作モードの違いと使い分け方を説明して
- 具体例を教えて：スマホから自宅PCを使うDispatch機能の実際の活用シナリオ
- CoworkとClaude Codeの違いについてさらに詳しく説明してください

---

## 参照（ChatGPTが引用していた公式）

- [Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork)
- [Use Claude Cowork on web, desktop, and mobile](https://support.claude.com/en/articles/15520349-use-claude-cowork-on-web-desktop-and-mobile)
- [Assign tasks from anywhere in Claude Cowork](https://support.claude.com/en/articles/13947068-assign-tasks-from-anywhere-in-claude-cowork)
- [Let Claude use your computer in Cowork](https://support.claude.com/en/articles/14128542-let-claude-use-your-computer-in-cowork)
- [Install Claude Desktop](https://support.claude.com/en/articles/10065433-install-claude-desktop)
- [Claude Cowork 製品ページ](https://claude.com/product/cowork)
