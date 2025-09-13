// /docs/assets/js/ui/render-advanced.js

import * as util from '../lib/util.js';
import * as loader from '../lib/loader.js';
import * as router from '../lib/router.js';
import * as store from '../lib/store.js';

/**
 * 進階題組渲染器
 * - 透過 query 讀取 set=A|B|C（容忍 ?set=a / ?a 等）
 * - 可以在 console 執行：await initRenderAdvanced()
 */
export async function initRenderAdvanced(rootId = 'app') {
  // 容器
  let root = document.getElementById(rootId);
  if (!root) {
    root = document.createElement('div');
    root.id = rootId;
    document.body.appendChild(root);
  }
  root.innerHTML = '';

  // 解析 set
  const q = router.getQuery?.() ?? {};
  const setFromQuery = normalizeSet(q.set ?? (q.a ? 'A' : q.b ? 'B' : q.c ? 'C' : undefined));

  // 如果沒有傳 set，提供一個簡單的選擇器
  if (!setFromQuery) {
    renderSetPicker(root);
    return;
  }

  // 標題
  const title = document.createElement('h1');
  title.textContent = `進階題組（${setFromQuery}）`;
  root.appendChild(title);

  // 載入題庫
  let items;
  try {
    items = await loader.loadItemsAdv(setFromQuery);
  } catch (err) {
    console.error(err);
    items = null;
  }
  if (!Array.isArray(items) || items.length === 0) {
    const p = document.createElement('p');
    p.textContent = `找不到進階 ${setFromQuery} 題庫資料。`;
    root.appendChild(p);
    return;
  }

  // 定義取欄位的方法：僅顯示 A/B 句子，避免露出主輔排序資訊
  const pickTextA = (it) =>
    it.A ?? it.a ?? it.optionA ?? it.textA ?? it.left ?? it.l ?? it.statementA ?? '';
  const pickTextB = (it) =>
    it.B ?? it.b ?? it.optionB ?? it.textB ?? it.right ?? it.r ?? it.statementB ?? '';
  const pickId = (it, i) => it.id ?? it._id ?? it.key ?? `q${i + 1}`;

  // 保留原始順序 id（尚未洗牌）
  const originalOrder = items.map((it, i) => pickId(it, i));

  // 洗牌副本
  items = util.shuffle(items.slice());

  // 說明
  const hint = document.createElement('p');
  hint.innerHTML = `
    本頁為進階題組 <strong>${setFromQuery}</strong>：請在每題 A 與 B 之間做傾向評分。<br/>
    將不顯示任何「主／輔功能排序」或功能名稱。
  `;
  root.appendChild(hint);

  // 進度列
  const progressWrap = document.createElement('div');
  progressWrap.style.margin = '12px 0';
  const progressText = document.createElement('div');
  progressText.textContent = `0 / ${items.length}`;
  const progressBar = document.createElement('div');
  progressBar.style.height = '8px';
  progressBar.style.background = 'var(--bg-muted, #eee)';
  progressBar.style.borderRadius = '999px';
  progressBar.style.overflow = 'hidden';
  const progressInner = document.createElement('div');
  progressInner.style.height = '100%';
  progressInner.style.width = '0%';
  progressInner.style.background = 'var(--accent, #4caf50)';
  progressBar.appendChild(progressInner);
  progressWrap.appendChild(progressText);
  progressWrap.appendChild(progressBar);
  root.appendChild(progressWrap);

  // 表單
  const form = document.createElement('form');
  form.autocomplete = 'off';
  form.noValidate = true;
  root.appendChild(form);

  // Likert 選項（-2..2）
  const SCALE = [
    { label: '非常同意A', value: -2 },
    { label: '較同意A', value: -1 },
    { label: '中立', value: 0 },
    { label: '較同意B', value: 1 },
    { label: '非常同意B', value: 2 },
  ];

  // 作答暫存
  const answerMap = new Map(); // name -> value

  // 題目區塊
  items.forEach((it, idx) => {
    const qId = pickId(it, idx);
    const textA = String(pickTextA(it) ?? '').trim();
    const textB = String(pickTextB(it) ?? '').trim();

    const block = document.createElement('section');
    block.className = 'q-block';
    block.style.border = '1px solid var(--line, #ddd)';
    block.style.borderRadius = '8px';
    block.style.padding = '12px';
    block.style.margin = '12px 0';

    // 題號
    const head = document.createElement('div');
    head.className = 'q-head';
    head.style.fontWeight = '600';
    head.style.marginBottom = '8px';
    head.textContent = `第 ${idx + 1} 題`;
    block.appendChild(head);

    // AB 顯示（無任何主/輔提示）
    const abRow = document.createElement('div');
    abRow.className = 'q-ab-row';
    abRow.style.display = 'grid';
    abRow.style.gridTemplateColumns = '1fr 1fr';
    abRow.style.gap = '12px';

    const aBox = document.createElement('div');
    aBox.className = 'q-a';
    aBox.innerHTML = `<div style="font-size:12px;opacity:.75;">A</div><div>${escapeHTML(textA)}</div>`;
    aBox.style.border = '1px dashed var(--line, #ddd)';
    aBox.style.borderRadius = '6px';
    aBox.style.padding = '8px';

    const bBox = document.createElement('div');
    bBox.className = 'q-b';
    bBox.innerHTML = `<div style="font-size:12px;opacity:.75;">B</div><div>${escapeHTML(textB)}</div>`;
    bBox.style.border = '1px dashed var(--line, #ddd)';
    bBox.style.borderRadius = '6px';
    bBox.style.padding = '8px';

    abRow.appendChild(aBox);
    abRow.appendChild(bBox);
    block.appendChild(abRow);

    // Likert 列
    const scaleRow = document.createElement('div');
    scaleRow.className = 'q-scale';
    scaleRow.style.display = 'grid';
    scaleRow.style.gridTemplateColumns = `repeat(${SCALE.length}, 1fr)`;
    scaleRow.style.gap = '8px';
    scaleRow.style.marginTop = '10px';

    const groupName = `q_${qId}`;

    SCALE.forEach((opt) => {
      const cell = document.createElement('label');
      cell.className = 'scale-cell';
      cell.style.display = 'flex';
      cell.style.flexDirection = 'column';
      cell.style.alignItems = 'center';
      cell.style.gap = '4px';
      cell.style.padding = '8px';
      cell.style.border = '1px solid var(--line, #ddd)';
      cell.style.borderRadius = '6px';
      cell.style.cursor = 'pointer';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = groupName;
      radio.value = String(opt.value);

      radio.addEventListener('change', () => {
        answerMap.set(groupName, Number(radio.value));
        updateProgress();
      });

      const small = document.createElement('small');
      small.textContent = opt.label;

      cell.appendChild(radio);
      cell.appendChild(small);
      scaleRow.appendChild(cell);
    });

    block.appendChild(scaleRow);
    form.appendChild(block);
  });

  // 操作列
  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '12px';
  actions.style.margin = '16px 0';

  const btnSubmit = document.createElement('button');
  btnSubmit.type = 'submit';
  btnSubmit.textContent = '送出並查看結果';
  btnSubmit.style.padding = '10px 14px';
  btnSubmit.style.borderRadius = '8px';
  btnSubmit.style.border = 'none';
  btnSubmit.style.background = 'var(--accent, #4caf50)';
  btnSubmit.style.color = '#fff';
  btnSubmit.style.fontWeight = '600';

  const btnReset = document.createElement('button');
  btnReset.type = 'button';
  btnReset.textContent = '清除未送出作答';
  btnReset.style.padding = '10px 14px';
  btnReset.style.borderRadius = '8px';
  btnReset.style.border = '1px solid var(--line, #ddd)';
  btnReset.addEventListener('click', () => {
    form.reset();
    answerMap.clear();
    updateProgress();
  });

  actions.appendChild(btnSubmit);
  actions.appendChild(btnReset);
  root.appendChild(actions);

  // 提交處理
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const total = items.length;
    const names = items.map((it, idx) => `q_${pickId(it, idx)}`);
    const missing = names.filter((n) => !answerMap.has(n));
    if (missing.length > 0) {
      alert(`尚有 ${missing.length} 題未作答，請完成所有題目。`);
      return;
    }

    const answers = [];
    const orderCurrent = [];
    items.forEach((it, idx) => {
      const id = pickId(it, idx);
      const name = `q_${id}`;
      const val = Number(answerMap.get(name));
      answers.push(val);
      orderCurrent.push(id);
    });

    const session = {
      id: util.uuid(),
      kind: 'advanced',
      set: setFromQuery, // A/B/C
      createdAt: util.nowISO(),
      version: 1,
      meta: {
        total,
        scale: 'A/B 5-point (-2..2)',
      },
      originalOrder,
      order: orderCurrent,
      items: items.map((it, idx) => ({
        id: pickId(it, idx),
        A: String(pickTextA(it) ?? ''),
        B: String(pickTextB(it) ?? ''),
      })),
      answers,
    };

    store.saveResult(session);
    location.href = `result.html?id=${encodeURIComponent(session.id)}`;
  });

  // 初始進度
  updateProgress();

  // ====== 區域工具 ======
  function updateProgress() {
    const answered = answerMap.size;
    const total = items.length;
    progressText.textContent = `${answered} / ${total}`;
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
    progressInner.style.width = `${pct}%`;
  }

  function escapeHTML(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function normalizeSet(s) {
    if (!s) return null;
    const t = String(s).trim().toUpperCase();
    if (t === 'A' || t === 'B' || t === 'C') return t;
    return null;
  }

  function renderSetPicker(rootEl) {
    const h = document.createElement('h1');
    h.textContent = '選擇進階題組';
    rootEl.appendChild(h);

    const p = document.createElement('p');
    p.innerHTML = `請選擇欲作答之題組（也可在網址列帶 <code>?set=A|B|C</code> 或 <code>?a</code>/<code>?b</code>/<code>?c</code>）。`;
    rootEl.appendChild(p);

    const box = document.createElement('div');
    box.style.display = 'flex';
    box.style.gap = '12px';
    box.style.margin = '12px 0';

    ['A', 'B', 'C'].forEach((s) => {
      const btn = document.createElement('a');
      btn.textContent = `進階 ${s}`;
      btn.href = setQueryParam('set', s);
      btn.style.display = 'inline-block';
      btn.style.padding = '10px 14px';
      btn.style.borderRadius = '8px';
      btn.style.border = '1px solid var(--line, #ddd)';
      btn.style.textDecoration = 'none';
      btn.style.fontWeight = '600';
      box.appendChild(btn);
    });

    rootEl.appendChild(box);
  }

  function setQueryParam(key, value) {
    const url = new URL(location.href);
    url.searchParams.set(key, value);
    return url.toString();
  }
}

// 自動初始化：僅在 advanced.html
if (typeof window !== 'undefined') {
  const boot = () => {
    if (location.pathname.endsWith('advanced.html')) {
      initRenderAdvanced().catch(console.error);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}