// /docs/assets/js/app-result.js
import { initRenderResult } from './ui/render-result.js';
import { getQuery } from './lib/router.js';
import * as store from './lib/store.js';

let __booted = false;

async function main() {
  if (__booted) return;
  __booted = true;

  try {
    const q = getQuery();
    let id = q.id;
    if (!id) {
      const list = store.listResults();
      if (Array.isArray(list) && list.length > 0) id = list[0].id; // 最近期一筆
    }
    if (!id) {
      console.warn('[app-result] missing id and no local history; skip render.');
      return;
    }

    await initRenderResult('app');
    console.debug('[result] ready, id =', id);
  } catch (err) {
    console.error('[app-result] init failed:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
