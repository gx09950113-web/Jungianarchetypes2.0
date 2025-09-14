// /docs/assets/js/app-result.js
import { initRenderResult } from './ui/render-result.js';
import { getQuery, setQuery } from './lib/router.js';
import * as store from './lib/store.js';

let __booted = false;

async function main() {
  if (__booted) return;
  __booted = true;

  try {
    // 1) 先從 URL 取 id；沒有就抓「最近一筆」的歷史
    const q = getQuery();
    let id = q.id;

    if (!id) {
      const list = store.listResults(); // 依 updatedAt DESC 已排序（最近在前）
      // ↑ store.js 公開 API：listResults() / loadResult() / saveResult()。 [oai_citation:1‡store.js](file-service://file-UabqtFhAtJUkxccwzf5aff)
      if (Array.isArray(list) && list.length > 0) {
        id = list[0].id;
        // 2) 同步回 URL，方便 deep-link 與重新整理
        try { setQuery({ id }, { replace: true }); } catch {}
        // ↑ router.js 提供 getQuery()/setQuery()；setQuery 預設 replaceState。 [oai_citation:2‡router.js](file-service://file-1sRYDfYYTrwTcibnDGXQqN)
      }
    }

    // 3) 如果還是沒有 id，就顯示提示訊息（不報錯、不跳視窗）
    if (!id) {
      const mount = document.getElementById('app') || document.body;
      mount.innerHTML = `
        <section style="border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:16px;background:var(--card,#fff)">
          尚無可顯示的結果。請先在「基礎」或「進階」頁完成一次測驗，再回來查看分析。
        </section>`;
      console.warn('[app-result] missing id and no local history; skipped rendering.');
      return;
    }

    // 4) 明確把 id 傳給渲染器（新版 render-result.js 也會再從 URL/opts 取 id）
    await initRenderResult('app', { id });
    console.debug('[result] ready, id =', id);

    // 備註：
    // - funcs.json 與 types.json 會在 render-result.js 內透過 loader.js 自動載入，
    //   不需在此層處理（loadMappingFuncs / loadMappingTypes）。 [oai_citation:3‡loader.js](file-service://file-JEqhRtd3tEra6ECLe6wYjN)
    // - 若想改成先行計算（例如用 compute.js 統一產出 mbti/八維/四向度），
    //   也能在這層先把 rec 讀出來（store.loadResult(id)），再交給渲染器。 [oai_citation:4‡compute.js](file-service://file-6jCx3m6efp6Rt9WM9aqNHG)  [oai_citation:5‡store.js](file-service://file-UabqtFhAtJUkxccwzf5aff)
  } catch (err) {
    console.error('[app-result] init failed:', err);
    const mount = document.getElementById('app') || document.body;
    mount.innerHTML = `
      <section style="border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:16px;background:var(--card,#fff)">
        結果頁初始化失敗：${err?.message || err}
      </section>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}