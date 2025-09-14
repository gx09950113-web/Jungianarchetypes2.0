// docs/assets/js/app-basic.js
(function () {
  function normalizeButtons() {
    const submitBtn = document.querySelector('#submit, [data-role="submit"], button[type="submit"]');
    if (submitBtn) {
      try { submitBtn.type = 'button'; } catch(_) {}
    }
    const clearBtn = document.querySelector('#clear, [data-role="clear"]');
    if (clearBtn) {
      try { clearBtn.type = 'button'; } catch(_) {}
    }
  }

  function bindDelegatedActions() {
    // 送出：事件委派，避免 DOM 重繪後掉綁
    document.addEventListener('click', async (e) => {
      const submit = e.target.closest('#submit, [data-role="submit"]');
      if (!submit) return;

      try {
        submit.disabled = true;
        console.time('[basic submit]');

        // TODO：在這裡接回你的收集→計分→存檔
        // const answers = collectBasicAnswers();
        // const result  = computeBasic(answers);
        // const id = store.saveResult({ type:'basic', answers, result, ts: Date.now() });

        // 先用最低保真通路測試
        const id = (crypto.randomUUID?.() || Date.now()).toString();
        location.href = `result.html?id=${encodeURIComponent(id)}`;
      } catch (err) {
        console.error('[basic submit] failed:', err);
        submit.disabled = false;
      } finally {
        console.timeEnd('[basic submit]');
      }
    });

    // 清除：可選
    document.addEventListener('click', (e) => {
      const clear = e.target.closest('#clear, [data-role="clear"]');
      if (!clear) return;
      try {
        // TODO：在這裡清除暫存答案（若有）
        console.log('[basic] 清除暫存答案（示意）');
      } catch (err) {
        console.error('[basic clear] failed:', err);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    console.log('[basic] DOM ready');

    // 1) 呼叫渲染器：把題目畫出來
    if (typeof window.renderBasic === 'function') {
      try {
        await window.renderBasic();
      } catch (err) {
        console.error('[basic] renderBasic() error:', err);
      }
    } else {
      console.error('[basic] renderBasic 未定義：確認 basic.html 是否先載入 ./assets/js/ui/render-basic.js（且路徑/大小寫正確）');
    }

    // 2) 矯正按鈕型態，避免原生 submit 攔截
    normalizeButtons();

    // 3) 綁定事件（委派）
    bindDelegatedActions();

    // 4) 若你的渲染器會重繪整個 <main>，用觀察器再矯正一次
    const obs = new MutationObserver(() => normalizeButtons());
    obs.observe(document.documentElement, { childList: true, subtree: true });
  });
})();
