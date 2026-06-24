#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-${ROOT_DIR}/public}"

mkdir -p "${OUTPUT_DIR}"

clang++ \
  --target=wasm32 \
  -std=c++17 \
  -O3 \
  -flto \
  -fno-exceptions \
  -fno-rtti \
  -nostdlib \
  -Wl,--no-entry \
  -Wl,--export=search_range \
  -Wl,--export=result_buffer \
  -Wl,--export-memory \
  -Wl,--initial-memory=2097152 \
  -Wl,--max-memory=2097152 \
  -Wl,--strip-all \
  -o "${OUTPUT_DIR}/search.wasm" \
  "${ROOT_DIR}/webassembly/search.cpp"
