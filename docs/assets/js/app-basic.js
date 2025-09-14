// docs/assets/js/app-basic.js
// ✅ 使用 store.saveResult() 儲存到一致的命名空間，結果頁才能讀到
(function () {
  const DRAFT_KEY = 'jung_basic_draft_v1';

  function collectBasicAnswers() {
    // 先抓畫面上的選項；若無則回退到草稿
    const picked = {};
    document.querySelectorAll('#qList input[type="radio"]:checked')
      .forEach(r => (picked[r.name] = Number(r.value)));
    if (Object.keys(picked).length) return picked;
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
    catch { return {}; }
  }

  function normalizeButtons() {
    const submitBtn = document.querySelector('#submit, [data-role="submit"], button[type="submit"]');
    if (submitBtn) { try { submitBtn.type = 'button'; } catch(_) {} }
    const clearBtn  = document.querySelector('#clear, [data-role="clear"]');
    if (clearBtn)  { try { clearBtn.type  = 'button'; } catch(_) {} }
  }

  function bindDelegatedActions() {
    // 送出（委派，避免 DOM 重繪掉綁）
    document.addEventListener('click', async (e) => {
      const submit = e.target.closest('#submit, [data-role="submit"]');
      if (!submit) return;

      try {
        submit.disabled = true;
        console.time('[basic submit]');

        const answers = collectBasicAnswers();
        if (!answers || !Object.keys(answers).length) {
          // 沒作答也允許送出，但你也可以在這裡擋下來
          console.warn('[basic] 沒有找到作答，仍嘗試送出');
        }

        // ✅ 用 store API 存檔（讓結果頁能讀到）
        const saved = (window.Store && typeof window.Store.saveResult === 'function')
          ? window.Store.saveResult({ kind: 'basic', answers })
          : { id: String(crypto.randomUUID?.() || Date.now()), kind: 'basic', answers };

        // 清掉草稿（非必要）
        try { localStorage.removeItem(DRAFT_KEY); } catch {}

        location.assign(`result.html?id=${encodeURIComponent(saved.id)}`);
      } catch (err) {
        console.error('[basic submit] failed:', err);
        submit.disabled = false;
      } finally {
        console.timeEnd('[basic submit]');
      }
    });

    // 清除暫存草稿（非必要）
    document.addEventListener('click', (e) => {
      const clear = e.target.closest('#clear, [data-role="clear"]');
      if (!clear) return;
      try {
        localStorage.removeItem(DRAFT_KEY);
        document.querySelectorAll('#qList input[type="radio"]:checked')
          .forEach(r => (r.checked = false));
        console.log('[basic] 已清除暫存答案');
      } catch (err) {
        console.error('[basic clear] failed:', err);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    console.log('[basic] DOM ready');

    // 先渲染題目（basic.html 已先載入 ./ui/render-basic.js）
    if (typeof window.renderBasic === 'function') {
      try { await window.renderBasic(); }
      catch (err) { console.error('[basic] renderBasic() error:', err); }
    } else {
      console.error('[basic] renderBasic 未定義：請確認 ./assets/js/ui/render-basic.js 先於本檔載入');
    }

    normalizeButtons();
    bindDelegatedActions();

    // 若渲染器會重繪，持續校正按鈕型態
    const obs = new MutationObserver(() => normalizeButtons());
    obs.observe(document.documentElement, { childList: true, subtree: true });
  });
})();
