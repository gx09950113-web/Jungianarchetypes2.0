// docs/assets/js/app-advanced.js
// ✅ 作為 ES module，直接呼叫渲染器；送出邏輯在 render-advanced.js 內
import { initRenderAdvanced } from './ui/render-advanced.js';

function getSetFromQuery() {
  const q = new URLSearchParams(location.search);
  const v = (q.get('set') || 'A').toUpperCase();
  return /^(A|B|C)$/.test(v) ? v : 'A';
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[advanced] DOM ready');
  const set = getSetFromQuery();
  try {
    await initRenderAdvanced('app', set);
    console.log('[advanced] initRenderAdvanced(%s) done', set);
  } catch (err) {
    console.error('[advanced] init failed:', err);
  }
});
