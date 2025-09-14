// docs/assets/js/app-advanced.js
// ✅ 不使用 import；直接呼叫全域的 window.renderAdvanced(set)
// ✅ 與 basic 一樣：提交時用 Store.saveResult()，結果頁用 Store.loadResult(id) 讀回

(function () {
  'use strict';

  function getSetFromQuery() {
    const q = new URLSearchParams(location.search);
    const v = (q.get('set') || 'A').toUpperCase();
    return /^(A|B|C)$/.test(v) ? v : 'A';
  }

  function draftKeyFor(set) {
    return `jung_adv_${set}_draft_v1`;
  }

  function collectAdvancedAnswers(set) {
    // 先抓畫面上的作答；若沒有，回退到該組別的草稿
    const picked = {};
    document.querySelectorAll('#qList input[type="radio"]:checked')
      .forEach(r => (picked[r.name] = Number(r.value)));
    if (Object.keys(picked).length) return picked;

    try {
      return JSON.parse(localStorage.getItem(draftKeyFor(set)) || '{}');
    } catch {
      return {};
    }
  }

  function normalizeButtons() {
    const submitBtn = document.querySelector('#submit, [data-role="submit"], button[type="submit"]');
    if (submitBtn) { try { submitBtn.type = 'button'; } catch(_) {} }
    const clearBtn  = document.querySelector('#clear, [data-role="clear"]');
    if (clearBtn)  { try { clearBtn.type  = 'button'; } catch(_) {} }
  }

  function bindDelegatedActions(set) {
    // 提交
    document.addEventListener('click', (e) => {
      const submit = e.target.closest('#submit, [data-role="submit"]');
      if (!submit) return;

      (async () => {
        try {
          submit.disabled = true;
          console.time('[advanced submit]');

          const answers = collectAdvancedAnswers(set);
          if (!answers || !Object.keys(answers).length) {
            // 依你的策略：沒作答仍可送出；若要強制，改成 return
            console.warn('[advanced] 沒有找到作答，仍嘗試送出');
          }

          if (!(window.Store && typeof window.Store.saveResult === 'function')) {
            throw new Error('Store.saveResult 不存在：請確認已載入 ./assets/js/lib/store.js');
          }

          // 與結果頁對齊：標註 type:'advanced' + set
          const saved = window.Store.saveResult({
            id: undefined,            // 讓 Store 產生 uuid
            kind: 'adv',              // 你的 store 註解支援 'basic' | 'adv'
            type: 'advanced',         // 結果頁會依此載入 weights_adv_*.json
            set,                      // A|B|C
            answers,                  // 原始作答；結果頁會用權重重新計算
          });

          // 清掉草稿（該題組）
          try { localStorage.removeItem(draftKeyFor(set)); } catch {}

          // 跳轉結果頁（render-result.js 用 Store.loadResult(id) 取回）
          location.assign(`result.html?id=${encodeURIComponent(saved.id)}&set=${encodeURIComponent(set)}`);
        } catch (err) {
          console.error('[advanced submit] failed:', err);
          submit.disabled = false;
        } finally {
          console.timeEnd('[advanced submit]');
        }
      })();
    });

    // 清草稿
    document.addEventListener('click', (e) => {
      const clear = e.target.closest('#clear, [data-role="clear"]');
      if (!clear) return;
      try {
        localStorage.removeItem(draftKeyFor(set));
        document.querySelectorAll('#qList input[type="radio"]:checked')
          .forEach(r => (r.checked = false));
        console.log(`[advanced ${set}] 已清除暫存答案`);
      } catch (err) {
        console.error('[advanced clear] failed:', err);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    console.log('[advanced] DOM ready');
    const set = getSetFromQuery();

    // 先渲染進階題組（新版 render-advanced.js 會掛在 window.renderAdvanced）
    if (typeof window.renderAdvanced === 'function') {
      try { await window.renderAdvanced(set); }
      catch (err) { console.error('[advanced] renderAdvanced() error:', err); }
    } else {
      console.error('[advanced] renderAdvanced 未定義：請確認 ./assets/js/ui/render-advanced.js 先於本檔載入');
    }

    normalizeButtons();
    bindDelegatedActions(set);

    // 若渲染器重繪節點，持續校正按鈕型態
    const obs = new MutationObserver(() => normalizeButtons());
    obs.observe(document.documentElement, { childList: true, subtree: true });
  });
})();