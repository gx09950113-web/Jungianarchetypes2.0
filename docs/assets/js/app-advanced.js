// /docs/assets/js/app-advanced.js
// 入口：advanced.html 專用
// - 綁定 DOMContentLoaded
// - 解析 ?set=（A/B/C；預設 A）
// - 呼叫 renderAdvanced(set)
// - 簡單錯誤顯示 & 單次啟動保護

import { renderAdvanced } from './ui/render-advanced.js';
import { getQuery } from './lib/router.js';

let __booted = false;

function showError(err) {
  console.error('[app-advanced] init failed:', err);
  const root = document.getElementById('app') || document.body;
  const box = document.createElement('div');
  box.style.margin = '1rem';
  box.style.padding = '1rem';
  box.style.border = '1px solid var(--c-border, #888)';
  box.style.borderRadius = '8px';
  box.style.background = 'var(--c-bg-soft, rgba(0,0,0,0.05))';
  box.style.fontSize = '0.95rem';
  box.innerHTML = `
    <strong>初始化失敗</strong><br/>
    <code>${(err && err.message) ? err.message : String(err)}</code>
  `;
  root.appendChild(box);
}

function normalizeSet(v) {
  if (!v) return 'A';
  const s = String(v).trim().toUpperCase();
  return (s === 'A' || s === 'B' || s === 'C') ? s : 'A';
}

function main() {
  if (__booted) return;
  __booted = true;

  document.documentElement.classList.remove('no-js');

  const target = document.getElementById('app') || document.body;
  const q = getQuery();          // 例如 advanced.html?set=B
  const set = normalizeSet(q.set);

  const initOptions = {
    target,        // 放畫面的容器節點
    set,           // 'A' | 'B' | 'C'
    shuffle: true, // 題序洗牌（render 端可用，不需也可忽略）
    onReady() {
      // console.log('[app-advanced] ready, set =', set);
    },
    onError: showError,
  };

  try {
    renderAdvanced(initOptions);
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