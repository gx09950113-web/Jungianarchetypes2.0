// /docs/assets/js/app-basic.js
import { initRenderBasic } from './ui/render-basic.js';

let __booted = false;

async function main() {
  if (__booted) return;
  __booted = true;
  try {
    await initRenderBasic('app');
  } catch (err) {
    console.error('[app-basic] init failed:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
