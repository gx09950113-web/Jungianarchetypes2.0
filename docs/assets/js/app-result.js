// /docs/assets/js/app-result.js
import { initRenderResult } from './ui/render-result.js';
import { getQuery } from './lib/router.js';
import * as store from './lib/store.js';

let __booted = false;
function showError(err) { console.error('[app-result] init failed:', err); } // 不插入黑框

async function main() {
  if (__booted) return; __booted = true;

  const q = getQuery();
  let id = q.id;
  if (!id) {
    const list = store.listResults();
    if (Array.isArray(list) && list.length > 0) id = list[0].id;
  }
  if (!id) return showError(new Error('缺少 id，且在本機找不到歷史紀錄。'));

  try {
    await initRenderResult('app');
    console.debug('[result] ready, id =', id);
  } catch (err) { showError(err); }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else { main(); }