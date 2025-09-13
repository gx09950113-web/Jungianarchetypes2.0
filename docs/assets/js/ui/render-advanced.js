// /docs/assets/js/ui/render-advanced.js

import * as util from '../lib/util.js';
import * as loader from '../lib/loader.js';
import * as router from '../lib/router.js';
import * as store from '../lib/store.js';

/**
 * 初始化進階題（A/B/C）：
 * - 由 URL ?set=A|B|C 指定，預設 A
 * - 題目結構相容 { id, stem, options:[A,B] }
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

  // 讀 set
  const q = router.getQuery?.() ?? Object.fromEntries(new URLSearchParams(location.search));
  const SET = String(q.set || q.group || 'A').toUpperCase();
  if (!['A', 'B', 'C'].includes(SET)) {
    console.warn('[advanced] unknown set, fallback to A:', SET);
  }

  // 標題
  const title = document.createElement('h1');
  title.textContent = `進階題組 ${['A','B','C'].includes(SET) ? SET : 'A'}`;
  root.appendChild(title);

  // 載入題庫（檔名 items_public_adv_A/B/C.json）
  let items = await loader.loadItemsAdv(SET);
  if (!Array.isArray(items) || items.length === 0) {
    const p = document.createElement('p');
    p.textContent = `找不到進階題庫資料（items_public_adv_${SET}.json）。`;
    root.appendChild(p);
    return;
  }

  // 相容欄位：stem + options[0/1]
  const pickStem = (it) =>
    it.stem ?? it.prompt ?? it.title ?? it.desc ?? it.description ?? '';

  const pickTextA = (it) =>
    (Array.isArray(it.options) ? it.options[0] : undefined) ??
    it.A ?? it.a ?? it.optionA ?? it.textA ?? it.left ?? it.l ?? it.statementA ?? '';

  const pickTextB = (it) =>
    (Array.isArray(it.options) ? it.options[1] : undefined) ??
    it.B ?? it.b ?? it.optionB ?? it.textB ?? it.right ?? it.r ?? it.statementB ?? '';

  const pickId = (it, i) => it.id ?? it._id ?? it.key ?? `q${i + 1}`;

  // 題序洗牌（保留原始順序 id 序列）
  const originalOrder = items.map((it, i) => pickId(it, i));
  items = util.shuffle(items.slice());

  // debug 區（可刪）
  try {
    const first = items[0];
    const dbg = document.createElement('div');
    dbg.style.cssText = 'margin:12px;padding:10px;border-radius:8px;background:#f1f5f9;color:#0f172a;font:12px/1.4 ui-monospace,monospace';
    dbg.innerHTML = [
      `<b>debug</b>（set=${['A','B','C'].includes(SET)?SET:'A'}）`,
      '第一題 stem：' + escapeHTML(pickStem(first) || '(無)'),
      'A：' + escapeHTML(String(pickTextA(first) ?? '')),
      'B：' + escapeHTML(String(pickTextB(first) ?? '')),
    ].join('<br/>');
    root.appendChild(dbg);
  } catch {}

  // 說明
  const hint = document.createElement('p');
  hint.innerHTML = `
    請在每題的 A 與 B 之間做傾向選擇：<br/>
    <strong>非常同意A、較同意A、中立、較同意B、非常同意B</strong><br/>
    （僅顯示敘述，不顯示任何功能名稱）
  `;
  root.appendChild(hint);

  // 進度
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

  // Likert 刻度
  const SCALE = [
    { label: '非常同意A', value: -2 },
    { label: '較同意A', value: -1 },
    { label: '中立', value: 0 },
    { label: '較同意B', value: 1 },
    { label: '非常同意B', value: 2 },
  ];

  // 產生題目
  const answerMap = new Map();
  items.forEach((it, idx) => {
    const qId = pickId(it, idx);
    const stem = String(pickStem(it) ?? '').trim();
    const textA = String(pickTextA(it) ?? '').trim();
    const textB = String(pickTextB(it) ?? '').trim();

    const block = document.createElement('section');
    block.className = 'q-block';
    block.style.border = '1px solid var(--line, #ddd)';
    block.style.borderRadius = '8px';
    block.style.padding = '12px';
    block.style.margin = '12px 0';

    const head = document.createElement('div');
    head.className = 'q-head';
    head.style.fontWeight = '600';
    head.style.marginBottom = '8px';
    head.textContent = `第 ${idx + 1} 題`;
    block.appendChild(head);

    if (stem) {
      const stemEl = document.createElement('div');
      stemEl.className = 'q-stem';
      stemEl.style.cssText = 'margin-bottom:8px;color:var(--fg-muted,#64748b);font-size:14px;';
      stemEl.textContent = stem;
      block.appendChild(stemEl);
    }

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

  // 動作列
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

  // 送出
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
      const val = Number(answerMap.get(`q_${id}`));
      answers.push(val);
      orderCurrent.push(id);
    });

    // 存 session
    const session = {
      id: util.uuid(),
      kind: 'advanced',
      set: ['A','B','C'].includes(SET) ? SET : 'A',
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
        stem: String(pickStem(it) ?? ''),
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
}

// 自動啟動（若檔名為 advanced.html）
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (location.pathname.endsWith('advanced.html')) {
        initRenderAdvanced().catch(console.error);
      }
    });
  } else {
    if (location.pathname.endsWith('advanced.html')) {
      initRenderAdvanced().catch(console.error);
    }
  }
}