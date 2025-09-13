// /docs/assets/js/app-review.js
// 入口：review.html 專用
import { initRenderReview } from './ui/render-review.js';

let __booted = false;

async function main() {
  if (__booted) return;
  __booted = true;
  try {
    await initRenderReview('app');
  } catch (err) {
    console.error('[app-review] init failed:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
