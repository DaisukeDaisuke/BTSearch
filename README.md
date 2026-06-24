# BTSearch

Dragon Quest IX向けの乱数シード総当たり・乱数表ツールです。探索処理はC++ WebAssemblyとDedicated Workerで実行します。

## 公開ページ

- [乱数総当たりツール](https://daisukedaisuke.github.io/BTSearch/)
- [乱数表の表示例（seed 0x32769、0～100F）](https://daisukedaisuke.github.io/BTSearch/list.html?seed=32769&start=0&end=100&max=100&formula=exact)

## 乱数総当たり

- 「ようす」を`0`、「こうげき」を`1`として観測列を検索
- 0Fから探索し、開始F・最終F・初期seedによる絞り込みに対応
- 実機、DeSmuME、melonDS、No$GBA向けのseed範囲ショートカット
- Worker数、調査回数、表示上限を指定可能
- 「よ」「こ」の横入力、50個の選択欄、URL共有、自動開始に対応
- 結果から該当seedの乱数表を新規タブで表示

使用するLCGは次の64-bit更新式です。

```text
seed = seed * 0x5d588b656c078965 + 0x269ec3 (mod 2^64)
```

F番目の観測には更新後の上位32-bitを使い、総当たりでは`getPercent(..., 100)`の偶奇を比較します。

## 乱数表

- affine LCGの二乗法により任意のFへ`O(log F)`で直接ジャンプ
- 6400億Fなど、先頭から順に生成できない位置にも対応
- `2^32−1`式を既定とし、旧ツール互換の`2^32`式も選択可能
- BigInt整数演算を使用し、小数点以下は上位32-bitの精度に合わせて最大10桁
- 通常クリックで1行、Ctrl/Cmd+クリックで複数行を選択

## ビルド

Linux上でClangとLLDを用意し、次を実行します。

```sh
bash webassembly/build.sh
```

生成物は`public/search.wasm`です。GitHub Actionsはpush時にWASMをビルドし、`public/`をGitHub Pagesへ公開します。
