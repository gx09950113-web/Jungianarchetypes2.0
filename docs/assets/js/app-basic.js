// docs/assets/js/app-basic.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('[basic] DOM ready');

  // 1) 確保送出鍵不是 submit（避免原生驗證攔截事件）
  const submitBtn = [...document.querySelectorAll('button,[role="button"]')]
    .find(b => /送出並查看結果/.test(b.textContent.trim()));
  if (submitBtn) submitBtn.type = 'button';

  // 2) 綁事件委派（就算之後重繪 DOM 也不會掉）
  document.addEventListener('click', async (e) => {
    const target = e.target.closest('button,[role="button"]');
    if (!target) return;
    if (!/送出並查看結果/.test(target.textContent.trim())) return;

    try {
      target.disabled = true; // 防多次點擊
      console.time('[basic submit]');

      // TODO: 這裡放你的收集/計算/存檔邏輯
      // const answers = collectBasicAnswers();
      // const result  = computeBasic(answers);
      // const id = store.saveResult({ type: 'basic', answers, result, ts: Date.now() });

      // 先用最低保真通路測試
      const id = (crypto.randomUUID?.() || Date.now()).toString();

      location.href = `result.html?id=${encodeURIComponent(id)}`;
    } catch (err) {
      console.error('[basic submit] failed:', err);
      target.disabled = false;
    } finally {
      console.timeEnd('[basic submit]');
    }
  });
});
