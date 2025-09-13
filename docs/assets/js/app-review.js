// /docs/assets/js/app-review.js
// 入口：review.html 專用
// - 綁定 DOMContentLoaded
// - 呼叫 renderReview({ target, onReady, onError })

import { renderReview } from './ui/render-review.js';

let __booted = false;

function showError(err) {
  console.error('[app-review] init failed:', err);
  const root = document.getElementById('app') || document.body;
  const box = document.createElement('div');
  box.style.margin = '1rem';
  box.style.padding = '1rem';
  box.style.border = '1px solid var(--c-border, #888)';
  box.style.borderRadius = '8px';
  box.style.background = 'var(--c-bg-soft, rgba(0,0,0,0.05))';
  box.style.fontSize = '0.95rem';
  box.innerHTML = `
    <strong>歷次紀錄初始化失敗</strong><br/>
    <code>${(err && err.message) ? err.message : String(err)}</code>
  `;
  root.appendChild(box);
}

function main() {
  if (__booted) return;
  __booted = true;

  document.documentElement.classList.remove('no-js');

  const target = document.getElementById('app') || document.body;

  const initOptions = {
    target,
    onReady() {
      // console.log('[app-review] ready');
    },
    onError: showError,
  };

  try {
    renderReview(initOptions);
  } catch (err) {
    showError(err);
  }
}

// 綁定 DOMContentLoaded（防重複）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}