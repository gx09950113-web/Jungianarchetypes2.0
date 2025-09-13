// /docs/assets/js/lib/loader.js
// Ultra-robust 版：瘋狂相容鍵名 + 多路徑探測 + 可視化 debug overlay（?debug=0 可關）

import { assert } from './util.js';

const CANDIDATE_BASES = [
  './data', '../data', '/data'
];

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
  } catch {}
})();

const DBG = (() => {
  const q = new URLSearchParams(location.search);
  return q.get('debug') !== '0';
})();

function showOverlay(lines) {
  if (!DBG) return;
  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed', right: '8px', bottom: '8px', zIndex: 99999,
    maxWidth: '92vw', maxHeight: '40vh', overflow: 'auto',
    padding: '10px 12px', background: 'rgba(0,0,0,.8)', color: '#fff',
    font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,.35)', whiteSpace: 'pre-wrap'
  });
  box.textContent = lines.join('\n');
  document.body.appendChild(box);
}

async function tryFetchJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} for ${url}\n${text.slice(0,200)}`);
  }
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`JSON parse error for ${url}: ${e.message}`);
  }
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
    `已嘗試：`, ...CANDIDATE_BASES.map(b => `  • ${b}/${relPath}`),
    `詳細錯誤：`, ...errors,
  ].join('\n');
  throw new Error(msg);
}

// ============== 公開 API（固定 *_adv_A|B|C 命名） ============================
export async function loadItemsBasic() {
  const { json, urlTried } = await fetchFromCandidates('items_public_32.json');
  const items = normalizeItemsContainer(json);
  assert(items.length > 0, `[loader] 基礎題庫為空（來源：${urlTried}）`);
  showOverlay([
    '[items_basic]', `url: ${urlTried}`, `count: ${items.length}`,
    `first.text: ${truncate(items[0]?.text)}`
  ]);
  return items;
}

export async function loadItemsAdv(set = 'A') {
  const S = String(set).toUpperCase();
  const fname = `items_public_adv_${S}.json`;
  const { json, urlTried } = await fetchFromCandidates(fname);
  const items = normalizeItemsContainer(json);
  assert(items.length > 0, `[loader] 進階題庫為空（${S}，來源：${urlTried}）`);
  showOverlay([
    `[items_adv_${S}]`, `url: ${urlTried}`, `count: ${items.length}`,
    `first.text: ${truncate(items[0]?.text)}`
  ]);
  return items;
}

export async function loadWeightsBasic() {
  const { json, urlTried } = await fetchFromCandidates('weights/weights_32.json');
  assert(!!json, `[loader] 基礎權重讀取失敗（來源：${urlTried}）`);
  return json;
}

export async function loadWeightsAdv(set = 'A') {
  const S = String(set).toUpperCase();
  const fname = `weights/weights_adv_${S}.json`;
  const { json, urlTried } = await fetchFromCandidates(fname);
  assert(!!json, `[loader] 進階權重讀取失敗（${S}，來源：${urlTried}）`);
  return json;
}

export async function loadMappingFuncs() {
  const { json, urlTried } = await fetchFromCandidates('mapping/funcs.json');
  assert(!!json, `[loader] funcs.json 讀取失敗（來源：${urlTried}）`);
  return json;
}

export async function loadMappingTypes() {
  const { json, urlTried } = await fetchFromCandidates('mapping/types.json');
  assert(!!json, `[loader] types.json 讀取失敗（來源：${urlTried}）`);
  return json;
}

// ============== 相容處理 =====================================================
// 允許容器鍵：items / questions / list / data / payload / results
function normalizeItemsContainer(raw) {
  const candidates = [];
  if (Array.isArray(raw)) candidates.push(raw);
  if (raw && typeof raw === 'object') {
    for (const key of ['items', 'questions', 'list', 'data', 'payload', 'results']) {
      if (Array.isArray(raw[key])) candidates.push(raw[key]);
    }
  }
  const arr = candidates.find(a => a.length) || [];
  return normalizeItems(arr);
}

// 把各種鍵名對映成 { id, text }；保留 options/choices 如有
function normalizeItems(arr) {
  return arr.map((it, i) => {
    const id = it.id ?? it.qid ?? it.key ?? `q_${i + 1}`;
    const text = coalesce(
      it.text, it.title, it.desc, it.description, it.content, it.label, it.prompt, it.question, it.name, it.q
    );
    const options = it.options ?? it.choices ?? null;
    return { ...it, id, text: String(text ?? '').trim(), options };
  }).filter(it => it.text && it.text.length > 0);
}

function coalesce(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  return '';
}

function truncate(s, n = 80) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}