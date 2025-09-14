// docs/assets/js/lib/compute.js
// 純 JavaScript，無 TS 語法。提供 compute(answers, weights) -> { functions, dims, mbti }。

export const ORDER = ['Ni','Ne','Si','Se','Ti','Te','Fi','Fe'];

function emptyVec() {
  const o = {};
  for (const k of ORDER) o[k] = 0;
  return o;
}

// 從一個權重 entry 萃取出 8 功能向量（Ni..Fe）
function normalizeWeightEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const src = entry.func || entry.functions || entry.weights || entry.w || entry;
  const out = {};
  let found = false;
  for (const k of ORDER) {
    let v = src[k];
    if (typeof v === 'string') v = Number(v);
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v;
      found = true;
    } else {
      out[k] = 0;
    }
  }
  return found ? out : null;
}

// 建立 { itemId -> {Ni..Fe} } 對照
function buildWeightMap(weights) {
  const map = new Map();
  if (Array.isArray(weights)) {
    for (const w of weights) {
      const id = w?.id ?? w?.itemId ?? w?.key ?? w?.qid ?? w?.uuid;
      if (!id) continue;
      const vec = normalizeWeightEntry(w);
      if (!vec) continue;
      map.set(String(id), vec);
    }
  } else if (weights && typeof weights === 'object') {
    for (const [id, entry] of Object.entries(weights)) {
      const vec = normalizeWeightEntry(entry);
      if (!vec) continue;
      map.set(String(id), vec);
    }
  }
  return map;
}

// 主計算：把答案值(1..5) 乘以對應題目的功能權重並加總
export function compute(answers, weights) {
  const W = buildWeightMap(weights);
  const funcs = emptyVec();
  let used = 0;

  for (const ans of (answers || [])) {
    const id = ans?.id != null ? String(ans.id) : null;
    const value = Number(ans?.value);
    if (!id || !Number.isFinite(value)) continue;

    const vec = W.get(id);
    if (!vec) continue;
    used++;

    for (const k of ORDER) {
      funcs[k] += value * (vec[k] || 0);
    }
  }

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

  return { functions: funcs, dims, mbti, _usedAnswers: used, _itemsInWeights: W.size };
}
