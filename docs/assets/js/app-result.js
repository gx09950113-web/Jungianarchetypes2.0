// /docs/assets/js/app-result.js
// 入口：result.html 專用

import { initRenderResult } from './ui/render-result.js';
import { getQuery } from './lib/router.js';
import * as store from './lib/store.js';

let __booted = false;

function showError(err) {
  console.error('[app-result] init failed:', err);
  const root = document.getElementById('app') || document.body;
  const box = document.createElement('div');
  box.style.margin = '1rem';
  box.style.padding = '1rem';
  box.style.border = '1px solid #e11d48';
  box.style.background = '#fff1f2';
  box.style.color = '#9f1239';
  box.textContent = 'Result 渲染失敗：' + (err?.message || err);
  root.prepend(box);
}

async function main() {
  if (__booted) return;
  __booted = true;

  const q = getQuery();
  let id = q.id;

  if (!id) {
    const list = store.listResults();
    if (Array.isArray(list) && list.length > 0) {
      id = list[0].id; // 取最近一筆
    }
  }

  if (!id) return showError(new Error('缺少 id，且在本機找不到歷史紀錄。'));

  try {
    await initRenderResult('app'); // <-- 改為 initRenderResult
    console.debug('[result] ready, id =', id);
  } catch (err) {
    showError(err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}