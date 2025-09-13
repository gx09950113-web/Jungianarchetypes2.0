// /docs/assets/js/app-advanced.js
// 入口：advanced.html 專用

import { initRenderAdvanced } from './ui/render-advanced.js';
import { getQuery } from './lib/router.js';

let __booted = false;

function showError(err) {
  // 只記錄到 Console，不再插入畫面上的提示框
  console.error('[app-advanced] init failed:', err);
}

async function main() {
  if (__booted) return;
  __booted = true;

  const q = getQuery();
  const set = String(q.set || q.group || q.a || 'A').toUpperCase();

  try {
    await initRenderAdvanced('app', set); // <-- 原檔沒把 set 傳進去，這裡補上
    console.debug('[advanced] ready, set =', set);
  } catch (err) {
    showError(err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}