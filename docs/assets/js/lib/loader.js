// /docs/assets/js/lib/loader.js
// 強韌版資料載入器（固定使用 *_adv_A|B|C 檔名格式）
// - 題庫：items_public_adv_A/B/C.json、items_public_32.json
// - 權重：weights_adv_A/B/C.json、weights_32.json
// - 自動探測 /docs/data 路徑
// - 統一把 title/desc/description/content 對映為 item.text

import { assert } from './util.js';

// ----------------------------- 路徑探測 ---------------------------------------
const CANDIDATE_BASES = [
  './data',     // 通常 /docs/*.html → ./data
  '../data',    // 萬一相對路徑在某些情況被誤判
  '/data',      // 少數部署情境
];

// 若是 GitHub Pages 子路徑（https://user.github.io/repo/docs/...），把 /repo/data 與 /repo/docs/data 加進候選
(function appendGhPagesBase() {
  try {
    const u = new URL(document.baseURI);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 1) {
      const repo = `/${parts[0]}`;
      const withRepo = `${repo}/data`;
      const withRepoDocs = `${repo}/docs/data`;
      if (!CANDIDATE_BASES.includes(withRepo)) CANDIDATE_BASES.push(withRepo);
      if (!CANDIDATE_BASES.includes(withRepoDocs)) CANDIDATE_BASES.push(withRepoDocs);
    }
  } catch (_) {}
})();

async function tryFetchJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} for ${url}\n${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchFromCandidates(relPath) {
  const errors = [];
  for (const base of CANDIDATE_BASES) {
    const url = `${base}/${relPath}`.replace(/\/{2,}/g, '/');
    try {
      const json = await tryFetchJSON(url);
      return { json, urlTried: url };
    } catch (err) {
      errors.push(`- ${err.message}`);
    }
  }
  const msg = [
    `[loader] 無法載入 ${relPath}`,
    `已嘗試：`,
    ...CANDIDATE_BASES.map(b => `  • ${b}/${relPath}`),
    `詳細錯誤：`,
    ...errors,
  ].join('\n');
  throw new Error(msg);
}

// ----------------------------- 對外 API --------------------------------------
// 基礎題庫（32 題）
export async function loadItemsBasic() {
  const { json, urlTried } = await fetchFromCandidates('items_public_32.json');
  const items = normalizeItems(json);
  assert(Array.isArray(items) && items.length > 0, `[loader] 基礎題庫為空（來源：${urlTried}）`);
  return items;
}

// 進階題庫（固定 *_adv_A|B|C）
export async function loadItemsAdv(set = 'A') {
  const S = String(set).toUpperCase();
  const fname = `items_public_adv_${S}.json`; // <-- 依你的命名
  const { json, urlTried } = await fetchFromCandidates(fname);
  const items = normalizeItems(json);
  assert(Array.isArray(items) && items.length > 0, `[loader] 進階題庫為空（${S}，來源：${urlTried}）`);
  return items;
}

// 基礎權重
export async function loadWeightsBasic() {
  const { json, urlTried } = await fetchFromCandidates('weights/weights_32.json');
  assert(json, `[loader] 基礎權重讀取失敗（來源：${urlTried}）`);
  return json;
}

// 進階權重（固定 *_adv_A|B|C）
export async function loadWeightsAdv(set = 'A') {
  const S = String(set).toUpperCase();
  const fname = `weights/weights_adv_${S}.json`; // <-- 依你的命名
  const { json, urlTried } = await fetchFromCandidates(fname);
  assert(json, `[loader] 進階權重讀取失敗（${S}，來源：${urlTried}）`);
  return json;
}

// 對應表（functions / types）
export async function loadMappingFuncs() {
  const { json, urlTried } = await fetchFromCandidates('mapping/funcs.json');
  assert(json, `[loader] funcs.json 讀取失敗（來源：${urlTried}）`);
  return json;
}

export async function loadMappingTypes() {
  const { json, urlTried } = await fetchFromCandidates('mapping/types.json');
  assert(json, `[loader] types.json 讀取失敗（來源：${urlTried}）`);
  return json;
}

// ----------------------------- 結構轉換 --------------------------------------
// UI 端預期每題至少要有 { id, text }；這裡盡量做鍵名相容。
function normalizeItems(raw) {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : (Array.isArray(raw.items) ? raw.items : []);
  return arr.map((it, i) => {
    const id = it.id ?? it.qid ?? `q_${i + 1}`;
    const text = it.text ?? it.title ?? it.desc ?? it.description ?? it.content ?? '';
    const options = it.options ?? it.choices ?? null; // 若你的題目自帶選項就保留
    return { ...it, id, text, options };
  }).filter(it => String(it.text || '').trim().length > 0);
}