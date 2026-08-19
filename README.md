# ジョブログ分析ツール｜月単位比較（Webアプリ）

ジョブログCSVを読み込み、事業部単位で「作／創」バランスの**前月比較**を自動生成するブラウザ完結型アプリ（PWA）です。

- **データは外部送信しません**。CSVの解析・集計・描画はすべてブラウザ内で完結します。
- **外部CDN依存ゼロ**。CSVパーサとグラフ描画を自前実装しているため、社内の回線制限下でも動作します。
- **インストール可能（PWA）**。Service Worker でオフライン起動に対応。
- **Shift_JIS / UTF-8 自動判定**。Excelからの書き出しCSVをそのまま読めます。

## 使い方

1. アプリを開く
2. ジョブログCSVをドラッグ＆ドロップ（必須列：`日付` / `登録者名` / `業務区分` / `時間`）
3. 必要なら「作／創」の分類を切り替え（端末に保存されます）
4. 対象月を選ぶと、前月との比較グラフ・集計表・差分が生成されます
5. 必要に応じて「集計結果をCSVで書き出し」

動作をすぐ確かめたい場合は「サンプルデータで試す」または `?demo=1` 付きURLを使ってください。

## GitHub で公開する手順

### 1. リポジトリを作ってpush

```bash
cd joblog-analyzer
git init
git add .
git commit -m "feat: ジョブログ分析ツールWebアプリ初版"
git branch -M main
git remote add origin https://github.com/<ユーザー名>/joblog-analyzer.git
git push -u origin main
```

GitHub CLI があれば1行でも作成できます。

```bash
gh repo create joblog-analyzer --private --source=. --push
```

### 2. GitHub Pages を有効化

- リポジトリの **Settings → Pages** を開く
- **Source** を `GitHub Actions` に設定（同梱の `.github/workflows/deploy-pages.yml` が自動デプロイします）
- 数十秒後に `https://<ユーザー名>.github.io/joblog-analyzer/` で公開

※ Actions を使わず、**Source を `Deploy from a branch` → `main` / `/ (root)`** にしても公開できます（`.nojekyll` を同梱済み）。

### 3. 社内データを扱う上での注意

- アプリ自体はCSVを送信しませんが、**リポジトリは Private 推奨**です。
- 実データのCSVはリポジトリにコミットしないでください（`.gitignore` で `*.csv` を除外し、サンプルのみ例外許可済み）。
- Private リポジトリの Pages 公開には GitHub Team / Enterprise プランが必要です。Free プランでは Public 公開か、ローカル利用（下記）をご検討ください。

## ローカルで動かす

Service Worker は `file://` では動かないため、簡易サーバー経由での起動を推奨します。

```bash
python3 -m http.server 8000
# → http://localhost:8000/ をブラウザで開く
```

単に分析するだけなら `index.html` をブラウザで直接開いても動作します（オフラインキャッシュとサンプル読込は無効）。

## 構成

```
.
├─ index.html                 画面マークアップ
├─ manifest.webmanifest       PWAマニフェスト
├─ sw.js                      Service Worker（オフラインキャッシュ）
├─ assets/
│  ├─ css/styles.css          スタイル
│  ├─ js/csv.js               CSVパーサ（UTF-8/Shift_JIS自動判定）
│  ├─ js/charts.js            Canvas描画（積上げ棒・折れ線）
│  ├─ js/app.js               集計・分類・UIロジック
│  └─ icons/                  アプリアイコン
├─ sample/sample_joblog.csv   動作確認用サンプル（2ヶ月分）
└─ .github/workflows/deploy-pages.yml  Pages自動デプロイ
```

## 分類の初期値

| 分類 | 業務区分 |
| --- | --- |
| 作 | 会議・MTG（情報共有・報告）、会議・MTG（その他）、申請・手続き・事務対応、クライアント対応、業務進行、情報探索・問い合わせ、その他 |
| 創 | データ集計・分析・考察・思考、資料作成・確認、会議・MTG（問題解決）、会議・MTG（意思決定）、会議・MTG（1オン1・相談） |

上記以外の区分は「未知の区分」として初期値「作」で表示し、画面上で切り替えできます。
