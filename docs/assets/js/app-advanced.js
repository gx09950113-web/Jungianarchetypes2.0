// docs/assets/js/app-advanced.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('[advanced] DOM ready');

  // 1) 確保送出鍵不是 submit
  const submitBtn = [...document.querySelectorAll('button,[role="button"]')]
    .find(b => /送出並查看結果/.test(b.textContent.trim()));
  if (submitBtn) submitBtn.type = 'button';

  // 2) 事件委派
  document.addEventListener('click', async (e) => {
    const target = e.target.closest('button,[role="button"]');
    if (!target) return;
    if (!/送出並查看結果/.test(target.textContent.trim())) return;

    try {
      target.disabled = true;
      console.time('[adv submit]');

      // TODO: 這裡放你的進階題組收集/計算/存檔
      // const set = new URLSearchParams(location.search).get('set') || 'A';
      // const answers = collectAdvancedAnswers(set);
      // const result  = computeAdvanced(set, answers);
      // const id = store.saveResult({ type: 'advanced', set, answers, result, ts: Date.now() });

      const id = (crypto.randomUUID?.() || Date.now()).toString();
      location.href = `result.html?id=${encodeURIComponent(id)}`;
    } catch (err) {
      console.error('[adv submit] failed:', err);
      target.disabled = false;
    } finally {
      console.timeEnd('[adv submit]');
    }
  });
});
