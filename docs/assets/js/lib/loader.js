// /docs/assets/js/lib/loader.js
import { assert } from './util.js';

const CANDIDATE_BASES = ['./data','../data','/data'];
(function appendGhPagesBase(){
  try{
    const u = new URL(document.baseURI);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length>=1){
      const repo = `/${parts[0]}`;
      for (const p of [`${repo}/data`, `${repo}/docs/data`]) {
        if (!CANDIDATE_BASES.includes(p)) CANDIDATE_BASES.push(p);
      }
    }
  }catch{}
})();

const DBG = (()=> new URLSearchParams(location.search).get('debug') !== '0')();

function showOverlay(lines){
  if(!DBG) return;
  const box = document.createElement('div');
  Object.assign(box.style,{
    position:'fixed', right:'8px', bottom:'8px', zIndex:99999,
    maxWidth:'92vw', maxHeight:'45vh', overflow:'auto',
    padding:'10px 12px', background:'rgba(0,0,0,.85)', color:'#fff',
    font:'12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    borderRadius:'8px', boxShadow:'0 4px 20px rgba(0,0,0,.35)', whiteSpace:'pre-wrap'
  });
  box.textContent = lines.join('\n');
  document.body.appendChild(box);
}

async function tryFetchText(url){
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}
async function tryFetchJSON(url){
  const txt = await tryFetchText(url);
  try{
    return { json: JSON.parse(txt), rawText: txt };
  }catch(e){
    throw new Error(`JSON parse error for ${url}: ${e.message}\n--- snippet ---\n${txt.slice(0,200)}`);
  }
}
async function fetchFromCandidates(relPath){
  const errors = [];
  for (const base of CANDIDATE_BASES){
    const url = `${base}/${relPath}`.replace(/\/{2,}/g,'/');
    try{
      const { json, rawText } = await tryFetchJSON(url);
      return { json, rawText, urlTried: url };
    }catch(err){ errors.push(`- ${err.message}`); }
  }
  throw new Error(
    [`[loader] 無法載入 ${relPath}`,
     `已嘗試：`, ...CANDIDATE_BASES.map(b=>`  • ${b}/${relPath}`),
     `詳細錯誤：`, ...errors].join('\n')
  );
}

// ---------- 公開 API ----------
export async function loadItemsBasic(){
  const { json, rawText, urlTried } = await fetchFromCandidates('items_public_32.json');
  const items = normalizeItemsContainer(json);
  showDiag('basic', urlTried, json, items, rawText);
  assert(items.length>0, `[loader] 基礎題庫為空（來源：${urlTried}）`);
  return items;
}
export async function loadItemsAdv(set='A'){
  const S = String(set).toUpperCase();
  const { json, rawText, urlTried } = await fetchFromCandidates(`items_public_adv_${S}.json`);
  const items = normalizeItemsContainer(json);
  showDiag(`adv_${S}`, urlTried, json, items, rawText);
  assert(items.length>0, `[loader] 進階題庫為空（${S}，來源：${urlTried}）`);
  return items;
}

export async function loadWeightsBasic(){
  const { json } = await fetchFromCandidates('weights/weights_32.json');
  return json;
}
export async function loadWeightsAdv(set='A'){
  const S = String(set).toUpperCase();
  const { json } = await fetchFromCandidates(`weights/weights_adv_${S}.json`);
  return json;
}
export async function loadMappingFuncs(){
  const { json } = await fetchFromCandidates('mapping/funcs.json');
  return json;
}
export async function loadMappingTypes(){
  const { json } = await fetchFromCandidates('mapping/types.json');
  return json;
}

// ---------- 相容處理 ----------
function showDiag(tag, url, raw, items, rawText){
  const type = Array.isArray(raw) ? 'array' : (raw && typeof raw==='object' ? 'object' : typeof raw);
  const keys = (raw && typeof raw==='object' && !Array.isArray(raw)) ? Object.keys(raw).slice(0,10) : [];
  const lines = [
    `[items_${tag}]`,
    `url: ${url}`,
    `raw.type: ${type}${keys.length?` keys: ${keys.join(', ')}`:''}`,
    `count: ${items.length}`,
    items[0] ? `first.id: ${items[0].id}` : '',
    items[0] ? `first.text: ${truncate(items[0].text)}` : '',
  ];
  if (items.length===0 && rawText) {
    lines.push('raw snippet:', rawText.slice(0,200));
  }
  showOverlay(lines);
}

function normalizeItemsContainer(raw){
  // 先嘗試常見容器
  const buckets = [];
  if (Array.isArray(raw)) buckets.push(raw);
  if (raw && typeof raw==='object'){
    for (const key of ['items','questions','list','data','payload','results']){
      if (Array.isArray(raw[key])) buckets.push(raw[key]);
    }
  }
  // 退而求其次：如果物件裡有唯一一個陣列值，也採用它
  if (raw && typeof raw==='object' && buckets.length===0){
    const arrays = Object.values(raw).filter(v=>Array.isArray(v));
    if (arrays.length===1) buckets.push(arrays[0]);
  }
  const arr = buckets.find(a=>a.length) || [];
  return normalizeItems(arr);
}

function normalizeItems(arr){
  return arr.map((it,i)=>{
    const id = it.id ?? it.qid ?? it.key ?? `q_${i+1}`;
    const text = coalesce(
      it.text, it.stem, // <--- 支援 stem
      it.title, it.desc, it.description, it.content,
      it.label, it.prompt, it.question, it.name, it.q
    );
    const options = it.options ?? it.choices ?? null;
    return { ...it, id, text: String(text ?? '').trim(), options };
  }).filter(it => it.text && it.text.length>0);
}

function coalesce(...vals){
  for (const v of vals) if (v!==undefined && v!==null && String(v).trim()!=='') return v;
  return '';
}
function truncate(s,n=90){ s=String(s??''); return s.length>n? s.slice(0,n)+'…' : s; }