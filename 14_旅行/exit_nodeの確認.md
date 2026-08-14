# Exit Node の確認（ノートPCだけでOK）

ホテルなど外出先で、Tailscale Exit Node が本当に自宅経由になっているかを確認する手順。

一番確実なのは `curl`（方法1）。

---

## 方法1：外部IPを確認する（おすすめ）

ノートPC（mouse04）で PowerShell を開き、次を実行する。

```powershell
curl.exe https://api.ipify.org
```

例:

```text
125.52.253.65
```

次に、Exit Node を OFF にして同じコマンドを実行する。

```powershell
tailscale set --exit-node=
curl.exe https://api.ipify.org
```

結果の見方（例）:

```text
Exit Node ON  → 125.52.253.65  ← 自宅
Exit Node OFF → 203.xxx.xxx.xxx ← ホテル
```

**ON と OFF で IP が変わり、ON のとき自宅 PC と同じ IP になる**なら、Exit Node 経由で問題ない。

---

## 方法2：Tailscale の状態を見る

ノートPCで次を実行する。

```powershell
tailscale exit-node list
```

今回の状態なら、例えば次のように出る。

```text
IP            HOSTNAME                    STATUS
100.68.114.93 ozeki-dl.tail...            selected
```

`selected` と表示されていれば、**ノートPCが `ozeki-dl` を Exit Node として選択している**ことの確認になる。

ただしこれは「選択されている」ことの確認なので、**実際にインターネット通信が自宅経由になっていることまで確認するなら方法1が確実**。

---

## ホテルではこれだけ覚えておけばOK

1. 状態確認

```powershell
tailscale exit-node list
```

↓ `ozeki-dl ... selected` を確認

2. 外部IP確認

```powershell
curl.exe https://api.ipify.org
```

↓ **自宅で確認した IP と同じ**なら OK

このとき通信経路は次のとおり。

> **ホテルWi-Fi → Tailscale → 自宅PC → 自宅回線 → インターネット**

---

## メモ

ホテルで Exit Node が切れてしまった場合に備えて、「Exit Node が本当に自宅経由になっているかをワンクリックで確認する方法」も作れる。
