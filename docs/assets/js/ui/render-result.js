// /docs/assets/js/ui/render-result.js
// 以 weights_*.json 的「八維權重比分」做計算 → 繪出八維雷達圖與四功能向度圖
// 相容多種常見的權重檔格式：
//  - signed 向量： { "B01": { "Si": +1, "Se": -1, ... } }  → 以 Likert 映射成 [-1..+1] 乘上向量
//  - A/B 兩組向量： { "B01": { "A": {Si:...}, "B": {Se:...} } } → 以 Likert t∈[0..1] 做 A/B 線性內插
//  - 只有 S/N/T/F： { "B01": { "S": 1, "N": 0, ... } } → 均分到 Si/Se、Ni/Ne 等
//
// 畫圖：
//  - 八維：每一對（Si/Se、Ni/Ne、Ti/Te、Fi/Fe）內部正規化到百分比
//  - 四維：各對的總量作為強度，再對 S/N/T/F 做 0..100% 正規化

import * as store from '../lib/store.js';
import { loadWeightsBasic, loadWeightsAdv, loadMappingFuncs, loadMappingTypes } from '../lib/loader.js';

// ---------- 確保 Chart.js ----------
async function ensureChartJS() {
  if (window.Chart) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Chart.js 載入失敗'));
    document.head.appendChild(s);
  });
}

// ---------- 小工具 ----------
const EIGHT = ['Si','Se','Ni','Ne','Ti','Te','Fi','Fe'];
const PAIRS = [
  ['Si','Se','S'],
  ['Ni','Ne','N'],
  ['Ti','Te','T'],
  ['Fi','Fe','F'],
];
const toKey = k => String(k||'').toLowerCase().replace(/[^a-z]/g,'');

function emptyVec() {
  return { Si:0, Se:0, Ni:0, Ne:0, Ti:0, Te:0, Fi:0, Fe:0 };
}
function addVec(a, b, s=1) {
  for (const k of EIGHT) a[k] += (b[k] || 0) * s;
  return a;
}
function mulVec(b, s) {
  const out = emptyVec();
  for (const k of EIGHT) out[k] = (b[k] || 0) * s;
  return out;
}
function mixVec(a, b, t) { // (1-t)*A + t*B
  const out = emptyVec();
  for (const k of EIGHT) out[k] = (a[k]||0) * (1-t) + (b[k]||0) * t;
  return out;
}
function splitSNFTtoEight(obj) {
  // 支援只有 S/N/T/F：平均分配給 i/e
  const out = emptyVec();
  const map = { s:['Si','Se'], n:['Ni','Ne'], t:['Ti','Te'], f:['Fi','Fe'] };
  for (const [k,v] of Object.entries(obj||{})) {
    if (!Number.isFinite(v)) continue;
    const key = toKey(k);
    if (map[key]) {
      const [i,e] = map[key];
      out[i] += v/2;
      out[e] += v/2;
    }
  }
  return out;
}
function parseVectorLike(obj) {
  // 盡力把任意鍵 → 八維向量
  const out = emptyVec();
  let used = false;
  for (const [k,v] of Object.entries(obj||{})) {
    const key = toKey(k);
    if (!Number.isFinite(v)) continue;
    if (key==='si'||key==='se'||key==='ni'||key==='ne'||key==='ti'||key==='te'||key==='fi'||key==='fe') {
      out[key[0].toUpperCase()+key[1]] += v; // 'si' → 'Si'
      used = true;
    }
  }
  if (used) return out;
  // 沒有八維鍵，試著從 S/N/T/F 轉
  return splitSNFTtoEight(obj);
}

function signedFromLikert(v) {
  // 1..5 → +1..-1（1 表示強 A；5 表示強 B；3 為 0）
  return (3 - Number(v)) / 2;
}
function tFromLikert(v) {
  // 1..5 → 0..1（A..B）
  return (Number(v) - 1) / 4;
}

// 找出權重資料中對應某題 qid 的權重紀錄
function findWeightEntry(weights, qid) {
  if (!weights) return null;
  // 直接命中
  if (weights[qid]) return weights[qid];

  // 常見容器 keys
  for (const k of ['items','byId','questions','weights','map','data']) {
    const sub = weights[k];
    if (!sub) continue;
    if (Array.isArray(sub)) {
      const row = sub.find(r => r?.id===qid || r?.qid===qid || r?.key===qid || r?.code===qid);
      if (row) return row;
    } else if (typeof sub === 'object' && sub[qid]) {
      return sub[qid];
    }
  }

  // 最後嘗試：在所有值中找 id/qid 相等的
  try {
    for (const v of Object.values(weights)) {
      if (Array.isArray(v)) {
        const row = v.find(r => r?.id===qid || r?.qid===qid || r?.key===qid || r?.code===qid);
        if (row) return row;
      }
    }
  } catch {}
  return null;
}

// 解析單題權重 → 回傳八維向量（已依 Likert 套用）
function vectorForAnswer(qid, val, entry) {
  if (!entry) {
    // 沒有對應的權重 → 以題號首字（S/N/T/F）做極小權重降級推斷，避免整體為 0
    const hint = (qid||'')[0]?.toUpperCase();
    const base = emptyVec();
    if (hint==='S') { base.Si=0.5; base.Se=0.5; }
    else if (hint==='N') { base.Ni=0.5; base.Ne=0.5; }
    else if (hint==='T') { base.Ti=0.5; base.Te=0.5; }
    else if (hint==='F') { base.Fi=0.5; base.Fe=0.5; }
    // 以 A/B 線性插值做落點
    return mixVec(base, base, tFromLikert(val)); // 其實就是 base，自保
  }

  // case: A/B 兩組
  const A = entry.A || entry.a;
  const B = entry.B || entry.b;
  if (A || B) {
    const vA = parseVectorLike(A||{});
    const vB = parseVectorLike(B||{});
    return mixVec(vA, vB, tFromLikert(val));
  }

  // case: row.vec
  if (entry.vec && typeof entry.vec==='object') {
    const vec = parseVectorLike(entry.vec);
    return mulVec(vec, signedFromLikert(val));
  }

  // case: 直接就是 signed 向量或 S/N/T/F 權重
  const signed = parseVectorLike(entry);
  // 判斷像不像「signed」：若同一對有正負符號偏向，就當 signed；否則仍可當 signed 使用
  return mulVec(signed, signedFromLikert(val));
}

// 將累積結果轉成八維 pair-normalized 百分比 + 四功能相對強度
function finalizeStats(acc) {
  // acc 是八維的 raw 累積值（可能含正負）
  const eightPct = {};
  const fourVol = { S:0, N:0, T:0, F:0 };

  for (const [iKey, eKey, pairName] of PAIRS) {
    const iVal = Math.max(0, acc[iKey] || 0);
    const eVal = Math.max(0, acc[eKey] || 0);
    const sum = iVal + eVal;
    if (sum > 0) {
      eightPct[iKey] = (iVal / sum) * 100;
      eightPct[eKey] = (eVal / sum) * 100;
    } else {
      eightPct[iKey] = 0; eightPct[eKey] = 0;
    }
    // 以 pair 的總量做四功能強度
    fourVol[pairName] = sum;
  }

  const maxVol = Math.max(0.0001, fourVol.S, fourVol.N, fourVol.T, fourVol.F);
  const fourPct = {
    S: (fourVol.S / maxVol) * 100,
    N: (fourVol.N / maxVol) * 100,
    T: (fourVol.T / maxVol) * 100,
    F: (fourVol.F / maxVol) * 100,
  };

  return {
    eightOrder: EIGHT.slice(),
    eight: EIGHT.map(k => eightPct[k] || 0),
    fourOrder: ['S','N','T','F'],
    four: ['S','N','T','F'].map(k => fourPct[k] || 0),
  };
}

// ---------- 主初始化與繪圖 ----------
export async function initRenderResult(mountId = 'app', opts = {}) {
  await ensureChartJS();

  const root = document.getElementById(mountId) || document.body;
  root.innerHTML = '';

  // 讀取記錄
  const id = opts.id || new URLSearchParams(location.search).get('id');
  const rec = id ? store.getResult(id) : null;
  if (!rec) {
    root.innerHTML = `<div style="padding:16px;border:1px solid var(--border,#e2e8f0);border-radius:12px">
      無法顯示結果：找不到記錄 ${id ? `（id=${id}）` : '(未提供 id)'}
    </div>`;
    return;
  }

  // 載入權重
  let weights;
  try {
    if ((rec.type||'basic').toLowerCase() === 'advanced') {
      // 進階題：需要題組 set（從紀錄 / URL 取，預設 A）
      const sp = new URLSearchParams(location.search);
      const set = (rec.set || sp.get('set') || 'A').toUpperCase();
      weights = await loadWeightsAdv(set);
    } else {
      weights = await loadWeightsBasic();
    }
  } catch (e) {
    console.error('[result] 載入權重失敗：', e);
    root.innerHTML = `<div style="padding:16px;border:1px solid var(--border,#e2e8f0);border-radius:12px">
      無法載入權重檔：${e.message || e}
    </div>`;
    return;
  }

  //（可選）讀 mapping；若有 func/type 名稱可在此應用
  let funcMap = null, typeMap = null;
  try { funcMap = await loadMappingFuncs(); } catch {}
  try { typeMap = await loadMappingTypes(); } catch {}

  // 計算：逐題套用權重
  const acc = emptyVec();
  let missing = 0;
  for (const [qid, val] of Object.entries(rec.answers || {})) {
    const entry = findWeightEntry(weights, qid);
    if (!entry) missing++;
    const vec = vectorForAnswer(qid, val, entry);
    addVec(acc, vec, 1);
  }
  if (missing) {
    console.warn(`[result] 有 ${missing} 題在權重檔中找不到對應權重（已用降級推斷補齊）。`);
  }

  const stat = finalizeStats(acc);

  // 標頭
  root.appendChild(h2('測驗結果'));
  root.appendChild(pMuted(`記錄ID：${rec.id}．題型：${rec.type || 'basic'}．題數：${Object.keys(rec.answers||{}).length}`));
  if (missing) root.appendChild(pMuted(`注意：${missing} 題未在權重檔找到對應，已以題號首字母 (S/N/T/F) 做降級推斷。`));

  // 容器
  const wrap = divGrid();
  const radarCard = card('八維雷達圖（權重計算）', 'radar8');
  const barCard   = card('四功能向度圖（權重計算）', 'bar4');
  wrap.appendChild(radarCard.card);
  wrap.appendChild(barCard.card);
  root.appendChild(wrap);

  // 畫圖
  const rCtx = radarCard.canvas.getContext('2d');
  new Chart(rCtx, {
    type: 'radar',
    data: {
      labels: stat.eightOrder,
      datasets: [{ label: '對內部配對之比例（%）', data: stat.eight, fill: true }]
    },
    options: {
      responsive: true,
      scales: { r: { beginAtZero: true, suggestedMax: 100, ticks: { stepSize: 20 } } },
      plugins: { legend: { display: false }, tooltip: { enabled: true } }
    }
  });

  const bCtx = barCard.canvas.getContext('2d');
  new Chart(bCtx, {
    type: 'bar',
    data: {
      labels: stat.fourOrder,
      datasets: [{ label: '相對強度（%）', data: stat.four }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, suggestedMax: 100, ticks: { stepSize: 20 } } },
      plugins: { legend: { display: false }, tooltip: { enabled: true } }
    }
  });

  // === 小型 DOM 工具 ===
  function h2(t){ return el('h2',{},t); }
  function pMuted(t){ return el('p',{class:'muted',style:{marginTop:'-6px',color:'var(--fg-muted,#64748b)'}},t); }
  function divGrid(){
    return el('div',{class:'charts',style:'display:grid;gap:18px;grid-template-columns:minmax(260px,1fr);'});
  }
  function card(title, canvasId){
    const c = el('section',{style:'border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:16px;background:var(--card,#fff);'});
    c.appendChild(el('h3',{style:'margin:0 0 8px'},title));
    const canvas = el('canvas',{id:canvasId,height:320});
    c.appendChild(canvas);
    return { card:c, canvas };
  }
  function el(tag, props={}, children=[]){
    const node = document.createElement(tag);
    for (const [k,v] of Object.entries(props)) {
      if (v==null) continue;
      if (k==='class') node.className = v;
      else if (k==='style' && typeof v==='object') Object.assign(node.style, v);
      else if (k in node) node[k] = v;
      else node.setAttribute(k, v);
    }
    (Array.isArray(children)?children:[children]).forEach(c=>{
      node.appendChild(typeof c==='string' ? document.createTextNode(c) : c);
    });
    return node;
  }
}
