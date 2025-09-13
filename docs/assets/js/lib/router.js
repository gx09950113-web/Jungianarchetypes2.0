// docs/assets/js/lib/router.js
// Tiny, UI-agnostic querystring router for static pages
// Exposes:
//   - getQuery(loc?) -> Object
//   - setQuery(updates, opts?) -> Object
//   - toQueryString(obj) -> string
//   - parseQueryString(search) -> Object
// Notes:
//   - Supports shorthand like `advanced.html?a` → { group: 'a' }
//   - Boolean flags encode as "?flag" (true) and are omitted if false/null/undefined
//   - Safe for SSR / non-browser use (window guarded)

import { assert } from './util.js';

//
// ──────────────────────────────── internals ────────────────────────────────
//

/**
 * Decode a component safely.
 * @param {string} s
 */
function dec(s) {
  try { return decodeURIComponent(s.replace(/\+/g, ' ')); }
  catch { return s; }
}

/**
 * Encode a component safely.
 * @param {string} s
 */
function enc(s) {
  return encodeURIComponent(String(s));
}

/**
 * Heuristic shorthand parsing used by this project:
 * - a/b/c (single letter A|B|C) → group: 'a'|'b'|'c'
 * - id-like token (uuid-ish) → id: token (only if id wasn't provided explicitly)
 * Otherwise falls back to boolean flag: token=true
 * @param {string} token raw token without '='
 * @param {Record<string, any>} out target object to mutate
 */
function applyShorthandToken(token, out) {
  const t = token.trim();
  if (!t) return;

  // advanced.html?a / ?A / ?b / ?C
  if (/^[abc]$/i.test(t)) {
    // don't overwrite explicit group set via k=v
    if (out.group == null) out.group = t.toLowerCase();
    return;
  }

  // Looks like an id (uuid v4 or similar 8-4-4-4-12; also accept plain 32/36 hex)
  if (
    (/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(t)) ||
    (/^[0-9a-f]{32}$/i.test(t)) ||
    (/^[0-9a-z_-]{10,}$/i.test(t)) // general fallback for session ids
  ) {
    if (out.id == null) out.id = t;
    return;
  }

  // Fallback: boolean flag
  out[t] = true;
}

/**
 * Make a shallow copy and strip nullish/falsey flags per encoding rules.
 * Keep: numbers, non-empty strings, true booleans, arrays (stringified), objects (JSON).
 * Drop: null, undefined, false, '', NaN
 * @param {Record<string, any>} obj
 */
function normalizeForEncode(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === null || v === undefined) continue;
    if (v === false) continue;
    if (typeof v === 'string' && v === '') continue;
    if (typeof v === 'number' && Number.isNaN(v)) continue;
    out[k] = v;
  }
  return out;
}

//
// ──────────────────────────────── public api ────────────────────────────────
//

/**
 * Parse a location.search string (with leading '?' optional).
 * Supports:
 *   - key=value pairs
 *   - bare "flag" tokens → {flag: true}
 *   - project shorthand: '?a'|'?b'|'?c' → {group:'a'|'b'|'c'}
 *   - bare id-like token → {id:'...'} when no explicit id present
 * @param {string} search
 * @returns {Record<string, any>}
 */
export function parseQueryString(search) {
  const out = {};
  if (!search) return out;

  const s = search.startsWith('?') ? search.slice(1) : search;
  if (!s) return out;

  for (const raw of s.split('&')) {
    if (!raw) continue;
    const eq = raw.indexOf('=');
    if (eq >= 0) {
      const k = dec(raw.slice(0, eq));
      const vRaw = dec(raw.slice(eq + 1));
      // interpret booleans & numbers lightly
      let v;
      if (vRaw === '' || vRaw.toLowerCase() === 'true') v = true;
      else if (vRaw.toLowerCase() === 'false') v = false;
      else if (!Number.isNaN(Number(vRaw)) && vRaw.trim() !== '') v = Number(vRaw);
      else v = vRaw;
      out[k] = v;
    } else {
      applyShorthandToken(dec(raw), out);
    }
  }
  return out;
}

/**
 * Convert an object into a querystring starting with '?'.
 * Encoding rules:
 *  - true booleans → "?flag"
 *  - false/null/undefined/''/NaN → omitted
 *  - arrays → repeated keys (?k=v1&k=v2)
 *  - objects → JSON stringified
 * @param {Record<string, any>} obj
 * @returns {string} like "?a=1&b&c=hi"
 */
export function toQueryString(obj) {
  const norm = normalizeForEncode(obj);
  const parts = [];

  for (const [k, v] of Object.entries(norm)) {
    if (v === true) {
      parts.push(enc(k));
      continue;
    }
    if (Array.isArray(v)) {
      for (const item of v) {
        parts.push(`${enc(k)}=${enc(item)}`);
      }
      continue;
    }
    if (typeof v === 'object') {
      parts.push(`${enc(k)}=${enc(JSON.stringify(v))}`);
      continue;
    }
    parts.push(`${enc(k)}=${enc(v)}`);
  }

  return parts.length ? `?${parts.join('&')}` : '';
}

/**
 * Get current page's query object (browser) or from a provided Location-like.
 * Also returns `.path` (pathname) and `.page` (basename) as non-enumerable props.
 * @param {Location|{search?:string, pathname?:string}} [loc]
 * @returns {Record<string, any>}
 */
export function getQuery(loc) {
  const hasWindow = (typeof window !== 'undefined' && window.location);
  const L = loc || (hasWindow ? window.location : { search: '', pathname: '' });
  const q = parseQueryString(L.search || '');

  // attach metadata (non-enumerable)
  Object.defineProperty(q, 'path', { value: L.pathname || '', enumerable: false });
  const page = (L.pathname || '').split('/').pop() || '';
  Object.defineProperty(q, 'page', { value: page, enumerable: false });

  return q;
}

/**
 * Merge current query with updates and write to URL.
 * Deleting keys: pass null/undefined/false/'' to remove them from query.
 * Options:
 *  - replace (default true): history.replaceState vs pushState
 *  - clear (default false): ignore existing query, start from empty
 *  - basePath (default current pathname)
 *  - hash (string) override hash fragment (e.g., "#top")
 *  - returnUrl (default false): if true, do not mutate history; just return {url, query}
 *
 * @param {Record<string, any>} updates
 * @param {{
 *  replace?: boolean,
 *  clear?: boolean,
 *  basePath?: string,
 *  hash?: string,
 *  returnUrl?: boolean
 * }} [opts]
 * @returns {Record<string, any>} final query object
 */
export function setQuery(updates = {}, opts = {}) {
  const hasWindow = (typeof window !== 'undefined' && window.location && window.history);
  assert(hasWindow || opts.returnUrl, 'setQuery() needs a browser environment or {returnUrl:true}');

  const {
    replace = true,
    clear = false,
    basePath,
    hash,
    returnUrl = false,
  } = opts;

  const current = clear ? {} : getQuery();
  const next = { ...current, ...(updates || {}) };
  // strip metadata if present
  delete next.path;
  delete next.page;

  const search = toQueryString(next);
  const path = basePath ?? (hasWindow ? window.location.pathname : '/');
  const h = (hash !== undefined) ? hash : (hasWindow ? window.location.hash : '');
  const url = `${path}${search}${h || ''}`;

  if (returnUrl || !hasWindow) {
    return Object.defineProperty(parseQueryString(search), 'url', { value: url, enumerable: false });
  }

  if (replace) {
    window.history.replaceState(null, '', url);
  } else {
    window.history.pushState(null, '', url);
  }
  return parseQueryString(search);
}

//
// ──────────────────────────────── global hook (dev) ─────────────────────────
//

try {
  if (typeof window !== 'undefined') {
    window.Router = window.Router || { getQuery, setQuery, toQueryString, parseQueryString };
  }
} catch { /* noop for SSR */ }

export default { getQuery, setQuery, toQueryString, parseQueryString };