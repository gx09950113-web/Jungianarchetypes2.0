// /docs/assets/js/app-review.js
// 入口：review.html 專用

import { initRenderReview } from './ui/render-review.js';

let __booted = false;

function showError(err) {
  console.error('[app-review] init failed:', err);
  const root = document.getElementById('app') || document.body;
  const box = document.createElement('div');
  box.style.margin = '1rem';
  box.style.padding = '1rem';
  box.style.border = '1px solid #e11d48';
  box.style.background = '#fff1f2';
  box.style.color = '#9f1239';
  box.textContent = 'Review 渲染失敗：' + (err?.message || err);
  root.prepend(box);
}

async function main() {
  if (__booted) return;
  __booted = true;

  try {
    await initRenderReview('app'); // <-- 改為 initRenderReview
  } catch (err) {
    showError(err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}