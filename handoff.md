# 実装記録

## 2026-06-24 WebAssembly総当たり

- `webassembly/search.cpp` に旧JavaScript探索を移植した。観測値は `LCG^(F+1)` の上位32-bitへ100を掛け、32-bit右シフトした整数の偶奇。
- 最大50観測を64-bitのスライディング窓で照合する。文字列生成・`endsWith` は使わない。
- 開始Fまたは最終Fの制限時は、affine LCGの二乗法で対象観測区間まで前方ジャンプする。
- `public/app.js` はWASMを1回fetch/compileし、Blob URLのDedicated WorkerへModuleをstructured cloneする。Worker数の既定値は `floor(hardwareConcurrency / 2)`、範囲は1～64。
- 旧UIのseed範囲ショートカット、初期seedショートカット、開始/最終F制限、表示上限、よこ入力、50ドロップダウン、URL共有、自動開始を維持した。
- `webassembly/build.sh` はclang/lldでランタイム無しのWASMを生成する。GitHub Pagesは `.github/workflows/pages.yml` から `public/` を公開する。
