// docs/assets/js/app-basic.js
(function () {
  // ====== 常數與工具（放外層）======
  const DB_KEY    = 'jung_records_v1';      // 結果記錄庫
  const DRAFT_KEY = 'jung_basic_draft_v1';  // basic 草稿（render-basic 用）

  function collectBasicAnswers() {
    // 先抓畫面上的選項；若無則回退到草稿
    const picked = {};
    document.querySelectorAll('#qList input[type="radio"]:checked')
      .forEach(r => picked[r.name] = Number(r.value));
    if (Object.keys(picked).length) return picked;
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveRecord(rec) {
    const db = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
    db[rec.id] = rec;
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function normalizeButtons() {
    const submitBtn = document.querySelector('#submit, [data-role="submit"], button[type="submit"]');
    if (submitBtn) { try { submitBtn.type = 'button'; } catch(_) {} }
    const clearBtn  = document.querySelector('#clear, [data-role="clear"]');
    if (clearBtn) { try { clearBtn.type = 'button'; } catch(_) {} }
  }

  function bindDelegatedActions() {
    // 送出：事件委派，避免 DOM 重繪後掉綁
    document.addEventListener('click', async (e) => {
      const submit = e.target.closest('#submit, [data-role="submit"]');
      if (!submit) return;

      try {
        submit.disabled = true;
        console.time('[basic submit]');

        // 收集 → 存檔 → 轉跳
        const answers = collectBasicAnswers();
        const id = (crypto.randomUUID?.() || Date.now()).toString();
        const rec = {
          id,
          type: 'basic',
          version: 1,
          ts: Date.now(),
          answers // { qid: 1..5 }
        };
        saveRecord(rec);
        // 檢查一下確實寫入（除錯可留，穩定後可移除）
        // console.log('[saved]', id, JSON.parse(localStorage.getItem(DB_KEY) || '{}')[id]);

        location.href = `result.html?id=${encodeURIComponent(id)}`;
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

    // 1) 渲染題目
    if (typeof window.renderBasic === 'function') {
      try { await window.renderBasic(); }
      catch (err) { console.error('[basic] renderBasic() error:', err); }
    } else {
      console.error('[basic] renderBasic 未定義：請確認 ./assets/js/ui/render-basic.js 先於本檔載入，且路徑/大小寫正確');
    }

    // 2) 修正按鈕型態
    normalizeButtons();

    // 3) 綁事件（委派）
    bindDelegatedActions();

    // 4) 若渲染器會重繪，持續校正按鈕型態
    const obs = new MutationObserver(() => normalizeButtons());
    obs.observe(document.documentElement, { childList: true, subtree: true });
  });
})();
