// /docs/assets/js/app-advanced.js
import { initRenderAdvanced } from './ui/render-advanced.js';
import { getQuery } from './lib/router.js';

let __booted = false;

async function main() {
  if (__booted) return;
  __booted = true;

  try {
    const q = getQuery();
    const set = String(q.set || q.group || q.a || 'A').toUpperCase();
    await initRenderAdvanced('app', set); // 讓進階頁吃到題組參數
    console.debug('[advanced] ready, set =', set);
  } catch (err) {
    console.error('[app-advanced] init failed:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
