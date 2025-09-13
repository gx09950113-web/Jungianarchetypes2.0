// docs/assets/js/lib/loader.js
// Responsible for loading JSON data files (items, weights, mapping).
// Provides async functions that return parsed JSON with basic caching.
// No UI logic here.

import { assert } from './util.js';

const BASE = './data';  // relative to /docs/ in GitHub Pages
const cache = new Map(); // key -> Promise<any>

/** Fetch + parse JSON with cache */
async function loadJSON(path) {
  assert(path, 'loadJSON requires path');
  if (cache.has(path)) return cache.get(path);

  const p = fetch(path, { cache: 'no-cache' })
    .then(r => {
      if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`);
      return r.json();
    })
    .catch(e => {
      console.error('loader error', path, e);
      throw e;
    });

  cache.set(path, p);
  return p;
}

// ─────────────────────────── item loaders ───────────────────────────

export async function loadItemsBasic() {
  return loadJSON(`${BASE}/items_public_32.json`);
}

/** @param {'A'|'B'|'C'} group */
export async function loadItemsAdv(group) {
  const g = (group || '').toUpperCase();
  assert(['A','B','C'].includes(g), 'loadItemsAdv(group) requires A/B/C');
  return loadJSON(`${BASE}/items_public_adv_${g}.json`);
}

// ────────────────────────── weight loaders ──────────────────────────

export async function loadWeightsBasic() {
  return loadJSON(`${BASE}/weights/weights_32.json`);
}

/** @param {'A'|'B'|'C'} group */
export async function loadWeightsAdv(group) {
  const g = (group || '').toUpperCase();
  assert(['A','B','C'].includes(g), 'loadWeightsAdv(group) requires A/B/C');
  return loadJSON(`${BASE}/weights/weights_adv_${g}.json`);
}

// ────────────────────────── mapping loaders ─────────────────────────

export async function loadFuncs() {
  return loadJSON(`${BASE}/mapping/funcs.json`);
}

export async function loadTypes() {
  return loadJSON(`${BASE}/mapping/types.json`);
}

// ────────────────────────── clear cache ─────────────────────────

/** Clear all cached promises (for dev or reload). */
export function clearCache() {
  cache.clear();
}

// ─────────────────────────── dev hook ───────────────────────────

try {
  if (typeof window !== 'undefined') {
    window.Loader = window.Loader || {
      loadItemsBasic, loadItemsAdv,
      loadWeightsBasic, loadWeightsAdv,
      loadFuncs, loadTypes,
      clearCache,
    };
  }
} catch { /* noop */ }

export default {
  loadItemsBasic, loadItemsAdv,
  loadWeightsBasic, loadWeightsAdv,
  loadFuncs, loadTypes,
  clearCache,
};