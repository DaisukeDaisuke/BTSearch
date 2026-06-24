"use strict";

const MULTIPLIER = 0x5d588b656c078965n;
const INCREMENT = 0x269ec3n;
const MASK64 = (1n << 64n) - 1n;
const TWO32 = 1n << 32n;
const MAX_ROWS = 5000n;
const listById = id => document.getElementById(id);

function nextState(seed) {
  return (seed * MULTIPLIER + INCREMENT) & MASK64;
}

function advanceState(seed, count) {
  let multiplier = MULTIPLIER;
  let increment = INCREMENT;
  let accumulatedMultiplier = 1n;
  let accumulatedIncrement = 0n;

  while (count > 0n) {
    if ((count & 1n) !== 0n) {
      accumulatedMultiplier = (accumulatedMultiplier * multiplier) & MASK64;
      accumulatedIncrement = (accumulatedIncrement * multiplier + increment) & MASK64;
    }
    increment = (increment * (multiplier + 1n)) & MASK64;
    multiplier = (multiplier * multiplier) & MASK64;
    count >>= 1n;
  }
  return (accumulatedMultiplier * seed + accumulatedIncrement) & MASK64;
}

function parseSeed(text) {
  const normalized = text.trim();
  if (!/^(?:0x)?[0-9a-f]+$/i.test(normalized)) throw new Error("初期seedは16進数で入力してください。");
  const value = BigInt(/^0x/i.test(normalized) ? normalized : `0x${normalized}`);
  if (value > MASK64) throw new Error("初期seedは64-bit以内にしてください。");
  return value;
}

function parseDecimal(id, label) {
  const text = listById(id).value.trim();
  if (!/^\d+$/.test(text)) throw new Error(`${label}は0以上の整数で入力してください。`);
  return BigInt(text);
}

function selectCell(event) {
  const selection = getSelection();
  const range = document.createRange();
  range.selectNodeContents(event.currentTarget);
  selection.removeAllRanges();
  selection.addRange(range);
}

function updateListUrl(seed, start, end, max, formula) {
  const params = new URLSearchParams({
    seed: seed.toString(16), start: start.toString(), end: end.toString(),
    max: max.toString(), formula
  });
  history.replaceState({}, "", `${location.pathname}?${params}`);
}

function renderList() {
  const startedAt = performance.now();
  try {
    const seed = parseSeed(listById("listSeed").value);
    const start = parseDecimal("listStart", "開始F");
    const end = parseDecimal("listEnd", "終了F");
    const max = parseDecimal("listMax", "倍率 max");
    const formula = listById("listFormula").value;
    if (end < start) throw new Error("終了Fは開始F以上にしてください。");
    if (end - start + 1n > MAX_ROWS) throw new Error(`一度に表示できるのは${MAX_ROWS}行までです。`);

    let state = advanceState(seed, start + 1n);
    const denominator = formula === "exact" ? TWO32 - 1n : TWO32;
    const fragment = document.createDocumentFragment();
    for (let frame = start; frame <= end; ++frame) {
      const top = state >> 32n;
      const scaled = top * max / denominator;
      const compatiblePercent = top * 100n / TWO32;
      const row = document.createElement("tr");
      const values = [
        frame.toString(),
        `0x${state.toString(16).padStart(16, "0")}`,
        `0x${top.toString(16).padStart(8, "0")}`,
        scaled.toString(),
        (compatiblePercent & 1n) === 0n ? "よ (0)" : "こ (1)"
      ];
      for (const value of values) {
        const cell = document.createElement("td");
        cell.className = "selectable";
        cell.textContent = value;
        cell.addEventListener("click", selectCell);
        row.append(cell);
      }
      fragment.append(row);
      state = nextState(state);
    }
    listById("randomTable").tBodies[0].replaceChildren(fragment);
    listById("listStatus").textContent = `${(end - start + 1n).toString()}行を${((performance.now() - startedAt) / 1000).toFixed(3)}秒で表示しました。`;
    updateListUrl(seed, start, end, max, formula);
  } catch (error) {
    listById("listStatus").textContent = error.message;
  }
}

function loadListUrl() {
  const params = new URLSearchParams(location.search);
  if (params.has("seed")) listById("listSeed").value = `0x${params.get("seed").replace(/^0x/i, "")}`;
  if (params.has("start")) listById("listStart").value = params.get("start");
  if (params.has("end")) listById("listEnd").value = params.get("end");
  if (params.has("max")) listById("listMax").value = params.get("max");
  if (["compat", "exact"].includes(params.get("formula"))) listById("listFormula").value = params.get("formula");
}

loadListUrl();
listById("showList").addEventListener("click", renderList);
renderList();
