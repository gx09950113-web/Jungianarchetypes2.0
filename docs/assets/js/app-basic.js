// /docs/assets/js/app-basic.js
// 入口：basic.html 專用

import { initRenderBasic } from './ui/render-basic.js';

let __booted = false;

function showError(err) {
  console.error('[app-basic] init failed:', err);
  const root = document.getElementById('app') || document.body;
  const box = document.createElement('div');
  box.style.margin = '1rem';
  box.style.padding = '1rem';
  box.style.border = '1px solid #e11d48';
  box.style.background = '#fff1f2';
  box.style.color = '#9f1239';
  box.textContent = 'Basic 渲染失敗：' + (err?.message || err);
  root.prepend(box);
}

async function main() {
  if (__booted) return;
  __booted = true;

  const initOptions = {}; // 若未來要傳參數可放這裡

  try {
    await initRenderBasic('app'); // <-- 重要：呼叫 initRenderBasic
  } catch (err) {
    showError(err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}