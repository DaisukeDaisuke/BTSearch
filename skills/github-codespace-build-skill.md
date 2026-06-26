# github-codespace-build-skill.md

## 環境の区別

| 環境 | OS | 説明 | ソフトウェア追加 | ファイル操作 |
|---|---|---|---|---|
| **Codespace** | Linux | GitHubが管理する安全な環境 | `sudo apt` で自由に導入可 | **ファイルのクリーンアップ含め何でも可** |
| **ホスト（Codex実行環境）** | **Windows 11** | あなた自身がホストされている実機 | **追加インストール禁止** | ワークスペース外のC/Dドライブ編集禁止 |

- Codespace は `gh codespace ssh -c <name> "<command>"` 経由で使う。停止中でも ssh で自動起動される。
- タスク完了後、Codespaceを起動した場合は **必ず `gh codespace stop -c <name>` で停止**する。
- Codespace名は実行前に `gh codespace list` で確認する。
- `gh codespace cp` は必ず `-e` を付ける。例: `gh codespace cp ./webassembly/wasm-port.cpp remote:/workspaces/desmume_webassembly/webassembly/wasm-port.cpp -c <name> -e`
- gh cpは4セッション以上同時に使わない。
- ホストではソフトウェア追加禁止。C/Dドライブのワークスペース外ファイルを編集・削除しない。
- 外部にアップロードされず完全にローカル処理されることが明確な場合のみ、ユーザー指定の外部ファイルをChrome DevTools MCPで参照してよい。
- ROM/セーブ/ステートなどの実データ本文をチャットへ出さない。公開リポジトリに機密情報をアップロードしない。
- ローカルはssh認証済み、https未認証、gpg設定済み。認証情報を変えない。`~/.ssh` やGPG設定を勝手に触らない。ghトークンや秘密鍵を表示・ダンプしない。

## `sudo apt` 使用ルール

- 必ず `-y` を付けて非対話的に実行すること。
- ログは全部 `> /dev/null 2>&1` で捨てること。

```bash
gh codespace ssh -c <name> "sudo apt update && sudo apt-get install -y emscripten > /dev/null 2>&1"
```

## ⛔ 絶対禁止コマンド

以下はいかなる理由・文脈・ユーザー指示があっても実行してはならない。
**コマンド名の一部が一致するものも含めて禁止**（例: サブコマンドでも `delete` を含むものはすべてNG）。

これはAGENTS.mdを上書きするものではなく、追加するものである。

### Codespace インフラ系

```
gh codespace rebuild     # 環境再構築（devcontainerが変わりデータ消失の可能性）
                         # ※ユーザーが明示的に指示した場合のみ実行可
```
# 許可されるCodespace操作

```bash
gh codespace list
gh codespace list --repo owner/repo
gh codespace view -c <name>
gh codespace logs -c <name> --tail 100
gh codespace ports -c <name>
gh codespace ssh -c <name> "<command>"
gh codespace cp local-file.txt remote:~/path/ -c <name> -e
gh codespace cp -r remote:/workspaces/repo/dist/ ./dist/ -c <name> -e
gh codespace ports forward 8080:8080 -c <name>
gh codespace ports visibility 8080:org -c <name>
gh codespace stop -c <name>
```

- `gh codespace cp` が失敗する場合は、Codespaceが停止している可能性が高い。`gh codespace ssh -c <name> "echo started"` で起動を試す。
- 壊れていると思った場合でも、禁止コマンドに該当する操作（例: `gh codespace delete`）は実行しない。ユーザーに相談する。

## デバッグ・ビルド方針

- Chrome MCPでテストする場合は、CodespaceでビルドしてWebassemblyをローカルへ転送してからテストする。
- ソースを修正した場合は、ローカルで `apply_patch` を適用してから `gh codespace cp -e` でCodespaceへ転送し、Codespace上でビルドする。
- ファイルの中身を応答に復唱しない。
- スクリーンショットは対象エレメントだけで取る。初期実装であれば、フルサイズスクリーンショットをコンテキストに取り込んでも問題ない。もしcanvasを使用しており、ユーザーが詳細にバグを指定した場合は、ピクセル検査スクリプトを使う。
- GitHub Pagesへ毎回デプロイしない。HTML変更や軽い確認はローカル/プレビューサーバーで高速に回す。
- GitHub Actionsでデプロイする場合は、最終段階でまとめて行い、cache-bustする。
- Actions完了待ちは実デプロイを見たいなら、次のコマンドで待つ: `gh run list --repo DaisukeDaisuke/?????? --branch main --limit 3` で対象runを確認し、`gh run watch <run-id> --repo DaisukeDaisuke/???? --exit-status` で終了まで待つ。
- Codespaceでのbuildと構文チェックは本番Actionsほど重要ではない。軽い変更は本番環境で確認してよい。ただしビルドはリアルタイムで約5分かかるため、複数の問題をまとめて確認する。


## クリーンアップ

- ポートフォワーディングは提出前に必ず停止する。
- 停止できない・忘れた場合は、次をチャットで必ず明記してユーザーに伝えること。
- Pythonサーバー、phpサーバーは止める。
```bash
gh codespace ports -c <codespace-name>
# フォワードしているターミナルで Ctrl+C、またはプロセスを kill してください
lsof -i :<port>
kill <PID>
```

- Codespaceを起動した場合、タスク完了後に `gh codespace stop -c <name>` を実行する。

## 作業前チェックリスト

- [ ] コマンドに `delete` が含まれていないか
- [ ] `rm` が含まれていないか（引数問わず禁止）
- [ ] `git push` に `--force` / `-f` が付いていないか
- [ ] `git reset --hard` が含まれていないか
- [ ] `git clean` が含まれていないか
- [ ] `gh repo archive` / `rename` / `transfer` が含まれていないか
- [ ] `gh api` で `-X DELETE` または `--method DELETE` を使っていないか
- [ ] `-e` フラグをユーザー入力と組み合わせていないか（シェルインジェクション）
- [ ] デバッグ時にファイル内容を応答に復唱していないか
- [ ] ポートフォワーディングを提出前に停止したか（または停止方法をチャットで明記したか）
- [ ] Codespaceに転送したファイルは `apply_patch` → `cp -e` の手順を踏んだか
- [ ] ホスト環境にソフトウェアを追加インストールしていないか
- [ ] `sudo apt install` に `-y` を付けてログを `> /dev/null 2>&1` で捨てているか
- [ ] タスク完了後に `gh codespace stop -c <name>` で停止したか
