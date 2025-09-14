// docs/assets/js/lib/compute.js
// 支援兩種 weights 格式：
// 1) 直接向量：[{ id, weights:{Ni,Ne,Si,Se,Ti,Te,Fi,Fe} }, ...] 或 { [id]: {Ni..} }
// 2) A/B -> 功能索引：{ [id]: { A: { "idx": mag, ... }, B: { "idx": mag, ... } } }
//    idx 0..7 對應 [Si, Se, Ni, Ne, Ti, Te, Fi, Fe]

export const ORDER = ['Ni','Ne','Si','Se','Ti','Te','Fi','Fe'];
const INDEX2FUNC = ['Si','Se','Ni','Ne','Ti','Te','Fi','Fe'];

function emptyVec() {
  const o = {};
  for (const k of ORDER) o[k] = 0;
  return o;
}

function isPlainObject(x){ return !!x && typeof x === 'object' && !Array.isArray(x); }

// ---------- 直接向量格式處理 ----------
function normalizeWeightEntry_Vector(entry) {
  if (!isPlainObject(entry)) return null;
  const src = entry.func || entry.functions || entry.weights || entry.w || entry;
  const out = {};
  let found = false;
  for (const k of ORDER) {
    let v = src[k];
    if (typeof v === 'string') v = Number(v);
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v; found = true;
    } else {
      out[k] = 0;
    }
  }
  return found ? out : null;
}

// ---------- A/B → 索引格式處理 ----------
function isABIndexEntry(entry){
  // 形如：{ A:{ "0":2 }, B:{ "1":2 } }
  return isPlainObject(entry) && (isPlainObject(entry.A) || isPlainObject(entry.B));
}

// 1..5 Likert 轉成 A/B 強度（可依需求調整）
function likertToABStrength(val){
  const v = Number(val);
  if (!Number.isFinite(v)) return { a:0, b:0 };
  switch (v) {
    case 1: return { a:2, b:0 };
    case 2: return { a:1, b:0 };
    case 3: return { a:0, b:0 };
    case 4: return { a:0, b:1 };
    case 5: return { a:0, b:2 };
    default: {
      // 落在 1..5 外，做個線性近似：往 3 拉
      if (v < 3) return { a: Math.max(0, Math.round(3 - v)), b:0 };
      if (v > 3) return { a:0, b: Math.max(0, Math.round(v - 3)) };
      return { a:0, b:0 };
    }
  }
}

// 給定 A/B 權重定義 + Likert 值 → 算出一個 8 功能向量
function buildVecFromABEntry(abEntry, likertVal){
  const { a, b } = likertToABStrength(likertVal);
  const vec = emptyVec();

  // A 部分
  for (const [idxStr, mag] of Object.entries(abEntry.A || {})) {
    const idx = Number(idxStr);
    const key = INDEX2FUNC[idx] ?? null;
    if (!key) continue;
    const m = Number(mag) || 0;
    vec[key] += a * m;
  }
  // B 部分
  for (const [idxStr, mag] of Object.entries(abEntry.B || {})) {
    const idx = Number(idxStr);
    const key = INDEX2FUNC[idx] ?? null;
    if (!key) continue;
    const m = Number(mag) || 0;
    vec[key] += b * m;
  }
  return vec;
}

// ---------- 建立權重查表 ----------
// 回傳的是一個能「按題目 id + Likert 值 → 給 8 功能向量」的函式
function buildWeightResolver(weights){
  // case A: 物件表：{ [id]: entry }
  if (isPlainObject(weights)) {
    // 偵測是否為 AB 格式（抽一個看看）
    const anyKey = Object.keys(weights)[0];
    const sample = anyKey ? weights[anyKey] : null;
    const isAB = isABIndexEntry(sample);

    if (isAB) {
      // 直接用原物件
      return function resolve(id, likertVal){
        const entry = weights[id];
        if (!entry) return null;
        return buildVecFromABEntry(entry, likertVal);
      };
    } else {
      // 向量式
      return function resolve(id, likertVal){
        const entry = weights[id];
        const base = normalizeWeightEntry_Vector(entry);
        if (!base) return null;
        // 直接向量用「分數 * 權重」；這裡沿用舊邏輯：value * vec
        const v = Number(likertVal);
        if (!Number.isFinite(v)) return base;
        const scaled = {};
        for (const k of ORDER) scaled[k] = (base[k] || 0) * v;
        return scaled;
      };
    }
  }

  // case B: 陣列表：[{id, ...}, ...]
  if (Array.isArray(weights)) {
    const map = new Map();
    let isAB = false;
    for (const w of weights) {
      const id = w?.id ?? w?.itemId ?? w?.key ?? w?.qid ?? w?.uuid;
      if (!id) continue;
      map.set(String(id), w);
      if (!isAB && isABIndexEntry(w)) isAB = true;
    }

    if (isAB) {
      return function resolve(id, likertVal){
        const entry = map.get(String(id));
        if (!entry) return null;
        return buildVecFromABEntry(entry, likertVal);
      };
    } else {
      return function resolve(id, likertVal){
        const entry = map.get(String(id));
        const base = normalizeWeightEntry_Vector(entry);
        if (!base) return null;
        const v = Number(likertVal);
        const scaled = {};
        for (const k of ORDER) scaled[k] = (base[k] || 0) * (Number.isFinite(v) ? v : 1);
        return scaled;
      };
    }
  }

  // 其他格式：無法解析
  return function resolve(){ return null; };
}

// ---------- 主計算 ----------
export function compute(answers, weights) {
  const resolve = buildWeightResolver(weights);
  const funcs = emptyVec();
  let used = 0;

  for (const ans of (answers || [])) {
    const id = ans?.id != null ? String(ans.id) : null;
    const value = Number(ans?.value);
    if (!id || !Number.isFinite(value)) continue;

    const vec = resolve(id, value);
    if (!vec) continue;
    used++;

    for (const k of ORDER) {
      funcs[k] += (vec[k] || 0);
    }
  }

  // 四向度（可依你實際公式調整）
  const E = (funcs.Ne + funcs.Se + funcs.Te + funcs.Fe);
  const I = (funcs.Ni + funcs.Si + funcs.Ti + funcs.Fi);
  const N = (funcs.Ni + funcs.Ne);
  const S = (funcs.Si + funcs.Se);
  const T = (funcs.Ti + funcs.Te);
  const F = (funcs.Fi + funcs.Fe);
  const J = (funcs.Te + funcs.Fe);
  const P = (funcs.Ne + funcs.Se);

  const dims = {
    EI: E - I,
    SN: N - S,
    TF: T - F,
    JP: J - P,
  };

  const mbti =
    (dims.EI > 0 ? 'E' : 'I') +
    (dims.SN > 0 ? 'N' : 'S') +
    (dims.TF > 0 ? 'T' : 'F') +
    (dims.JP > 0 ? 'J' : 'P');

  return { functions: funcs, dims, mbti, _usedAnswers: used };
}
