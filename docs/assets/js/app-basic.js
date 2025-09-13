// /docs/assets/js/app-basic.js
// 入口：basic.html 專用

import { initRenderBasic } from './ui/render-basic.js';

let __booted = false;

function showError(err) {
  // 只記錄到 Console，不再插入畫面上的提示框
  console.error('[app-basic] init failed:', err);
}

async function main() {
  if (__booted) return;
  __booted = true;

  const initOptions = {}; // 若未來要傳參數可放這裡

  try {
    await initRenderBasic('app'); // <-- 呼叫 initRenderBasic
  } catch (err) {
    showError(err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}