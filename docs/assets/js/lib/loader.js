// /docs/assets/js/lib/loader.js
import { assert } from './util.js';

const CANDIDATE_BASES = ['./data', '../data', '/data'];
(function appendGhPagesBase() {
  try {
    const u = new URL(document.baseURI);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 1) {
      const repo = `/${parts[0]}`;
      for (const p of [`${repo}/data`, `${repo}/docs/data`]) {
        if (!CANDIDATE_BASES.includes(p)) CANDIDATE_BASES.push(p);
      }
    }
  } catch {}
})();

const DBG = (() => new URLSearchParams(location.search).get('debug') !== '0')();

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
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  try { return await res.json(); }
  catch (e) { throw new Error(`JSON parse error for ${url}: ${e.message}`); }
}

async function fetchFromCandidates(relPath) {
  const errors = [];
  for (const base of CANDIDATE_BASES) {
    const url = `${base}/${relPath}`.replace(/\/{2,}/g, '/');
    try {
      const json = await tryFetchJSON(url);
      return { json, urlTried: url };
    } catch (err) { errors.push(`- ${err.message}`); }
  }
  throw new Error(
    [`[loader] 無法載入 ${relPath}`, `已嘗試：`,
     ...CANDIDATE_BASES.map(b => `  • ${b}/${relPath}`), `詳細錯誤：`, ...errors].join('\n')
  );
}

// ===== 公開 API（檔名：items_public_32.json / *_adv_A|B|C, weights 同名規則） =====
export async function loadItemsBasic() {
  const { json, urlTried } = await fetchFromCandidates('items_public_32.json');
  const items = normalizeItemsContainer(json);
  assert(items.length > 0, `[loader] 基礎題庫為空（來源：${urlTried}）`);
  showOverlay(['[items_basic]', `url: ${urlTried}`, `count: ${items.length}`, `first.text: ${truncate(items[0]?.text)}`]);
  return items;
}

export async function loadItemsAdv(set = 'A') {
  const S = String(set).toUpperCase();
  const { json, urlTried } = await fetchFromCandidates(`items_public_adv_${S}.json`);
  const items = normalizeItemsContainer(json);
  assert(items.length > 0, `[loader] 進階題庫為空（${S}，來源：${urlTried}）`);
  showOverlay([`[items_adv_${S}]`, `url: ${urlTried}`, `count: ${items.length}`, `first.text: ${truncate(items[0]?.text)}`]);
  return items;
}

export async function loadWeightsBasic() {
  const { json } = await fetchFromCandidates('weights/weights_32.json');
  return json;
}
export async function loadWeightsAdv(set = 'A') {
  const S = String(set).toUpperCase();
  const { json } = await fetchFromCandidates(`weights/weights_adv_${S}.json`);
  return json;
}
export async function loadMappingFuncs() {
  const { json } = await fetchFromCandidates('mapping/funcs.json');
  return json;
}
export async function loadMappingTypes() {
  const { json } = await fetchFromCandidates('mapping/types.json');
  return json;
}

// ===== 結構相容 =====
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

function normalizeItems(arr) {
  return arr.map((it, i) => {
    const id = it.id ?? it.qid ?? it.key ?? `q_${i + 1}`;
    const text = coalesce(
      it.text, it.stem,         // <-- 加入 stem
      it.title, it.desc, it.description, it.content,
      it.label, it.prompt, it.question, it.name, it.q
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