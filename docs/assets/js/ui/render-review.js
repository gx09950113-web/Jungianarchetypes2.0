// /docs/assets/js/ui/render-review.js

import * as util from '../lib/util.js';
import * as store from '../lib/store.js';

/**
 * 在 #app（或給定 rootId）渲染歷次紀錄列表。
 * - Console 可直接執行：await initRenderReview()
 */
export async function initRenderReview(rootId = 'app') {
  // 容器就緒
  let root = document.getElementById(rootId);
  if (!root) {
    root = document.createElement('div');
    root.id = rootId;
    document.body.appendChild(root);
  }
  root.innerHTML = '';

  // 標題
  const title = document.createElement('h1');
  title.textContent = '歷次測驗紀錄';
  root.appendChild(title);

  // 工具列（搜尋 / 篩選 / 批次）
  const toolbar = document.createElement('div');
  toolbar.style.display = 'grid';
  toolbar.style.gridTemplateColumns = '1fr auto auto auto';
  toolbar.style.gap = '8px';
  toolbar.style.alignItems = 'center';
  toolbar.style.margin = '12px 0';

  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = '搜尋：id / kind / set';
  search.style.padding = '8px 10px';
  search.style.border = '1px solid var(--line, #ddd)';
  search.style.borderRadius = '8px';

  const filter = document.createElement('select');
  filter.style.padding = '8px 10px';
  filter.style.border = '1px solid var(--line, #ddd)';
  filter.style.borderRadius = '8px';
  ['全部', 'basic', 'advanced', 'A', 'B', 'C'].forEach((v) => {
    const o = document.createElement('option');
    o.value = v.toLowerCase();
    o.textContent = v;
    filter.appendChild(o);
  });

  const btnExportAll = document.createElement('button');
  btnExportAll.textContent = '匯出全部 JSON';
  stylePrimary(btnExportAll);

  const btnDeleteSelected = document.createElement('button');
  btnDeleteSelected.textContent = '刪除已勾選';
  styleOutline(btnDeleteSelected);

  toolbar.appendChild(search);
  toolbar.appendChild(filter);
  toolbar.appendChild(btnExportAll);
  toolbar.appendChild(btnDeleteSelected);
  root.appendChild(toolbar);

  // 表格
  const tableWrap = document.createElement('div');
  tableWrap.style.border = '1px solid var(--line, #ddd)';
  tableWrap.style.borderRadius = '10px';
  tableWrap.style.overflow = 'hidden';
  root.appendChild(tableWrap);

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  tableWrap.appendChild(table);

  // thead
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th style="text-align:left;padding:10px 12px;width:36px;"><input type="checkbox" id="chk-all"/></th>
      <th style="text-align:left;padding:10px 12px;">ID</th>
      <th style="text-align:left;padding:10px 12px;">類型</th>
      <th style="text-align:left;padding:10px 12px;">題組</th>
      <th style="text-align:left;padding:10px 12px;">題數</th>
      <th style="text-align:left;padding:10px 12px;">建立時間</th>
      <th style="text-align:right;padding:10px 12px;">操作</th>
    </tr>
  `;
  table.appendChild(thead);

  // tbody
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  // 資料載入與渲染
  let rows = loadRows(); // 原始資料（已依時間新→舊）
  render();

  // 綁定事件
  search.addEventListener('input', render);
  filter.addEventListener('change', render);
  btnExportAll.addEventListener('click', onExportAll);
  btnDeleteSelected.addEventListener('click', onDeleteSelected);

  const chkAll = thead.querySelector('#chk-all');
  chkAll.addEventListener('change', () => {
    tbody.querySelectorAll('input[type="checkbox"][data-id]').forEach((cb) => {
      cb.checked = chkAll.checked;
    });
  });

  /* ========== 內部函式 ========== */

  function loadRows() {
    const list = store.listResults?.() || [];
    // 期望每筆：{ id, kind, set?, createdAt, items?, answers? ... }
    return list
      .map((s) => ({
        id: s.id,
        kind: s.kind || '',
        set: s.set || '',
        count: Array.isArray(s.answers) ? s.answers.length : (s.meta?.total || s.items?.length || 0),
        createdAt: s.createdAt || '',
      }))
      .sort((a, b) => {
        const ta = Date.parse(a.createdAt || '') || 0;
        const tb = Date.parse(b.createdAt || '') || 0;
        return tb - ta; // 新→舊
      });
  }

  function render() {
    const q = (search.value || '').trim().toLowerCase();
    const f = filter.value; // '全部' -> '全部'.toLowerCase() 在上面已處理
    const filtered = rows.filter((r) => {
      const hay = `${r.id} ${r.kind} ${r.set}`.toLowerCase();
      const passQ = q ? hay.includes(q) : true;

      let passF = true;
      if (f && f !== '全部'.toLowerCase()) {
        if (['a', 'b', 'c'].includes(f)) {
          passF = String(r.set || '').toLowerCase() === f;
        } else {
          passF = String(r.kind || '').toLowerCase() === f;
        }
      }
      return passQ && passF;
    });

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.style.padding = '14px';
      td.style.opacity = '.7';
      td.textContent = '目前沒有符合條件的紀錄。';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    filtered.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.style.borderTop = '1px solid var(--line, #eee)';

      // 多選
      const tdChk = document.createElement('td');
      tdChk.style.padding = '8px 12px';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.id = r.id;
      tdChk.appendChild(cb);

      // ID
      const tdId = document.createElement('td');
      tdId.style.padding = '8px 12px';
      tdId.innerHTML = `<code>${escapeHTML(r.id)}</code>`;

      // kind
      const tdKind = document.createElement('td');
      tdKind.style.padding = '8px 12px';
      tdKind.textContent = r.kind || '';

      // set
      const tdSet = document.createElement('td');
      tdSet.style.padding = '8px 12px';
      tdSet.textContent = r.set || '-';

      // 題數
      const tdCount = document.createElement('td');
      tdCount.style.padding = '8px 12px';
      tdCount.textContent = r.count || 0;

      // 時間
      const tdTime = document.createElement('td');
      tdTime.style.padding = '8px 12px';
      tdTime.textContent = prettyTime(r.createdAt);

      // 操作
      const tdOps = document.createElement('td');
      tdOps.style.padding = '8px 12px';
      tdOps.style.textAlign = 'right';

      const btnView = document.createElement('a');
      btnView.href = `result.html?id=${encodeURIComponent(r.id)}`;
      btnView.textContent = '查看';
      styleLink(btnView);

      const btnDel = document.createElement('button');
      btnDel.textContent = '刪除';
      styleDanger(btnDel);
      btnDel.style.marginLeft = '8px';
      btnDel.addEventListener('click', () => onDeleteOne(r.id));

      tdOps.appendChild(btnView);
      tdOps.appendChild(btnDel);

      tr.appendChild(tdChk);
      tr.appendChild(tdId);
      tr.appendChild(tdKind);
      tr.appendChild(tdSet);
      tr.appendChild(tdCount);
      tr.appendChild(tdTime);
      tr.appendChild(tdOps);

      tbody.appendChild(tr);
    });
  }

  function onDeleteOne(id) {
    if (!confirm(`確定刪除：${id}？此動作無法復原。`)) return;
    try {
      store.remove?.(id);
      rows = loadRows();
      render();
    } catch (err) {
      alert('刪除失敗，請稍後再試。');
      console.error(err);
    }
  }

  function onDeleteSelected() {
    const ids = Array.from(tbody.querySelectorAll('input[type="checkbox"][data-id]:checked'))
      .map((cb) => cb.dataset.id);
    if (ids.length === 0) {
      alert('請先勾選要刪除的紀錄。');
      return;
    }
    if (!confirm(`將刪除 ${ids.length} 筆紀錄，無法復原，是否繼續？`)) return;

    let ok = 0;
    ids.forEach((id) => {
      try {
        store.remove?.(id);
        ok++;
      } catch (e) {
        console.error('[remove failed]', id, e);
      }
    });
    rows = loadRows();
    render();
    alert(`完成刪除：${ok} / ${ids.length}`);
  }

  function onExportAll() {
    const list = store.listResults?.() || [];
    if (list.length === 0) {
      alert('沒有可匯出的紀錄。');
      return;
    }
    const payload = {
      exportedAt: util.nowISO?.() || new Date().toISOString(),
      total: list.length,
      sessions: list,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jungian_sessions_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ========== 小工具 ========== */

  function prettyTime(s) {
    if (!s) return '-';
    // 若 util 有自帶格式化就用；否則簡單顯示原字串
    return s.replace('T', ' ').replace('Z', '');
  }

  function escapeHTML(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function stylePrimary(btn) {
    btn.style.padding = '8px 12px';
    btn.style.border = 'none';
    btn.style.borderRadius = '8px';
    btn.style.background = 'var(--accent, #4caf50)';
    btn.style.color = '#fff';
    btn.style.fontWeight = '600';
    btn.style.cursor = 'pointer';
  }
  function styleOutline(btn) {
    btn.style.padding = '8px 12px';
    btn.style.border = '1px solid var(--line, #ddd)';
    btn.style.borderRadius = '8px';
    btn.style.background = 'transparent';
    btn.style.cursor = 'pointer';
  }
  function styleDanger(btn) {
    btn.style.padding = '6px 10px';
    btn.style.border = '1px solid rgba(220, 0, 0, .2)';
    btn.style.borderRadius = '8px';
    btn.style.background = 'rgba(220, 0, 0, .08)';
    btn.style.color = '#b00000';
    btn.style.cursor = 'pointer';
  }
  function styleLink(a) {
    a.style.display = 'inline-block';
    a.style.textDecoration = 'none';
    a.style.fontWeight = '600';
    a.style.border = '1px solid var(--line, #ddd)';
    a.style.borderRadius = '8px';
    a.style.padding = '6px 10px';
  }
}

/* ========== 自動初始化：僅在 review.html ========== */
if (typeof window !== 'undefined') {
  const boot = () => {
    if (location.pathname.endsWith('review.html')) {
      initRenderReview().catch(console.error);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}