// docs/assets/js/lib/store.js
// Local results storage (UI-agnostic)
// API:
//   - saveResult(sessionObj) -> { id, ...saved }
//   - loadResult(id)         -> savedObj|null
//   - listResults()          -> [{ id, kind, group, mbti, createdAt, updatedAt, note? }, ...]
//   - remove(id)             -> boolean
//
// Design goals:
//   • Namespaced keys + versioning → 不與其他專案衝突
//   • 每次作答都產生「唯一 sessionId」→ 基礎與進階互不覆蓋
//   • Index 列表僅存精簡摘要（加速 review 頁載入）
//   • 嚴格 try/catch，避免 localStorage 例外中斷流程

import { assert, uuid, nowISO, nsKey } from './util.js';

const NS       = 'J8V';        // Jungian 8-Vector
const KV_VER   = 1;            // bump if breaking storage layout
const K_VER    = nsKey(NS, 'ver');          // 'J8V:ver'
const K_INDEX  = nsKey(NS, 'index');        // 'J8V:index'  (array of metas)
const K_ITEM_P = nsKey(NS, 's');            // 'J8V:s' (prefix for per-session entries)

// ───────────────────────── helpers ─────────────────────────

function safeGet(k, fallback = null) {
  try {
    const v = localStorage.getItem(k);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function safeSet(k, obj) {
  try {
    localStorage.setItem(k, JSON.stringify(obj));
    return true;
  } catch {
    // 可能超過容量或隱私模式
    return false;
  }
}

function safeRemove(k) {
  try {
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function itemKey(id) {
  assert(id, 'itemKey requires id');
  return `${K_ITEM_P}:${id}`;
}

function readIndex() {
  const arr = safeGet(K_INDEX, []);
  return Array.isArray(arr) ? arr : [];
}

function writeIndex(arr) {
  return safeSet(K_INDEX, Array.isArray(arr) ? arr : []);
}

function ensureVersion() {
  const v = safeGet(K_VER, null);
  if (v === KV_VER) return;
  // 若版本不同，可在此做 migration；目前先清理索引中的空項
  writeIndex(readIndex().filter(Boolean));
  safeSet(K_VER, KV_VER);
}

// ───────────────────────── public API ─────────────────────────

/**
 * 保存一次測驗結果（若沒有 id 會自動生成）。
 * 建議傳入的 session 物件包含（但不限於）：
 * {
 *   id?: string,
 *   kind: 'basic' | 'adv',       // 作答種類
 *   group?: 'a'|'b'|'c',         // 進階組別（僅進階使用）
 *   answers: any,                // 原始作答
 *   result: { functions, dims, mbti }, // 統一計分輸出（compute.js）
 *   note?: string,               // 可選備註
 *   meta?: object                // 其他擴充
 * }
 * @param {Record<string, any>} session
 * @returns {Record<string, any>} 完整儲存後的物件（含 id/時間戳）
 */
export function saveResult(session = {}) {
  ensureVersion();

  // 1) 準備資料
  const now = nowISO('utc');
  const id  = session.id || uuid();
  const createdAt = session.createdAt || now;
  const updatedAt = now;

  const saved = {
    ...session,
    id,
    createdAt,
    updatedAt,
  };

  // 2) 寫入單筆
  const ok = safeSet(itemKey(id), saved);
  assert(ok, 'Failed to save result (storage full or blocked)');

  // 3) 更新索引（摘要）
  const metas = readIndex();
  const summary = {
    id,
    kind: saved.kind || null,
    group: saved.group || null,
    mbti: saved.result?.mbti || null,
    createdAt,
    updatedAt,
    note: saved.note || null,
  };

  // 先移除舊 id（避免重複）
  const filtered = metas.filter(m => m && m.id !== id);
  // 置頂（最近更新在前）
  filtered.unshift(summary);
  writeIndex(filtered);

  return saved;
}

/**
 * 讀取單一結果
 * @param {string} id
 * @returns {Record<string, any>|null}
 */
export function loadResult(id) {
  ensureVersion();
  assert(id, 'loadResult(id) requires id');
  return safeGet(itemKey(id), null);
}

/**
 * 取得摘要列表（按 updatedAt DESC）
 * @returns {Array<{id:string, kind:string|null, group:string|null, mbti:string|null, createdAt:string, updatedAt:string, note?:string|null}>}
 */
export function listResults() {
  ensureVersion();
  const metas = readIndex();
  // 排序，若無時間則保持原序
  return metas
    .slice()
    .sort((a, b) => {
      const ta = Date.parse(a?.updatedAt || 0) || 0;
      const tb = Date.parse(b?.updatedAt || 0) || 0;
      return tb - ta;
    });
}

/**
 * 刪除單一結果（包含索引與本體）
 * @param {string} id
 * @returns {boolean} 是否有刪除
 */
export function remove(id) {
  ensureVersion();
  assert(id, 'remove(id) requires id');

  const existed = !!safeGet(itemKey(id), null);
  safeRemove(itemKey(id));

  const metas = readIndex();
  const next = metas.filter(m => m && m.id !== id);
  writeIndex(next);

  return existed;
}

// ───────────────────────── dev hook ─────────────────────────
try {
  if (typeof window !== 'undefined') {
    window.Store = window.Store || { saveResult, loadResult, listResults, remove };
  }
} catch { /* noop */ }

export default { saveResult, loadResult, listResults, remove };