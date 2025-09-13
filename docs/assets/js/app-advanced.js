// /docs/assets/js/app-advanced.js
import { initRenderAdvanced } from './ui/render-advanced.js';
import { getQuery } from './lib/router.js';

let __booted = false;
function showError(err) { console.error('[app-advanced] init failed:', err); } // 不插入黑框

async function main() {
  if (__booted) return; __booted = true;
  const q = getQuery();
  const set = String(q.set || q.group || q.a || 'A').toUpperCase();
  try {
    await initRenderAdvanced('app', set);   // ★ 把 set 傳進去
    console.debug('[advanced] ready, set =', set);
  } catch (err) { showError(err); }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else { main(); }