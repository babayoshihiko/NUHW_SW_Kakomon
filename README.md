# 過去問クイズシステム (Quarto + GAS + Google Spreadsheets)

Quarto で生成した Web サイト（GitHub Pages）上で、Google スプレッドシートに登録された過去問データを動的に読み込んで出題するクイズシステムです。

---

# 過去問クイズシステム 運用マニュアル

Quarto (GitHub Pages) 上で、Google スプレッドシートの過去問データを動的に読み込んで表示するシステムです。

---

## 🏗️ 開発者向けガイド

(Developer Guide)

システム全体の構造、コードの保守、GASおよび全体マスタでのID紐づけ手順です。

### 1. 全体構造・データフロー

* **【受験者 / Webブラウザ】**
  * Quarto Webサイト (`.qmd`) から `schoolName`, `kakomonName`, `passcode` を送信
* **【GAS (ウェブアプリ)】** （実行権限: システム開発者 Baba）
  1. 『全体マスタ』を開き、指定された `Kakomon_name` から「学校マスタ」の `FILE_ID` を取得
  2. マッチした『学校マスタ』を開き、Passcode検証・問題データ・カテゴリ設定を取得してブラウザへ返却

### 2. 重要IDおよび設定の保管場所
* **全体マスタ ID (`MASTER_ADMIN_ID`)**
  * `Code.gs`（GAS側）の冒頭に定数として設定します。
  * ID: `1tm6YBQ52wCqMjM4HSrpo1pp1gwNd9YpF-liLb-Cvqec`
* **GAS ウェブアプリ エンドポイント URL**
  * `load_gsheet.js` の `gasUrl` 変数に設定します。
  * URL: `https://script.google.com/macros/s/AKfycbyfb8SbR4xyO9ygmKFrMHiqwexntoxXWf_hUfJwUIq-ywwqjr2dQtL8Qv6vVT8nuNg/exec`

### 3. 【開発者作業】新しい過去問の登録・公開手順

1. **学校マスタ（雛形）の準備:** 開発者側で「学校マスタ」スプレッドシートの雛形を作成します。
2. **全体マスタへの登録:**  
   『全体マスタ』を開き、`admnin` シートに新しい行を追加して、作成した学校マスタの `FILE_ID` や科目名を登録・紐づけます。
3. **権限の譲渡:** 作成した「学校マスタ」の編集権限を学校の先生へ付与（共有）します。
4. **.qmd ページの作成:**  
   リポジトリ内に `.qmd` ファイル（例: `test_kokoro.qmd`）を作成し、`Kakomon_name` をセットしてビルド・Pushします。

---

## 🏫 学校の先生・管理者向けガイド

(Admin Guide)

問題データの作成、合言葉（Passcode）の設定、出題カテゴリの変更手順です。先生は共有されたご自身の**「学校マスタ」スプレッドシートのみ**を管理します。

### 1. 学校マスタ（スプレッドシート）の構成と役割

先生が管理する「学校マスタ」ブック内には、以下のシート（タブ）を用意します。

#### ① `admnin` シート

（全体設定用）

1行目にヘッダー、2行目に各設定を入力します。

| School_name | Kakomon_name | Passcode | FILE_ID | SHEET_MONDAI | SHEET_CATEGORY |
| :--- | :--- | :--- | :--- | :--- | :--- |
| *(空欄可)* | **第38回こころとからだのしくみ** | **nuhw2026** | *(開発者が設定)* | **Kakomon** | **Cat_kokoro** |

* **`KAKOMON_NAME`**: 科目の識別名です。
* **`PASSCODE`**: **テストの合言葉**です。先生の好きなタイミングで自由に書き換えて変更できます（不要なら空欄）。
* **`SHEET_MONDAI`**: エクセルでいうシート。「問題データが入っているシート名」です。
* **`SHEET_CATEGORY`**: エクセルでいうシート。「カテゴリ設定が入っているシート名」です。

#### ② `SHEET_MONDAI` で指定したシート

（例: `Kakomon`）

問題文、選択肢、正解、解説などを入力する問題データ本体のシートです。

以下の列を作ってください。

- CATEGORY	
- QUESTION
- CORRECT: CORRECT1 でも可能。CORRECT と CORRECT1 は、混在させないでください。
- CORRECT1 - CORRECT3:（オプション）追加。社会福祉士国家試験など複数選択用。
- WRONG1	
- WRONG2	
- WRONG3 - WRONG7:（オプション）追加
- EXPLANATION

なお、`漢字｛かんじ｝`と表記すると、ルビになります。

#### ③ `SHEET_CATEGORY` で指定したシート

（例: `CAT_PART_A`）

ページに表示・出題するカテゴリとその出題数をコントロールするシートです。

| CATEGORY | NUM |
| :--- | :--- |
| こころとからだ | 5 |
| 医療的ケア | 3 |

---

## ❓ トラブルシューティング（先生向け）

* **「合言葉（PASSCODE）を変更・削除したい」**
  * 学校マスタ内の `ADMIN` シートにある `PASSCODE` 列の文字を直接書き換えるだけで、即座にWeb側にも反映されます。
* **「出題するカテゴリや問題数を調整したい」**
  * 学校マスタ内のカテゴリ設定シート（例: `CAT_IRYO`）に記載されている数値（`NUM`）を変更するだけで調整できます。
* **「問題が読み込まれない」**
  * 開発者（Baba）へ「学校マスタ」のアクセス権限や全体の紐づけ作業が完了しているか確認してください。


