// /docs/assets/js/app-basic.js
import { initRenderBasic } from './ui/render-basic.js';

let __booted = false;
function showError(err) { console.error('[app-basic] init failed:', err); } // 不插入黑框

async function main() {
  if (__booted) return; __booted = true;
  try { await initRenderBasic('app'); } catch (err) { showError(err); }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else { main(); }