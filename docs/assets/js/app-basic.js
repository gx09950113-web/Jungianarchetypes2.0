// app-basic.js — 保留渲染 + 穩定送出

(function () {
  // 安全呼叫全域渲染器（若不存在就不報錯）
  async function safeRenderBasic() {
    try {
      if (typeof window.renderBasic === 'function') {
        await window.renderBasic(); // 你的舊版就是靠這個把題目畫出來
        console.log('[basic] renderBasic() done');
      } else {
        console.warn('[basic] window.renderBasic 未定義（檢查 ui/render-basic.js 是否正確載入）');
      }
    } catch (err) {
      console.error('[basic] renderBasic() error:', err);
    }
  }

  // 確保送出鍵是 button，避免原生 submit 攔截
  function normalizeSubmitButton(root = document) {
    const btn = [...root.querySelectorAll('button,[role="button"]')]
      .find(b => /送出並查看結果/.test(b.textContent.trim()));
    if (btn) {
      try {
        btn.type = 'button';
      } catch(_) {}
    }
  }

  // 事件委派（不怕 DOM 重繪）
  function bindDelegatedSubmit() {
    document.addEventListener('click', async (e) => {
      const target = e.target.closest('button,[role="button"]');
      if (!target) return;
      if (!/送出並查看結果/.test(target.textContent.trim())) return;

      try {
        target.disabled = true; // 防重複點
        console.time('[basic submit]');

        // TODO: 在這裡塞你原本的收集/計分/存檔邏輯
        // const answers = collectBasicAnswers();
        // const result  = computeBasic(answers);
        // const id = store.saveResult({ type:'basic', answers, result, ts: Date.now() });

        // 先通路測試用假 id
        const id = (crypto.randomUUID?.() || Date.now()).toString();
        location.href = `result.html?id=${encodeURIComponent(id)}`;
      } catch (err) {
        console.error('[basic submit] failed:', err);
        target.disabled = false;
      } finally {
        console.timeEnd('[basic submit]');
      }
    }, { capture: false });
  }

  // 觀察 DOM 重繪（有些渲染器會整塊替換主容器）
  function installObserver() {
    const obs = new MutationObserver(() => normalizeSubmitButton());
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    console.log('[basic] DOM ready');
    bindDelegatedSubmit();
    installObserver();
    await safeRenderBasic();       // 關鍵：把題目渲染出來
    normalizeSubmitButton();       // 渲染完再把按鈕型態校正一次
  });
})();
