# インチキ解体業者 / WRECK WORKS

元サイトの公開版 v36（`028aea8`）を基準にした、GitHub Pages 移行用の一式です。

## GitHub Pages へ公開

1. ZIP内の `wreck-works` フォルダーの中身を、既存のGitHubリポジトリ `noxlumestudio/wreck-works` のルートへ置きます。`index.html`、`package.json`、`.github/workflows/pages.yml` がその位置にあることを確認します。以前の配布用ワークフローが別名で残っている場合は、重複して公開しないよう整理します。
2. リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選びます。
3. `main` にプッシュします。必要に応じて **Actions → Publish WRECK WORKS → Run workflow** から実行できます。
4. 成功後に <https://noxlumestudio.github.io/wreck-works/> を開きます。

Node.js 24 で `npm ci` と `npm run build` を実行すると、公開用ファイルが `dist/` に生成されます。ローカル確認は `npm run preview` を実行し、表示されたURLの `/wreck-works/` を開きます。

セーブはブラウザのサイト単位で保管されます。元サイトのセーブは、ブラウザ上の別ドメインである GitHub Pages へ自動で移りません。
