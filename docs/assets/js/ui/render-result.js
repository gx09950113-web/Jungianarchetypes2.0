// /docs/assets/js/ui/render-result.js

import * as util from '../lib/util.js';
import * as router from '../lib/router.js';
import * as store from '../lib/store.js';

// 嘗試載入 loader / compute（允許還沒寫好時不報錯）
let loader = null;
let compute = null;
try {
  loader = await import('../lib/loader.js');
} catch (_) {}
try {
  compute = await import('../lib/compute.js');
} catch (_) {}

/**
 * 公開初始化：
 * - 可於 console 執行：await initRenderResult()
 * - 若頁面沒有容器，會自動建立 <div id="app"></div>
 */
export async function initRenderResult(rootId = 'app') {
  // 容器
  let root = document.getElementById(rootId);
  if (!root) {
    root = document.createElement('div');
    root.id = rootId;
    document.body.appendChild(root);
  }
  root.innerHTML = '';

  // 解析 id
  const q = router.getQuery?.() ?? {};
  const id = String(q.id ?? '').trim();
  if (!id) {
    renderError(root, '缺少 id。請從作答頁導向或於網址帶入 ?id=...');
    return;
  }

  // 讀取 session
  const session = store.loadResult?.(id);
  if (!session) {
    renderError(root, `找不到記錄：${id}。`);
    return;
  }

  // 頁面標題與摘要
  const title = document.createElement('h1');
  title.textContent = '測驗結果';
  root.appendChild(title);

  const meta = document.createElement('p');
  meta.style.opacity = '.8';
  meta.style.marginTop = '-6px';
  meta.innerHTML = `ID：<code>${escapeHTML(session.id)}</code> ｜ 類型：<code>${escapeHTML(session.kind)}</code>${
    session.set ? `（${escapeHTML(session.set)}）` : ''
  } ｜ 送出時間：${escapeHTML(session.createdAt || '')}`;
  root.appendChild(meta);

  // 嘗試載入權重並計分
  const weights = await loadWeightsForSession(session);
  let result = null;
  let computeError = null;
  try {
    result = await runCompute(session, weights);
  } catch (err) {
    computeError = err;
    console.error('[compute error]', err);
  }

  // 左右欄容器
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = '2fr 1fr';
  grid.style.gap = '16px';
  grid.style.alignItems = 'start';
  grid.style.marginTop = '12px';
  root.appendChild(grid);

  // ===== 左欄：圖表 =====
  const left = document.createElement('div');
  grid.appendChild(left);

  // 雷達圖
  const radarCard = card('八維雷達圖');
  const radarCanvas = document.createElement('canvas');
  radarCanvas.width = 480;
  radarCanvas.height = 360;
  radarCard.body.appendChild(radarCanvas);
  left.appendChild(radarCard.wrap);

  // 四向度條列
  const dimsCard = card('四向度');
  const dimsHost = document.createElement('div');
  dimsCard.body.appendChild(dimsHost);
  left.appendChild(dimsCard.wrap);

  // ===== 右欄：MBTI / 匯出 / 其它 =====
  const right = document.createElement('div');
  grid.appendChild(right);

  const mbtiCard = card('MBTI');
  const mbtiText = document.createElement('div');
  mbtiText.style.fontSize = '28px';
  mbtiText.style.fontWeight = '700';
  mbtiText.style.letterSpacing = '2px';
  mbtiText.textContent = '- - - -';
  mbtiCard.body.appendChild(mbtiText);

  const mbtiDesc = document.createElement('p');
  mbtiDesc.style.marginTop = '8px';
  mbtiDesc.style.opacity = '.9';
  mbtiCard.body.appendChild(mbtiDesc);
  right.appendChild(mbtiCard.wrap);

  const actionCard = card('操作');
  const btnExport = document.createElement('button');
  btnExport.textContent = '匯出 JSON';
  btnExport.style.padding = '10px 14px';
  btnExport.style.border = 'none';
  btnExport.style.borderRadius = '8px';
  btnExport.style.background = 'var(--accent, #4caf50)';
  btnExport.style.color = '#fff';
  btnExport.style.fontWeight = '600';
  btnExport.addEventListener('click', () => {
    exportJSON(session, result);
  });

  const btnHome = document.createElement('a');
  btnHome.href = 'index.html';
  btnHome.textContent = '回首頁';
  btnHome.style.display = 'inline-block';
  btnHome.style.padding = '10px 14px';
  btnHome.style.border = '1px solid var(--line, #ddd)';
  btnHome.style.borderRadius = '8px';
  btnHome.style.marginLeft = '8px';
  btnHome.style.textDecoration = 'none';
  btnHome.style.fontWeight = '600';

  actionCard.body.appendChild(btnExport);
  actionCard.body.appendChild(btnHome);
  right.appendChild(actionCard.wrap);

  // 若 compute 失敗，顯示降級訊息與原始資料
  if (!result || computeError) {
    const warn = card('尚未計分 / 降級顯示');
    const msg = document.createElement('p');
    msg.innerHTML = `無法產生完整結果（可能是 <code>compute.js</code> 尚未實作或匯出不同的 API）。<br/>
    你仍可先「匯出 JSON」保存本次作答，等完成 compute 後重算。`;
    warn.body.appendChild(msg);

    const pre = document.createElement('pre');
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.maxHeight = '240px';
    pre.style.overflow = 'auto';
    pre.textContent = JSON.stringify(session, null, 2);
    warn.body.appendChild(pre);

    right.appendChild(warn.wrap);
    // 仍繼續嘗試呈現基本資訊
    renderFallbackCharts({ radarCanvas, dimsHost, session });
    return;
  }

  // ===== 使用 result 繪製 =====
  // 期望 result 形如：
  // {
  //   functions: [{key:'Ni', score:...}, ...]或 {Ni:..., ...}
  //   dims: { EI: x, NS: y, TF: z, JP: w } （-100~100 或 -1~1）
  //   mbti: 'INTJ'
  // }
  // 寬容地做多種欄位名稱容錯
  const funcs = normalizeFunctions(result.functions || result.funcs || result['functions八維']);
  const dims = normalizeDims(result.dims || result.dimensions || result['dims四向度']);
  const mbti = String(result.mbti || result.MBTI || '').toUpperCase() || deriveMBTI(dims);

  // 雷達
  renderRadarChart(radarCanvas, funcs);

  // 四向度
  renderDimsBars(dimsHost, dims);

  // MBTI 顯示與描述
  mbtiText.textContent = mbti;
  const typesMap = await loadTypesMapping(); // 可選
  if (typesMap && typesMap[mbti]) {
    const t = typesMap[mbti];
    mbtiDesc.textContent = String(t.desc || t.description || t.title || '');
  } else {
    mbtiDesc.textContent = '（尚無此類型描述）';
  }
}

/* ================= 工具與渲染 ================= */

function renderError(root, text) {
  const h = document.createElement('h1');
  h.textContent = '無法顯示結果';
  const p = document.createElement('p');
  p.innerHTML = escapeHTML(text);
  root.appendChild(h);
  root.appendChild(p);
}

function card(title) {
  const wrap = document.createElement('section');
  wrap.style.border = '1px solid var(--line, #ddd)';
  wrap.style.borderRadius = '10px';
  wrap.style.overflow = 'hidden';
  const head = document.createElement('div');
  head.style.padding = '10px 12px';
  head.style.background = 'var(--bg-muted, #f7f7f7)';
  head.style.fontWeight = '700';
  head.textContent = title;
  const body = document.createElement('div');
  body.style.padding = '12px';
  wrap.appendChild(head);
  wrap.appendChild(body);
  return { wrap, body };
}

function escapeHTML(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/** 根據 session.kind / session.set 載入對應權重（若 loader 存在） */
async function loadWeightsForSession(session) {
  if (!loader) return null;
  try {
    if (session.kind === 'basic') {
      return await (loader.loadWeightsBasic?.() ?? null);
    }
    if (session.kind === 'advanced') {
      const set = String(session.set || '').toUpperCase();
      if (loader.loadWeightsAdv) return await loader.loadWeightsAdv(set);
      // 向後相容：若拆成 A/B/C
      if (set === 'A' && loader.loadWeightsAdvA) return await loader.loadWeightsAdvA();
      if (set === 'B' && loader.loadWeightsAdvB) return await loader.loadWeightsAdvB();
      if (set === 'C' && loader.loadWeightsAdvC) return await loader.loadWeightsAdvC();
    }
  } catch (err) {
    console.error('[loadWeightsForSession]', err);
  }
  return null;
}

/** 嘗試多種 compute API 呼叫方式 */
async function runCompute(session, weights) {
  if (!compute) throw new Error('compute 模組尚未可用。');

  // 常見 API 1：compute.compute(session, weights)
  if (typeof compute.compute === 'function') {
    return await compute.compute(session, weights);
  }
  // 常見 API 2：compute.run(session, weights)
  if (typeof compute.run === 'function') {
    return await compute.run(session, weights);
  }
  // 常見 API 3：compute.evaluate(answers, weights, session)
  if (typeof compute.evaluate === 'function') {
    return await compute.evaluate(session.answers, weights, session);
  }
  // 常見 API 4：compute.calc(...)
  if (typeof compute.calc === 'function') {
    return await compute.calc(session, weights);
  }

  throw new Error('找不到可用的 compute 方法（預期 compute()/run()/evaluate()/calc() 其一）。');
}

/** 嘗試載入 MBTI 類型描述（mapping/types.json）。失敗則回傳 null。 */
async function loadTypesMapping() {
  // 優先走 loader
  if (loader?.loadTypesMapping) {
    try {
      return await loader.loadTypesMapping();
    } catch (_) {}
  }
  // 直接抓檔案（相對於 docs/ ）
  try {
    const res = await fetch('./data/mapping/types.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

function normalizeFunctions(funcs) {
  // 支援兩種：陣列或物件
  if (Array.isArray(funcs)) {
    // 期望格式 [{key:'Ni', score:...}, ...]
    const mapped = {};
    for (const f of funcs) {
      const k = (f.key || f.name || f.func || f.code || '').toString();
      const v = Number(f.score ?? f.value ?? 0);
      if (k) mapped[k] = v;
    }
    return mapped;
  }
  if (funcs && typeof funcs === 'object') {
    return { ...funcs };
  }
  return {};
}

function normalizeDims(dims) {
  if (!dims || typeof dims !== 'object') return {};
  const out = {};
  // 多種命名容錯
  out.EI = Number(
    dims.EI ?? dims.EI_score ?? dims['E-I'] ?? dims['EI%'] ?? dims.E ?? 0
  );
  out.NS = Number(
    dims.NS ?? dims.NS_score ?? dims['N-S'] ?? dims['NS%'] ?? dims.N ?? 0
  );
  out.TF = Number(
    dims.TF ?? dims.TF_score ?? dims['T-F'] ?? dims['TF%'] ?? dims.T ?? 0
  );
  out.JP = Number(
    dims.JP ?? dims.JP_score ?? dims['J-P'] ?? dims['JP%'] ?? dims.J ?? 0
  );
  return out;
}

function deriveMBTI(dims) {
  // 假設 dims 值為 -100..100 或 -1..1，正負代表傾向
  const pick = (v, pos, neg) => (Number(v) >= 0 ? pos : neg);
  const EorI = pick(dims.EI, 'E', 'I');
  const NorS = pick(dims.NS, 'N', 'S');
  const TorF = pick(dims.TF, 'T', 'F');
  const JorP = pick(dims.JP, 'J', 'P');
  return `${EorI}${NorS}${TorF}${JorP}`;
}

function renderRadarChart(canvas, funcs) {
  // 需要 Chart
  if (typeof Chart === 'undefined') {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f00';
    ctx.fillText('Chart.js 尚未載入（請確認 chart.umd.js 已引入）', 10, 20);
    return;
  }

  const labels = Object.keys(funcs);
  const values = labels.map((k) => Number(funcs[k] ?? 0));
  // 自動估計刻度
  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
  const suggestedMax = roundUp(maxAbs);
  const suggestedMin = -suggestedMax;

  const data = {
    labels,
    datasets: [
      {
        label: 'Functions',
        data: values,
        fill: true,
      },
    ],
  };

  // 銷毀舊圖（若重繪）
  if (canvas._chart) {
    canvas._chart.destroy();
  }

  canvas._chart = new Chart(canvas.getContext('2d'), {
    type: 'radar',
    data,
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
        title: { display: false },
      },
      scales: {
        r: {
          suggestedMin,
          suggestedMax,
          ticks: { display: true },
          grid: { circular: true },
          pointLabels: { centerPointLabels: true, font: { size: 12 } },
        },
      },
    },
  });

  function roundUp(n) {
    // 取 10 的倍數（或 1 的倍數）
    if (n <= 5) return 5;
    const k = Math.pow(10, Math.floor(Math.log10(n)));
    return Math.ceil(n / k) * k;
  }
}

function renderDimsBars(host, dims) {
  host.innerHTML = '';
  const map = [
    { key: 'EI', left: 'E', right: 'I' },
    { key: 'NS', left: 'N', right: 'S' },
    { key: 'TF', left: 'T', right: 'F' },
    { key: 'JP', left: 'J', right: 'P' },
  ];

  map.forEach(({ key, left, right }) => {
    const vRaw = Number(dims[key] ?? 0);
    const v = normalizeToPct(vRaw); // 0..100，以 50 為中線，>50 偏右
    const row = document.createElement('div');
    row.style.margin = '10px 0';

    const label = document.createElement('div');
    label.style.display = 'flex';
    label.style.justifyContent = 'space-between';
    label.style.fontWeight = '600';
    label.style.marginBottom = '6px';
    label.innerHTML = `${left} <span style="opacity:.6;font-weight:400;">${key}</span> ${right}`;
    row.appendChild(label);

    const bar = document.createElement('div');
    bar.style.position = 'relative';
    bar.style.height = '14px';
    bar.style.borderRadius = '999px';
    bar.style.background = 'var(--bg-muted, #eee)';
    bar.style.overflow = 'hidden';

    const center = document.createElement('div');
    center.style.position = 'absolute';
    center.style.left = '50%';
    center.style.top = '0';
    center.style.bottom = '0';
    center.style.width = '2px';
    center.style.background = 'rgba(0,0,0,.15)';
    bar.appendChild(center);

    const fill = document.createElement('div');
    fill.style.height = '100%';
    // 0..100：0=最左 100=最右；基準 50
    if (v >= 50) {
      fill.style.width = `${v - 50}%`;
      fill.style.marginLeft = '50%';
    } else {
      fill.style.width = `${50 - v}%`;
      fill.style.marginLeft = `${v}%`;
    }
    fill.style.background = 'var(--accent, #4caf50)';
    bar.appendChild(fill);

    const tick = document.createElement('div');
    tick.style.position = 'absolute';
    tick.style.top = '18px';
    tick.style.left = `${v}%`;
    tick.style.transform = 'translateX(-50%)';
    tick.style.fontSize = '12px';
    tick.style.opacity = '.7';
    tick.textContent = `${Math.round((v - 50))}`;
    bar.appendChild(tick);

    row.appendChild(bar);
    host.appendChild(row);
  });

  function normalizeToPct(x) {
    // 將 -100..100 或 -1..1 映為 0..100（50 為 0）
    if (!isFinite(x)) return 50;
    const abs = Math.max(Math.abs(x), 1);
    const range = abs <= 1 ? 1 : 100;
    return 50 + (x / range) * 50;
  }
}

function exportJSON(session, result) {
  const payload = {
    session,
    result: result ?? null,
    exportedAt: util.nowISO?.() || new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jungian_result_${session.id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 當無法 compute 時，仍呈現基礎資訊（不崩） */
function renderFallbackCharts({ radarCanvas, dimsHost, session }) {
  // 顯示一張提示圖像（無 Chart）
  const ctx = radarCanvas.getContext('2d');
  ctx.fillStyle = '#444';
  ctx.fillText('尚未產生雷達數據', 10, 20);

  // 四向度以 0 呈現
  renderDimsBars(dimsHost, { EI: 0, NS: 0, TF: 0, JP: 0 });
}

/* ============= 自動啟動（僅在 result.html） ============= */

if (typeof window !== 'undefined') {
  const boot = () => {
    if (location.pathname.endsWith('result.html')) {
      initRenderResult().catch(console.error);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}