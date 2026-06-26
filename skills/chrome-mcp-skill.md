# chrome-mcp-skill.md

## デバッグ・ビルド方針

- Chrome MCPでテストする場合は、CodespaceでビルドしてWebassemblyをローカルへ転送してからテストする。
- ソースを修正した場合は、ローカルで `apply_patch` を適用してから `gh codespace cp -e` でCodespaceへ転送し、Codespace上でビルドする。
- ファイルの中身を応答に復唱しない。
- スクリーンショットは対象エレメントだけで取る。初期実装であれば、フルサイズスクリーンショットをコンテキストに取り込んでも問題ない。もしcanvasを使用しており、ユーザーが詳細にバグを指定した場合は、ピクセル検査スクリプトを使う。
- GitHub Pagesへ毎回デプロイしない。HTML変更や軽い確認はローカル/プレビューサーバーで高速に回す。
- GitHub Actionsでデプロイする場合は、最終段階でまとめて行い、cache-bustする。
- Actions完了待ちは実デプロイを見たいなら、次のコマンドで待つ: `gh run list --repo DaisukeDaisuke/?????? --branch main --limit 3` で対象runを確認し、`gh run watch <run-id> --repo DaisukeDaisuke/???? --exit-status` で終了まで待つ。
- Codespaceでのbuildと構文チェックは本番Actionsほど重要ではない。軽い変更は本番環境で確認してよい。ただしビルドはリアルタイムで約5分かかるため、複数の問題をまとめて確認する。

### Chrome MCPでのファイルアップロード

- AI側からのファイルアップロードは、Chrome MCPのアップロード対象要素IDとアップロードツールを組み合わせる。
- file inputのIDは毎回変わる可能性がある。固定IDを仮定しない。
- アップロード用ツールはデフォルトで見えていないことがある。必要なら `tool_search` で `take_snapshot` と `upload_file` を探して使う。
- 手順:
  1. Chrome MCPで対象ページ `http://localhost:8766/`）を開く。
  2. `take_snapshot` でDOM/アクセシビリティツリーを取り、file input またはアップロードボタンの現在IDを確認する。
  3. `upload_file` で、そのIDへユーザー指定ローカルファイルを渡す。
  4. 対象ファイル本文はチャットに出さず、ブラウザへローカルアップロードするだけにする。
- ファイルはユーザー指定パスを使う。内容をコンテキストへ貼らない。

# 動作確認
- あなたは、chrome mcpで動作確認をするべきです。この場合ユーザーが再現方法を述べているため、これを使用し、コードが期待通りに修正されているか確かめる必要があります。
- ユーザーに丸なげする場合でも、提出前にwebassemblyをローカルにコピーするべきです。
