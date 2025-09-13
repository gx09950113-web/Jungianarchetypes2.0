// docs/assets/js/lib/util.js
// Pure utility helpers (no UI deps)

//
// ──────────────────────────────── Helpers ─────────────────────────────────
//

/**
 * Simple invariant check.
 * @param {boolean} cond
 * @param {string=} msg
 */
export function assert(cond, msg = 'Assertion failed') {
  if (!cond) throw new Error(msg);
}

/**
 * Monotonic-ish timestamp as ISO-8601 without milliseconds.
 * Uses Date.toISOString() (UTC) by default.
 * @param {('utc'|'local')} mode  utc (default) or local
 * @returns {string}
 */
export function nowISO(mode = 'utc') {
  const d = new Date();
  if (mode === 'local') {
    // YYYY-MM-DDTHH:mm:ss+ZZ:ZZ
    const pad = (n) => String(n).padStart(2, '0');
    const tzMin = -d.getTimezoneOffset();
    const sign = tzMin >= 0 ? '+' : '-';
    const hh = pad(Math.trunc(Math.abs(tzMin) / 60));
    const mm = pad(Math.abs(tzMin) % 60);
    return (
      d.getFullYear() +
      '-' + pad(d.getMonth() + 1) +
      '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) +
      ':' + pad(d.getMinutes()) +
      ':' + pad(d.getSeconds()) +
      sign + hh + ':' + mm
    );
  }
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); // strip ms
}

/**
 * UUID v4 (RFC 4122) with crypto if available, fallback to Math.random().
 * @returns {string}
 */
export function uuid() {
  // Prefer Web Crypto
  const cryptoObj =
    (typeof globalThis !== 'undefined' && (globalThis.crypto || globalThis.msCrypto)) || null;

  if (cryptoObj && cryptoObj.getRandomValues) {
    const b = new Uint8Array(16);
    cryptoObj.getRandomValues(b);
    // Per RFC 4122 section 4.4
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10
    const hex = [...b].map((x) => x.toString(16).padStart(2, '0'));
    return (
      hex.slice(0, 4).join('') + hex.slice(4, 6).join('') + '-' +
      hex.slice(6, 8).join('') + '-' +
      hex.slice(8, 10).join('') + '-' +
      hex.slice(10, 12).join('') + '-' +
      hex.slice(12, 16).join('')
    );
  }

  // Fallback (not cryptographically secure)
  let t = '';
  for (let i = 0; i < 36; i++) {
    if ([8, 13, 18, 23].includes(i)) { t += '-'; continue; }
    if (i === 14) { t += '4'; continue; }
    const r = (Math.random() * 16) | 0;
    t += (i === 19 ? (r & 0x3) | 0x8 : r).toString(16);
  }
  return t;
}

/**
 * Fisher–Yates shuffle. Returns a new array; does not mutate input.
 * @template T
 * @param {readonly T[]} arr
 * @param {Object} [opts]
 * @param {number} [opts.seed] Optional deterministic seed (32-bit int). If provided, uses xorshift.
 * @returns {T[]}
 */
export function shuffle(arr, opts = {}) {
  assert(Array.isArray(arr), 'shuffle() expects an array');
  const out = arr.slice();

  // RNG: crypto -> seeded xorshift -> Math.random
  let rnd = Math.random;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues && !opts.seed) {
    const buf = new Uint32Array(1);
    rnd = () => {
      crypto.getRandomValues(buf);
      // map [0, 2^32) => [0,1)
      return buf[0] / 0xffffffff;
    };
  } else if (Number.isInteger(opts.seed)) {
    // xorshift32
    let x = (opts.seed | 0) || 1;
    rnd = () => {
      // xorshift32
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      // map to [0,1)
      return ((x >>> 0) / 4294967296);
    };
  }

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

//
// ──────────────────────────────── Extras ─────────────────────────────────
// (tiny, commonly useful helpers for this project; safe to keep here)

/**
 * Shallow clone + freeze (to discourage accidental mutations).
 * @template T
 * @param {T} obj
 * @returns {Readonly<T>}
 */
export function freezed(obj) {
  return Object.freeze({ ...(obj ?? {}) });
}

/**
 * Create a namespaced key for storage or logs.
 * @param {string} ns
 * @param {string} key
 */
export function nsKey(ns, key) {
  assert(ns && key, 'nsKey(ns, key) requires both');
  return `${ns}:${key}`;
}

//
// ──────────────────────────────── Global Hook ────────────────────────────────
// Attach to window for quick console poking in dev pages (optional but handy)
const Util = { assert, nowISO, uuid, shuffle, freezed, nsKey };
try {
  if (typeof window !== 'undefined') {
    // avoid overwriting if already exists
    window.Util = window.Util || Util;
  }
} catch { /* noop for SSR */ }

export default Util;