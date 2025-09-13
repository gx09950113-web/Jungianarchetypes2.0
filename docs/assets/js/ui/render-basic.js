// /docs/assets/js/ui/render-basic.js

import * as util from '../lib/util.js';
import * as loader from '../lib/loader.js';
import * as router from '../lib/router.js';
import * as store from '../lib/store.js';

/**
 * 公開初始化函式
 * - 可以在 console 直接執行：await initRenderBasic()
 * - 若頁面沒有容器，會自動建立 <div id="app"></div>
 */
export async function initRenderBasic(rootId = 'app') {
  // 建立/取得容器
  let root = document.getElementById(rootId);
  if (!root) {
    root = document.createElement('div');
    root.id = rootId;
    document.body.appendChild(root);
  }
  root.innerHTML = ''; // 清空

  // 標題
  const title = document.createElement('h1');
  title.textContent = '基礎 32 題自測';
  root.appendChild(title);

  // 載入題庫
  let items = await loader.loadItemsBasic(); // 預期回傳 array
  if (!Array.isArray(items) || items.length === 0) {
    const p = document.createElement('p');
    p.textContent = '找不到題庫資料（items_public_32.json）。';
    root.appendChild(p);
    return;
  }

  // ====== 這裡是關鍵修正：相容你的 JSON 結構 ======
  // 你的 JSON: { id, stem, options: [A, B] }
  const pickStem = (it) =>
    it.stem ?? it.prompt ?? it.title ?? it.desc ?? it.description ?? '';

  const pickTextA = (it) =>
    (Array.isArray(it.options) ? it.options[0] : undefined) ??
    it.A ?? it.a ?? it.optionA ?? it.textA ?? it.left ?? it.l ?? it.statementA ?? '';

  const pickTextB = (it) =>
    (Array.isArray(it.options) ? it.options[1] : undefined) ??
    it.B ?? it.b ?? it.optionB ?? it.textB ?? it.right ?? it.r ?? it.statementB ?? '';

  const pickId = (it, i) => it.id ?? it._id ?? it.key ?? `q${i + 1}`;

  // 題序洗牌（同時保留原始 order 的 id）
  const originalOrder = items.map((it, i) => pickId(it, i));
  items = util.shuffle(items.slice());

  // --- debug 區（可刪）----
  try {
    const first = items[0];
    const dbg = document.createElement('div');
    dbg.style.cssText = 'margin:12px;padding:10px;border-radius:8px;background:#f1f5f9;color:#0f172a;font:12px/1.4 ui-monospace,monospace';
    dbg.innerHTML = [
      '<b>debug</b>',
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

  // 表單容器
  const form = document.createElement('form');
  form.autocomplete = 'off';
  form.noValidate = true;
  root.appendChild(form);

  // Likert 選項定義（值域 -2..2）
  const SCALE = [
    { label: '非常同意A', value: -2 },
    { label: '較同意A', value: -1 },
    { label: '中立', value: 0 },
    { label: '較同意B', value: 1 },
    { label: '非常同意B', value: 2 },
  ];

  // 產生題目區塊
  const answerMap = new Map(); // name -> value
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

    // 題號
    const head = document.createElement('div');
    head.className = 'q-head';
    head.style.fontWeight = '600';
    head.style.marginBottom = '8px';
    head.textContent = `第 ${idx + 1} 題`;
    block.appendChild(head);

    // 題幹（stem）
    if (stem) {
      const stemEl = document.createElement('div');
      stemEl.className = 'q-stem';
      stemEl.style.cssText = 'margin-bottom:8px;color:var(--fg-muted,#64748b);font-size:14px;';
      stemEl.textContent = stem;
      block.appendChild(stemEl);
    }

    // AB 文字（不顯示功能名，只顯示句子）
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

    SCALE.forEach((opt, i) => {
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

      // 讓鍵盤操作順
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

  // 提交列
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

  // 表單提交
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const total = items.length;
    const names = items.map((it, idx) => `q_${pickId(it, idx)}`);
    const missing = names.filter((n) => !answerMap.has(n));

    if (missing.length > 0) {
      alert(`尚有 ${missing.length} 題未作答，請完成所有題目。`);
      return;
    }

    // 依「目前題序」收集 answers 與 itemId 序列
    const answers = [];
    const orderCurrent = [];
    items.forEach((it, idx) => {
      const id = pickId(it, idx);
      const name = `q_${id}`;
      const val = Number(answerMap.get(name));
      answers.push(val);
      orderCurrent.push(id);
    });

    // 建立 session 物件（不做任何計分，交由結果頁 compute）
    const session = {
      id: util.uuid(),
      kind: 'basic',
      createdAt: util.nowISO(),
      version: 1,
      meta: {
        total,
        scale: 'A/B 5-point (-2..2)',
      },
      originalOrder,         // 原始載入時（未洗牌）之 id 序
      order: orderCurrent,   // 洗牌後實際作答的 id 序
      // 為了結果頁 compute，保留 item 的最小必要資訊（id / stem / A / B）
      items: items.map((it, idx) => ({
        id: pickId(it, idx),
        stem: String(pickStem(it) ?? ''),
        A: String(pickTextA(it) ?? ''),
        B: String(pickTextB(it) ?? ''),
      })),
      answers, // 對應 order 的作答值（-2..2）
    };

    // 儲存並導向結果頁
    store.saveResult(session);
    location.href = `result.html?id=${encodeURIComponent(session.id)}`;
  });

  // 初始進度
  updateProgress();

  // --------- util 區 ---------
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

// 若直接以 <script type="module"> 引入，且 DOM 準備好，則自動啟動
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (location.pathname.endsWith('basic.html')) {
        initRenderBasic().catch(console.error);
      }
    });
  } else {
    if (location.pathname.endsWith('basic.html')) {
      initRenderBasic().catch(console.error);
    }
  }
}