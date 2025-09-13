// /docs/assets/js/app-result.js
// 入口：result.html 專用
// - 綁定 DOMContentLoaded
// - 讀取 ?id=（必要）
// - 若未帶 id，嘗試用本機歷史中最新一筆
// - 呼叫 renderResult({ id, ... })

import { renderResult } from './ui/render-result.js';
import { getQuery } from './lib/router.js';
import * as store from './lib/store.js';

let __booted = false;

function showError(err) {
  console.error('[app-result] init failed:', err);
  const root = document.getElementById('app') || document.body;
  const box = document.createElement('div');
  box.style.margin = '1rem';
  box.style.padding = '1rem';
  box.style.border = '1px solid var(--c-border, #888)';
  box.style.borderRadius = '8px';
  box.style.background = 'var(--c-bg-soft, rgba(0,0,0,0.05))';
  box.style.fontSize = '0.95rem';
  box.innerHTML = `
    <strong>結果頁初始化失敗</strong><br/>
    <code>${(err && err.message) ? err.message : String(err)}</code>
  `;
  root.appendChild(box);
}

function showMissingId() {
  const root = document.getElementById('app') || document.body;
  const box = document.createElement('div');
  box.style.margin = '1rem';
  box.style.padding = '1rem';
  box.style.border = '1px solid var(--c-border, #888)';
  box.style.borderRadius = '8px';
  box.style.background = 'var(--c-bg-soft, rgba(0,0,0,0.05))';
  box.style.fontSize = '0.95rem';
  box.innerHTML = `
    <strong>找不到結果識別碼（id）。</strong><br/>
    請從 <a href="./index.html">首頁</a> 重新進行測驗，或到
    <a href="./review.html">歷次紀錄</a> 選擇一筆結果查看。
  `;
  root.appendChild(box);
}

function normalizeId(v) {
  if (!v) return '';
  const s = String(v).trim();
  return s;
}

function pickLatestIdFromHistory() {
  try {
    if (typeof store.listResults === 'function') {
      const arr = store.listResults() || [];
      if (arr.length > 0) {
        // 依 createdAt 由新到舊排序後取第一筆
        arr.sort((a, b) => {
          const ta = Date.parse(a.createdAt || 0) || 0;
          const tb = Date.parse(b.createdAt || 0) || 0;
          return tb - ta;
        });
        return arr[0]?.id || '';
      }
    }
  } catch (e) {
    console.warn('[app-result] failed to read history:', e);
  }
  return '';
}

function main() {
  if (__booted) return;
  __booted = true;

  document.documentElement.classList.remove('no-js');

  const target = document.getElementById('app') || document.body;
  const q = getQuery(); // 例如 result.html?id=xxxx
  let id = normalizeId(q.id || q.session || q.s);

  if (!id) {
    id = pickLatestIdFromHistory();
  }
  if (!id) {
    showMissingId();
    return;
  }

  const initOptions = {
    target,
    id,
    onReady() {
      // console.log('[app-result] ready, id =', id);
    },
    onError: showError,
  };

  try {
    renderResult(initOptions);
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