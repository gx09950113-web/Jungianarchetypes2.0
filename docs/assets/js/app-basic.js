// /docs/assets/js/app-basic.js
// 入口：basic.html 專用

import { initRenderBasic } from './ui/render-basic.js';

let __booted = false;

function showError(err) {
  console.error('[app-basic] init failed:', err);
  const root = document.getElementById('app') || document.body;
  const box = document.createElement('div');
  box.style.cssText = 'margin:1rem;padding:1rem;border:1px solid #e11d48;background:#fff1f2;color:#9f1239';
  box.textContent = 'Basic 渲染失敗：' + (err?.message || err);
  root.prepend(box);
}

async function main() {
  if (__booted) return;
  __booted = true;
  try {
    await initRenderBasic('app');
  } catch (err) {
    showError(err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}