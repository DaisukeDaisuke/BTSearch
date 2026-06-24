"use strict";

const OBSERVATION_COUNT = 50;
const RESULT_CAPACITY = 100000;
const hardwareThreads = Math.max(1, navigator.hardwareConcurrency || 2);
const defaultWorkerCount = Math.max(1, Math.floor(hardwareThreads / 2));
const workerSource = `
let stopped = false;
self.onmessage = async ({ data }) => {
  if (data.type === "stop") {
    stopped = true;
    return;
  }
  if (data.type !== "search") return;
  stopped = false;
  try {
    const instance = await WebAssembly.instantiate(data.wasmModule, {});
    const api = instance.exports;
    const resultPointer = api.result_buffer();
    const results = [];
    const filtered = data.filterFlags !== 0;
    const batchSize = filtered
      ? 4096
      : Math.max(1, Math.min(256, Math.floor(100000 / data.maxFrame)));
    let completed = 0;

    for (let begin = data.seedStart; begin <= data.seedEnd && !stopped;) {
      const end = Math.min(data.seedEnd, begin + batchSize - 1);
      const remaining = data.resultLimit - results.length;
      if (remaining <= 0) break;
      const count = api.search_range(
        begin, end, data.maxFrame, data.patternLow, data.patternHigh,
        data.patternLength, data.startFilter, data.endFilter, data.filterFlags, remaining
      );
      const view = new Uint32Array(api.memory.buffer, resultPointer, count * 3);
      for (let index = 0; index < count; ++index) {
        const offset = index * 3;
        results.push([view[offset], view[offset + 1], view[offset + 2]]);
      }
      completed += end - begin + 1;
      self.postMessage({ type: "progress", id: data.id, completed });
      if (results.length >= data.resultLimit || end === data.seedEnd) break;
      begin = end + 1;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    self.postMessage({ type: "done", id: data.id, completed, results });
  } catch (error) {
    self.postMessage({ type: "error", id: data.id, message: String(error) });
  }
};`;
const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));

let wasmModulePromise = null;
let activeRun = 0;
let activeWorkers = [];
let autoStartTimer = 0;
let yokoComposing = false;

const byId = id => document.getElementById(id);
const controls = ["seedStart", "seedEnd", "end", "maxCount", "workers", "nowCount", "nowCount1", "seed1"];

function parseHex(value) {
  const text = value.trim();
  if (!/^(?:0x)?[0-9a-f]+$/i.test(text)) return NaN;
  return Number.parseInt(text.replace(/^0x/i, ""), 16);
}

function parseOptionalInteger(id) {
  const value = byId(id).value.trim();
  return value === "" ? 0 : Number.parseInt(value, 10);
}

function observationString() {
  let value = "";
  for (let index = 0; index < OBSERVATION_COUNT; ++index) {
    const selected = byId(`menu${index}`).value;
    if (selected === "") break;
    value += selected;
  }
  return value;
}

function buildPattern(value) {
  let bits = 0n;
  for (const bit of value) bits = (bits << 1n) | BigInt(bit);
  return {
    low: Number(bits & 0xffffffffn),
    high: Number((bits >> 32n) & 0xffffffffn),
    length: value.length
  };
}

function setControlState() {
  document.querySelectorAll("input:not([type=checkbox]), select").forEach(element => {
    element.classList.toggle("has-value", element.value.trim() !== "");
  });
  byId("autostart").closest("label").classList.toggle("active", byId("autostart").checked);

  const active = [
    `探索範囲 ${byId("seedStart").value}～${byId("seedEnd").value}`,
    `調査 ${byId("end").value}F`,
    `Worker ${byId("workers").value}`
  ];
  if (byId("nowCount1").value) active.push(`最終項目F制限 ${byId("nowCount1").value}`);
  else if (byId("nowCount").value) active.push(`開始F制限 ${byId("nowCount").value}`);
  if (byId("seed1").value) active.push(`初期seed制限 ${byId("seed1").value}`);
  const count = observationString().length;
  if (count) active.push(`観測 ${count}個`);
  byId("activeFilters").textContent = `有効: ${active.join(" / ")}`;
  byId("activeFilters").classList.add("active");

  const seedStart = parseHex(byId("seedStart").value);
  const seedEnd = parseHex(byId("seedEnd").value);
  const frames = Number.parseInt(byId("end").value, 10);
  const seedCount = Number.isFinite(seedStart) && Number.isFinite(seedEnd)
    ? Math.max(0, seedEnd - seedStart + 1) : 0;
  const filteredFrame = byId("nowCount").value || byId("nowCount1").value;
  const work = seedCount * (filteredFrame ? Math.max(1, count) : Math.max(0, frames));
  const expected = seedCount > 0 && frames > 0
    ? Math.ceil(Math.log2(seedCount * (filteredFrame ? 1 : frames))) : 0;
  byId("prediction").textContent = `1候補の予想入力数: ${expected || "N/A"}個 / 最大評価回数: ${work.toLocaleString()}`;
}

function updateUrl() {
  const defaults = {
    seedStart: "0x32700", seedEnd: "0x327ff", end: "1000", maxCount: "1000",
    workers: String(defaultWorkerCount), nowCount: "", nowCount1: "", seed1: ""
  };
  const params = new URLSearchParams();
  for (const id of controls) {
    if (byId(id).value !== defaults[id]) params.set(id, byId(id).value);
  }
  if (byId("autostart").checked) params.set("autostart", "1");
  const status = observationString();
  if (status) params.set("status", status);
  const url = new URL(location.href);
  url.search = params.toString();
  url.hash = "";
  history.replaceState({}, "", url);
  byId("share").value = url.href;
  setControlState();
}

function loadUrl() {
  const params = new URLSearchParams(location.search);
  for (const id of controls) {
    const value = params.get(id);
    if (value !== null) byId(id).value = value;
  }
  byId("autostart").checked = params.get("autostart") === "1";
  const status = (params.get("status") || "").slice(0, OBSERVATION_COUNT).replace(/[^01]/g, "");
  for (let index = 0; index < status.length; ++index) byId(`menu${index}`).value = status[index];
  byId("yoko").value = status.replaceAll("0", "よ").replaceAll("1", "こ");
}

function generateDropdowns() {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < OBSERVATION_COUNT; ++index) {
    const row = document.createElement("label");
    row.className = "observation-row";
    row.append(document.createTextNode(String(index + 1)));
    const select = document.createElement("select");
    select.id = `menu${index}`;
    select.setAttribute("aria-label", `${index + 1}個目`);
    select.innerHTML = '<option value=""></option><option value="0">ようす</option><option value="1">こうげき</option>';
    select.addEventListener("input", () => {
      if (select.value === "") {
        for (let next = index + 1; next < OBSERVATION_COUNT; ++next) byId(`menu${next}`).value = "";
      }
      const status = observationString();
      byId("yoko").value = status.replaceAll("0", "よ").replaceAll("1", "こ");
      observationChanged();
    });
    row.append(select);
    fragment.append(row);
  }
  byId("dropdowns").append(fragment);
}

function observationChanged() {
  updateUrl();
  if (!byId("autostart").checked) return;
  clearTimeout(autoStartTimer);
  autoStartTimer = setTimeout(() => runSearch(true), 500);
}

function updateFromYoko() {
  const normalized = (byId("yoko").value.match(/[よこ]/g) || []).join("").slice(0, OBSERVATION_COUNT);
  for (let index = 0; index < OBSERVATION_COUNT; ++index) {
    const character = normalized[index] || "";
    byId(`menu${index}`).value = character === "よ" ? "0" : character === "こ" ? "1" : "";
  }
  observationChanged();
}

function requestFromControls() {
  const seedStart = parseHex(byId("seedStart").value);
  const seedEnd = parseHex(byId("seedEnd").value);
  const maxFrame = Number.parseInt(byId("end").value, 10);
  const maxCount = Number.parseInt(byId("maxCount").value, 10);
  const requestedWorkers = Number.parseInt(byId("workers").value, 10);
  let startFilter = parseOptionalInteger("nowCount");
  const endFilter = parseOptionalInteger("nowCount1");
  const hasStartFilter = byId("nowCount").value.trim() !== "";
  const hasEndFilter = byId("nowCount1").value.trim() !== "";
  if (hasEndFilter) startFilter = 0;
  const filterFlags = hasEndFilter ? 2 : hasStartFilter ? 1 : 0;
  const fixedSeedText = byId("seed1").value.trim();
  const fixedSeed = fixedSeedText === "" ? 0 : parseHex(fixedSeedText);

  if (![seedStart, seedEnd, maxFrame, maxCount, requestedWorkers, startFilter, endFilter, fixedSeed].every(Number.isFinite)) {
    throw new Error("入力値の形式が不正です。");
  }
  if (seedStart < 0 || seedEnd < seedStart || seedEnd > 0xffffffff) throw new Error("seed範囲が不正です。");
  if (maxFrame < 1 || maxFrame > 0xffffffff) throw new Error("調査回数は1以上にしてください。");
  if (maxCount < 1 || maxCount >= RESULT_CAPACITY) throw new Error("表示上限は1～99999にしてください。");
  if (requestedWorkers < 1 || requestedWorkers > 64) throw new Error("Worker数は1～64にしてください。");
  if ((hasStartFilter && startFilter < 0) || (hasEndFilter && endFilter < 0)) {
    throw new Error("消費数は0以上、または未指定にしてください。");
  }
  if ((hasStartFilter && startFilter >= maxFrame) || (hasEndFilter && endFilter >= maxFrame)) {
    throw new Error("消費数は調査回数未満にしてください（1000回なら0～999F）。");
  }
  if (fixedSeedText && (fixedSeed < seedStart || fixedSeed > seedEnd)) throw new Error("初期シード指定は探索範囲内にしてください。");

  const status = observationString();
  const pattern = buildPattern(status);
  return {
    seedStart: fixedSeedText ? fixedSeed : seedStart,
    seedEnd: fixedSeedText ? fixedSeed : seedEnd,
    maxFrame, maxCount, requestedWorkers, startFilter, endFilter, filterFlags, pattern
  };
}

function stopSearch(message = "停止しました") {
  ++activeRun;
  for (const worker of activeWorkers) worker.terminate();
  activeWorkers = [];
  byId("cancel").disabled = true;
  byId("runTop").disabled = false;
  byId("runBottom").disabled = false;
  if (message) byId("progress").textContent = message;
}

function getWasmModule() {
  if (!wasmModulePromise) {
    wasmModulePromise = fetch("search.wasm")
      .then(response => {
        if (!response.ok) throw new Error(`search.wasmの取得に失敗しました (${response.status})`);
        return response.arrayBuffer();
      })
      .then(bytes => WebAssembly.compile(bytes));
  }
  return wasmModulePromise;
}

function elapsedSeconds(startedAt) {
  return `${((performance.now() - startedAt) / 1000).toFixed(3)}秒`;
}

function renderResults(results, request, automatic) {
  results.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const exceeded = results.length > request.maxCount;
  const visible = results.slice(0, request.maxCount);
  const tbody = byId("table").tBodies[0];
  const fragment = document.createDocumentFragment();
  for (const [seed, startFrame, endFrame] of visible) {
    const row = document.createElement("tr");
    for (const value of [`0x${seed.toString(16)}`, startFrame, endFrame, endFrame + 1]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    const linkCell = document.createElement("td");
    const link = document.createElement("a");
    const listEnd = BigInt(startFrame) + 500n;
    link.href = `list.html?seed=${seed.toString(16)}&start=${endFrame + 1}&end=${listEnd}`;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "開く";
    linkCell.append(link);
    row.append(linkCell);
    fragment.append(row);
  }
  tbody.replaceChildren(fragment);
  byId("messages").textContent = visible.length === 0
    ? "一致なし"
    : exceeded ? `表示上限を超えたため、先頭${request.maxCount}件を表示しています。` : `${visible.length}件見つかりました。`;
  if (automatic && visible.length <= 1) alert(visible.length === 0 ? "一致なし" : "1件見つかりました");
}

async function runSearch(automatic = false) {
  stopSearch("");
  const runId = activeRun;
  let request;
  try {
    request = requestFromControls();
  } catch (error) {
    byId("messages").textContent = error.message;
    return;
  }

  const seedCount = request.seedEnd - request.seedStart + 1;
  const workerCount = Math.min(request.requestedWorkers, seedCount);
  const chunkSize = Math.ceil(seedCount / workerCount);
  const resultLimit = request.maxCount + 1;
  const progress = new Array(workerCount).fill(0);
  const allResults = [];
  let finished = 0;
  const startedAt = performance.now();

  byId("table").tBodies[0].replaceChildren();
  byId("messages").textContent = "";
  byId("progress").textContent = "WebAssemblyを準備中…";
  byId("cancel").disabled = false;
  byId("runTop").disabled = true;
  byId("runBottom").disabled = true;

  try {
    const wasmModule = await getWasmModule();
    if (runId !== activeRun) return;
    for (let id = 0; id < workerCount; ++id) {
      const begin = request.seedStart + id * chunkSize;
      const end = Math.min(request.seedEnd, begin + chunkSize - 1);
      if (begin > end) break;
      const worker = new Worker(workerUrl);
      activeWorkers.push(worker);
      worker.onmessage = ({ data }) => {
        if (runId !== activeRun) return;
        if (data.type === "progress") {
          progress[data.id] = data.completed;
          const completed = progress.reduce((sum, value) => sum + value, 0);
          byId("progress").textContent = `探索中: ${completed.toLocaleString()} / ${seedCount.toLocaleString()} seeds`;
        } else if (data.type === "done") {
          progress[data.id] = data.completed;
          allResults.push(...data.results);
          if (allResults.length >= resultLimit) {
            renderResults(allResults, request, automatic);
            stopSearch(`表示上限到達: ${progress.reduce((sum, value) => sum + value, 0).toLocaleString()} seedsを探索 / ${elapsedSeconds(startedAt)}`);
            return;
          }
          ++finished;
          if (finished === workerCount) {
            renderResults(allResults, request, automatic);
            const completed = progress.reduce((sum, value) => sum + value, 0);
            stopSearch(`完了: ${completed.toLocaleString()} seeds / Worker ${workerCount} / ${elapsedSeconds(startedAt)}`);
          }
        } else if (data.type === "error") {
          stopSearch("エラーで停止しました");
          byId("messages").textContent = data.message;
        }
      };
      worker.onerror = event => {
        if (runId !== activeRun) return;
        stopSearch("Workerエラーで停止しました");
        byId("messages").textContent = event.message;
      };
      worker.postMessage({
        type: "search", id, wasmModule,
        seedStart: begin, seedEnd: end,
        maxFrame: request.maxFrame,
        patternLow: request.pattern.low,
        patternHigh: request.pattern.high,
        patternLength: request.pattern.length,
        startFilter: request.startFilter,
        endFilter: request.endFilter,
        filterFlags: request.filterFlags,
        resultLimit
      });
    }
  } catch (error) {
    if (runId !== activeRun) return;
    stopSearch("WebAssemblyの準備に失敗しました");
    byId("messages").textContent = String(error);
  }
}

function initialize() {
  generateDropdowns();
  byId("workers").value = String(defaultWorkerCount);
  loadUrl();

  for (const id of controls) byId(id).addEventListener("input", updateUrl);
  byId("autostart").addEventListener("input", updateUrl);
  byId("seedlist").addEventListener("input", () => {
    if (byId("seedlist").value) {
      const [start, end] = byId("seedlist").value.split(",");
      byId("seedStart").value = `0x${start}`;
      byId("seedEnd").value = `0x${end}`;
    }
    updateUrl();
  });
  byId("shortcut").addEventListener("input", () => {
    if (byId("shortcut").value) byId("seed1").value = `0x${byId("shortcut").value}`;
    updateUrl();
  });
  byId("yoko").addEventListener("compositionstart", () => { yokoComposing = true; });
  byId("yoko").addEventListener("compositionend", () => {
    yokoComposing = false;
    updateFromYoko();
  });
  byId("yoko").addEventListener("input", event => {
    if (!yokoComposing && !event.isComposing) updateFromYoko();
  });
  byId("runTop").addEventListener("click", () => runSearch(false));
  byId("runBottom").addEventListener("click", () => runSearch(false));
  byId("cancel").addEventListener("click", () => stopSearch());
  byId("reset").addEventListener("click", () => location.assign(location.pathname));
  byId("share").addEventListener("click", event => event.currentTarget.select());
  updateUrl();
}

initialize();
