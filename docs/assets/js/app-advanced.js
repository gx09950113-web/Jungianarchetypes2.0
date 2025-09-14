// app-advanced.js — 保留渲染 + 穩定送出

(function () {
  function getSetFromQuery() {
    const q = new URLSearchParams(location.search);
    const v = (q.get('set') || 'A').toUpperCase();
    return /^(A|B|C)$/.test(v) ? v : 'A';
  }

  async function safeRenderAdvanced() {
    const set = getSetFromQuery();
    try {
      if (typeof window.renderAdvanced === 'function') {
        await window.renderAdvanced(set); // 你的舊版靠這個畫題目
        console.log('[advanced] renderAdvanced(%s) done', set);
      } else {
        console.warn('[advanced] window.renderAdvanced 未定義（檢查 ui/render-advanced.js 是否正確載入）');
      }
    } catch (err) {
      console.error('[advanced] renderAdvanced() error:', err);
    }
  }

  function normalizeSubmitButton(root = document) {
    const btn = [...root.querySelectorAll('button,[role="button"]')]
      .find(b => /送出並查看結果/.test(b.textContent.trim()));
    if (btn) {
      try {
        btn.type = 'button';
      } catch(_) {}
    }
  }

  function bindDelegatedSubmit() {
    document.addEventListener('click', async (e) => {
      const target = e.target.closest('button,[role="button"]');
      if (!target) return;
      if (!/送出並查看結果/.test(target.textContent.trim())) return;

      try {
        target.disabled = true;
        console.time('[advanced submit]');

        // TODO: 在這裡塞進階題組的收集/計分/存檔
        // const set = getSetFromQuery();
        // const answers = collectAdvancedAnswers(set);
        // const result  = computeAdvanced(set, answers);
        // const id = store.saveResult({ type:'advanced', set, answers, result, ts: Date.now() });

        const id = (crypto.randomUUID?.() || Date.now()).toString();
        location.href = `result.html?id=${encodeURIComponent(id)}`;
      } catch (err) {
        console.error('[advanced submit] failed:', err);
        target.disabled = false;
      } finally {
        console.timeEnd('[advanced submit]');
      }
    }, { capture: false });
  }

  function installObserver() {
    const obs = new MutationObserver(() => normalizeSubmitButton());
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    console.log('[advanced] DOM ready');
    bindDelegatedSubmit();
    installObserver();
    await safeRenderAdvanced();  // 關鍵：把題目渲染出來
    normalizeSubmitButton();
  });
})();
