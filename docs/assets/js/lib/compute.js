// docs/assets/js/lib/compute.js
// Pure scoring + inference (no UI).
//
// Input (typical):
//   answers: Array<number>           // Likert-like scores aligned to items order
//   weights: {
//     items: Array< ItemWeight >,    // per-item function weights (map or vector)
//     scale?: number,                // max choice value (e.g., 5 or 7) — optional
//     // optional dimensional projections (any ONE of the following forms):
//     dims?: Record<string, Record<string, number>>          // e.g. { EI:{Ni:-1, ...}, SN:{...}, ... }
//     dimsMatrix?: Record<string, number[]>                   // arrays in canonical order
//     dimsFrom?: 'functions'|'raw'                            // default 'functions'
//   }
//
// ItemWeight (supported shapes):
//   • { id: string, w: Record<'Ni'|'Ne'|'Si'|'Se'|'Ti'|'Te'|'Fi'|'Fe', number> }
//   • { id: string, v: number[8] }   // canonical order (see ORDER below)
//
// Output:
//   {
//     functions: Record<FnKey, number>,      // raw sums by 8 functions
//     dims: { EI:number, SN:number, TF:number, JP:number }, // signed scores (+/-)
//     mbti: string,                           // e.g. "INTJ"
//     order: FnKey[],                         // functions ranked by strength (desc)
//     meta: { maxAnswer:number, totalItems:number }
//   }
//
// Notes:
//   • This file intentionally keeps the math generic to accommodate your existing JSON.
//   • If your weight JSON already contains a ready-made dims projection, it will be used.
//   • If not, a reasonable fallback matrix is applied (see FALLBACK_DIMS).
//   • Ties produce "X" on that letter (e.g., "INxJ"). You can change TIE_POLICY below.
//

import { assert } from './util.js';

// Canonical function order used when vectors (arrays) are provided.
export const ORDER = ['Ni','Ne','Si','Se','Ti','Te','Fi','Fe'] as const;
export type FnKey = typeof ORDER[number];

// ────────────────────────────── helpers ──────────────────────────────

/** Normalize an object to contain all 8 functions (missing -> 0). */
function normalizeFnMap(input: Partial<Record<FnKey, number>> | undefined): Record<FnKey, number> {
  const out: Record<FnKey, number> = { Ni:0, Ne:0, Si:0, Se:0, Ti:0, Te:0, Fi:0, Fe:0 };
  if (!input) return out;
  for (const k of ORDER) out[k] = Number(input[k] ?? 0);
  return out;
}

/** Convert array vector → map by ORDER. */
function vecToMap(vec: number[] | undefined): Record<FnKey, number> {
  const out: Record<FnKey, number> = { Ni:0, Ne:0, Si:0, Se:0, Ti:0, Te:0, Fi:0, Fe:0 };
  if (!Array.isArray(vec)) return out;
  for (let i = 0; i < Math.min(vec.length, ORDER.length); i++) {
    out[ORDER[i]] = Number(vec[i] ?? 0);
  }
  return out;
}

/** Add scaled map B*(scale) into A in-place. */
function addScaled(A: Record<FnKey, number>, B: Record<FnKey, number>, scale=1) {
  for (const k of ORDER) A[k] += (B[k] ?? 0) * scale;
}

/** Dot product map·map (keys in ORDER). */
function dot(a: Record<FnKey, number>, b: Record<FnKey, number>): number {
  let s = 0;
  for (const k of ORDER) s += (a[k] ?? 0) * (b[k] ?? 0);
  return s;
}

/** Build dims projection matrix. */
function buildDimsMatrix(weights: any): Record<'EI'|'SN'|'TF'|'JP', Record<FnKey, number>> {
  // 1) Use explicit dims (named maps)
  if (weights && weights.dims) {
    const m = weights.dims;
    return {
      EI: normalizeFnMap(m.EI),
      SN: normalizeFnMap(m.SN),
      TF: normalizeFnMap(m.TF),
      JP: normalizeFnMap(m.JP),
    };
  }
  // 2) Use dimsMatrix arrays
  if (weights && weights.dimsMatrix) {
    const M = weights.dimsMatrix;
    return {
      EI: vecToMap(M.EI),
      SN: vecToMap(M.SN),
      TF: vecToMap(M.TF),
      JP: vecToMap(M.JP),
    };
  }
  // 3) Fallback: a common, reasonable heuristic projection
  //    +EI from extroverted attitudinal functions (Ne, Se, Te, Fe)
  //    +SN toward N from (Ni, Ne) vs S from (Si, Se)
  //    +TF toward T from (Ti, Te) vs F from (Fi, Fe)
  //    +JP: Judging from (Te, Fe, Ti) vs Perceiving from (Ne, Se, Ni, Si) — mild, symmetric
  const FALLBACK_DIMS: Record<'EI'|'SN'|'TF'|'JP', Record<FnKey, number>> = {
    EI: { Ni:-0.5, Ne:+0.5, Si:-0.5, Se:+0.5, Ti:-0.5, Te:+0.5, Fi:-0.5, Fe:+0.5 },
    SN: { Ni:+0.5, Ne:+0.5, Si:-0.5, Se:-0.5, Ti:0, Te:0, Fi:0, Fe:0 },
    TF: { Ni:0, Ne:0, Si:0, Se:0, Ti:+0.6, Te:+0.6, Fi:-0.6, Fe:-0.6 },
    JP: { Ni:-0.25, Ne:-0.25, Si:-0.25, Se:-0.25, Ti:+0.35, Te:+0.35, Fi:+0.35, Fe:+0.35 },
  };
  // Ensure complete maps:
  for (const key of Object.keys(FALLBACK_DIMS)) {
    FALLBACK_DIMS[key as 'EI'|'SN'|'TF'|'JP'] = normalizeFnMap(FALLBACK_DIMS[key as any]);
  }
  return FALLBACK_DIMS;
}

/** Choose letter with tie policy. */
const TIE_POLICY = 'X'; // 'X' or chooseLeft or chooseRight
function letterFrom(sign: number, left: string, right: string): string {
  if (sign > 0) return right;       // positive → right letter (e.g., +EI => 'E' vs 'I' depends how we define)
  if (sign < 0) return left;
  if (TIE_POLICY === 'X') return left + right === 'IJ' ? 'X' : 'X'; // just 'X'
  if (TIE_POLICY === 'chooseLeft') return left;
  return right;
}

// For clarity, we define dims as signed towards the FIRST letter NEGATIVE and SECOND letter POSITIVE:
//   EI: negative => I, positive => E
//   SN: negative => S, positive => N
//   TF: negative => F, positive => T
//   JP: negative => P, positive => J
function mbtiFromDims(d: {EI:number, SN:number, TF:number, JP:number}): string {
  const IorE = letterFrom(d.EI, 'I', 'E');
  const SorN = letterFrom(d.SN, 'S', 'N');
  const ForT = letterFrom(d.TF, 'F', 'T');
  const PorJ = letterFrom(d.JP, 'P', 'J');
  return `${IorE}${SorN}${ForT}${PorJ}`;
}

/** Rank functions by value desc; stable by ORDER. */
function rankFunctions(f: Record<FnKey, number>): FnKey[] {
  return ORDER
    .slice()
    .sort((a, b) => (f[b] - f[a]) || (ORDER.indexOf(a) - ORDER.indexOf(b)));
}

// ────────────────────────────── main API ──────────────────────────────

/**
 * Compute per-function sums from answers + weights.
 * answers[i] is multiplied by the i-th item's function vector.
 */
export function computeFunctions(
  answers: number[],
  weights: {
    items: Array<{ id?: string, w?: Partial<Record<FnKey, number>>, v?: number[] }>,
  }
): Record<FnKey, number> {
  assert(Array.isArray(answers), 'answers must be an array');
  assert(weights && Array.isArray(weights.items), 'weights.items must be an array');

  const totals: Record<FnKey, number> = { Ni:0, Ne:0, Si:0, Se:0, Ti:0, Te:0, Fi:0, Fe:0 };
  const n = Math.min(answers.length, weights.items.length);

  for (let i = 0; i < n; i++) {
    const a = Number(answers[i] ?? 0) || 0;
    const row = weights.items[i] || {};
    const vec = row.w ? normalizeFnMap(row.w) : vecToMap(row.v);
    addScaled(totals, vec, a);
  }
  return totals;
}

/**
 * Project function totals to dichotomy dimensions with a matrix.
 */
export function computeDims(
  fnTotals: Record<FnKey, number>,
  weights?: any
): { EI:number, SN:number, TF:number, JP:number } {
  const M = buildDimsMatrix(weights);
  // By convention here: negative towards first letter, positive towards second.
  // We define matrices accordingly in buildDimsMatrix.
  return {
    EI: dot(fnTotals, M.EI),
    SN: dot(fnTotals, M.SN),
    TF: dot(fnTotals, M.TF),
    JP: dot(fnTotals, M.JP),
  };
}

/**
 * High-level one-shot computation.
 * @param {{
 *   answers: number[],
 *   weights: any,
 * }} input
 * @returns {{
 *   functions: Record<FnKey, number>,
 *   dims: {EI:number,SN:number,TF:number,JP:number},
 *   mbti: string,
 *   order: FnKey[],
 *   meta: { maxAnswer:number, totalItems:number }
 * }}
 */
export function computeAll(input: { answers: number[], weights: any }) {
  const { answers, weights } = input || {};
  assert(Array.isArray(answers), 'computeAll: answers must be an array');
  assert(weights && Array.isArray(weights.items), 'computeAll: weights.items missing');

  const functions = computeFunctions(answers, weights);
  const dims = computeDims(functions, weights);
  const mbti = mbtiFromDims(dims);
  const order = rankFunctions(functions);
  const meta = {
    maxAnswer: Number(weights.scale || 0) || 0,
    totalItems: Math.min(answers.length, weights.items.length),
  };

  return { functions, dims, mbti, order, meta };
}

// ────────────────────────────── dev hook ──────────────────────────────

try {
  if (typeof window !== 'undefined') {
    // Minimal console smoke test helper:
    (window as any).Compute = (window as any).Compute || { computeAll, computeFunctions, computeDims, ORDER };
  }
} catch { /* noop */ }

export default { computeAll, computeFunctions, computeDims, ORDER };