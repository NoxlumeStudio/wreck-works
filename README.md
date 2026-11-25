# インチキ解体業者 / Wreck Works

PCブラウザで遊べる2D物理解体パズル。道具を現場に置き、予算と保護条件を守りながら全6章・15件の解体依頼に挑みます。

## GitHub Pages に公開する

1. このフォルダーの中身を GitHub リポジトリのルートに置きます。`.github/workflows/pages.yml` も含めます。
2. リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選択します。
3. `main` にプッシュすると、ビルドの後にゲームを公開します。初回に自動実行されなかった場合は、**Actions → Publish game to GitHub Pages → Run workflow** を実行します。

公開URLは **Settings → Pages** に表示されます。ローカルでは Node.js 24 で `npm ci` と `npm run dev` を実行し、表示されたURLで遊べます。別の静的ホストに配置する場合は、`npm run build` で生成した `dist/` の中身を使用します。

プレイ記録はブラウザに保存されるため、公開先のURLが変わると、そのURLでは新しい進行記録になります。

## ローカルで起動・ビルド

Node.js 24 と npm を使用します。

```sh
npm ci
npm run dev
npm run build
```

ビルド成果物は `dist/` に出力されます。静的ホストにはこのディレクトリを配置します。GitHub Pages ではビルド後の `dist/` を Pages のデプロイ用アーティファクトに指定できます。相対ベースパスでビルドするため、リポジトリ配下のURLでも動作します。
