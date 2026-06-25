# 実装記録

## 2026-06-24 WebAssembly総当たり

- `webassembly/search.cpp` に旧JavaScript探索を移植した。観測値は `LCG^(F+1)` の上位32-bitへ100を掛け、32-bit右シフトした整数の偶奇。
- 最大50観測を64-bitのスライディング窓で照合する。文字列生成・`endsWith` は使わない。
- 開始Fまたは最終Fの制限時は、affine LCGの二乗法で対象観測区間まで前方ジャンプする。
- `public/app.js` はWASMを1回fetch/compileし、Blob URLのDedicated WorkerへModuleをstructured cloneする。Worker数の既定値は `floor(hardwareConcurrency / 2)`、範囲は1～64。
- 旧UIのseed範囲ショートカット、初期seedショートカット、開始/最終F制限、表示上限、よこ入力、50ドロップダウン、URL共有、自動開始を維持した。
- `webassembly/build.sh` はclang/lldでランタイム無しのWASMを生成する。GitHub Pagesは `.github/workflows/pages.yml` から `public/` を公開する。

## 2026-06-24 0F探索・乱数表

- 総当たりを0F開始へ修正した。調査回数1000なら0～999Fの1000回を評価する。
- 開始F/最終Fの有効フラグをWASMへ別渡しし、値0と未指定を区別する。
- 回帰値はseed `0x32769` の0F列 `00010110001101011110111010`、1F列 `0010110001101011110111010`。
- `public/list.html` / `public/list.js` に乱数表を実装した。BigIntのaffine exponentiationで任意桁FへO(log F)ジャンプする。
- 乱数表の倍率maxはBigIntで任意精度。互換式（分母2^32）と2^32−1式を選択でき、どちらも整数除算で桁落ちしない。
- 結果行から乱数表を新規タブで開ける。各セルはクリック選択可能。

## 2026-06-24 乱数表の小数・行選択

- 倍率maxは小数点を除いたBigIntと小数桁数に分け、計算後に文字列操作で小数点を戻す。`10.00` と `1.0` の末尾精度を維持する。
- 2^32−1式を既定にし、互換式は選択肢として残した。
- 表は通常クリックで単一行、Ctrl/Cmd+クリックで複数行を選択表示する。
- 上位32-bitの正規化刻み幅は約2.328306437e-10。Pythonで両分母を確認し、倍率maxの小数入力を10桁までに制限した。
- `yoko`入力はIME変換中に更新せず、確定後に「よ」「こ」だけを観測値として解釈する。異常文字は入力欄から削除せず探索上だけ無視する。

## 2026-06-25 乱数表の0F表示

- `public/list.js` の表は各Fのseed値を表示し、値・よ／こ判定はそのseedを1回進めた32-bit戻り値から計算する。例: seed `0x32769` の0F行はseed列 `0x32769`。
