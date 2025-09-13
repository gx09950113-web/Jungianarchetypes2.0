// /docs/assets/js/app-advanced.js
// 入口：advanced.html 專用

import { initRenderAdvanced } from './ui/render-advanced.js';
import { getQuery } from './lib/router.js';

let __booted = false;

function showError(err) {
  console.error('[app-advanced] init failed:', err);
  const root = document.getElementById('app') || document.body;
  const box = document.createElement('div');
  box.style.margin = '1rem';
  box.style.padding = '1rem';
  box.style.border = '1px solid #e11d48';
  box.style.background = '#fff1f2';
  box.style.color = '#9f1239';
  box.textContent = 'Advanced 渲染失敗：' + (err?.message || err);
  root.prepend(box);
}

async function main() {
  if (__booted) return;
  __booted = true;

  const q = getQuery();
  const set = String(q.set || q.group || q.a || 'A').toUpperCase();

  try {
    await initRenderAdvanced('app'); // <-- 改為 initRenderAdvanced
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