// /docs/assets/js/app-result.js
// 入口：result.html 專用

import { initRenderResult } from './ui/render-result.js';
import { getQuery } from './lib/router.js';
import * as store from './lib/store.js';

let __booted = false;

function showError(err) {
  // 只記錄到 Console，不再插入畫面上的提示框
  console.error('[app-result] init failed:', err);
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
    await initRenderResult('app'); // <-- 呼叫 initRenderResult
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