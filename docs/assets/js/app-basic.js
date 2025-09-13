// /docs/assets/js/app-basic.js
// 入口：basic.html 專用
// - 綁定 DOMContentLoaded
// - 呼叫 renderBasic(initOptions)
// - 提供簡單錯誤顯示 & 單次啟動保護

import { renderBasic } from './ui/render-basic.js';

let __booted = false;

function showError(err) {
  console.error('[app-basic] init failed:', err);
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

function main() {
  if (__booted) return;
  __booted = true;

  // 可選：移除 noscript 樣式標記
  document.documentElement.classList.remove('no-js');

  const target = document.getElementById('app') || document.body;

  // 依你的 render-basic 設計，這裡只傳必要的參數。
  // render-basic 本身會：
  //  - 讀 loader 的題庫與權重
  //  - 題序洗牌、渲染 Likert
  //  - 產生 session（含 answers、原始 items id 序列）
  //  - 呼叫 store.saveResult() 並導向 result.html?id=...
  const initOptions = {
    target,          // 放畫面的容器節點
    shuffle: true,   // 題序洗牌（保險起見也給一個旗標）
    onReady() {
      // 可選：開始時要做的事（打點/Log）
      // console.log('[app-basic] ready');
    },
    onError: showError, // 將 render-basic 內部錯誤回拋時顯示
  };

  try {
    renderBasic(initOptions);
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