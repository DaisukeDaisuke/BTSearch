# 方針

- `source/` は旧実装と調査資料として扱い、公開物は `public/` に置く。
- 探索式は旧 `rand.js` と同じ、F=0を `LCG^(F+1)` とする乱数に対する `getPercent(..., 100)` の偶奇を使う。
- `search.wasm` はページごとに1回だけ取得・コンパイルし、コンパイル済みModuleをDedicated Workerへ共有する。
- UIはOS・ブラウザのlight/dark設定に従い、探索機能を優先して装飾を増やさない。
- ビルドはLinux上で `webassembly/build.sh` を実行し、成果物を `public/search.wasm` に出力する。
- 乱数表のロングジャンプと任意精度整数化はBigIntのaffine LCG二乗法で行う。
