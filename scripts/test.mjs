// scripts/test.mjs
// 以 Node 在 CLI 測 "資料檔 + 計分邏輯（compute.js）" 是否正常。
// 不依賴瀏覽器環境，不呼叫你前端的 loader.js（避免 fetch/DOM 差異）。

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

// ---- 重要：這裡直接用 compute.js（純邏輯） ----
// 路徑：docs/assets/js/lib/compute.js
// 你現有的 compute.js 需輸出名為 compute 的方法：compute(answers, weights) -> { functions, dims, mbti }
import * as compute from '../docs/assets/js/lib/compute.js';

// ------- 小工具 -------
const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'docs', 'data');

async function readJSON(relPath) {
  const abs = path.join(DATA_DIR, relPath);
  const buf = await fs.readFile(abs);
  return JSON.parse(buf.toString('utf8'));
}

function assert(cond, msg) {
  if (!cond) throw new Error('[ASSERT] ' + msg);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 產生一組隨機 Likert 作答（1~5）
function makeRandomAnswers(items) {
  return items.map(it => {
    const id = it.id ?? it.key ?? it.qid ?? it.uuid ?? null;
    assert(id != null, 'items 內缺少 id（或 key/qid/uuid）。請確認題庫每題有穩定的識別鍵。');
    return { id, value: randInt(1, 5) };
  });
}

// 嘗試推斷 "權重檔" 是否能對應題目 id（寬鬆檢查）
function extractWeightIds(weights) {
  // 常見情形1：Array，每個元素有 id/itemId
  if (Array.isArray(weights)) {
    return weights.map(w => w.id ?? w.itemId ?? w.key ?? null).filter(Boolean);
  }
  // 常見情形2：Object：{ [itemId]: {...} }
  if (weights && typeof weights === 'object') {
    return Object.keys(weights);
  }
  return [];
}

function topKFromObj(obj, k = 3) {
  return Object.entries(obj ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([key, val]) => `${key}:${Number(val).toFixed(2)}`);
}

// ------- 載入資料集 -------
async function loadDataset(kind = 'basic', set = 'A') {
  if (kind === 'basic') {
    const items = await readJSON('items_public_32.json');
    const weights = await readJSON(path.join('weights', 'weights_32.json'));
    return { label: 'Basic(32)', items, weights };
  }
  if (kind === 'adv') {
    const upper = String(set).toUpperCase();
    assert(['A', 'B', 'C'].includes(upper), '進階題組 set 需為 A/B/C');
    const items = await readJSON(`items_public_adv_${upper}.json`);
    const weights = await readJSON(path.join('weights', `weights_adv_${upper}.json`));
    return { label: `Advanced(${upper})`, items, weights };
  }
  throw new Error(`未知的 kind: ${kind}`);
}

// ------- 主流程 -------
async function runOne(kind, set) {
  const { label, items, weights } = await loadDataset(kind, set);

  console.log(`\n=== 測試：${label} ===`);
  console.log(`題目數：${items.length}`);

  // 寬鬆檢查題目/權重對齊（只做提示，不阻斷）
  const itemIds = new Set(items.map(it => it.id ?? it.key ?? it.qid ?? it.uuid).filter(Boolean));
  const weightIds = new Set(extractWeightIds(weights));
  if (weightIds.size > 0) {
    // 若權重有可抽出的 id，就做交集比對
    const missInWeights = [...itemIds].filter(id => !weightIds.has(id));
    if (missInWeights.length) {
      console.warn(`! 警告：有 ${missInWeights.length} 題的 id 在權重中找不到對應（列出前 5 筆）：`, missInWeights.slice(0, 5));
    }
  } else {
    console.warn('! 注意：無法從權重檔抽出題目 id（可能你的 weights 結構不含每題 id，這不一定是錯）。');
  }

  // 產生隨機答案並計算
  const answers = makeRandomAnswers(items);

  let result;
  try {
    result = compute.compute(answers, weights);
  } catch (e) {
    console.error('❌ compute.compute 執行失敗：', e.message);
    console.error('（排查建議）請檢查：');
    console.error('1) answers 物件是否為 [{id, value}] 且 value 在 1~5。');
    console.error('2) weights 結構是否符合你的 compute.js 預期。');
    console.error('3) ids 是否一致（items vs weights）。');
    process.exit(1);
  }

  // 輸出摘要
  const { functions, dims, mbti } = result ?? {};
  console.log('八維 Top3：', topKFromObj(functions));
  console.log('四向度：', dims ?? '(無)');
  console.log('MBTI：', mbti ?? '(無)');

  // 進階：基本合理性檢查
  if (functions) {
    const hasNaN = Object.values(functions).some(v => Number.isNaN(Number(v)));
    assert(!hasNaN, '八維結果出現 NaN，請檢查 compute 或 weights 的計算過程。');
  }
  console.log('✅ 通過（讀檔 + 計分）');
}

async function main() {
  const [, , mode = 'basic', set = 'A'] = process.argv;

  if (mode === 'basic') {
    await runOne('basic');
    return;
  }
  if (mode === 'adv') {
    await runOne('adv', set);
    return;
  }
  if (mode === 'all') {
    await runOne('basic');
    await runOne('adv', 'A');
    await runOne('adv', 'B');
    await runOne('adv', 'C');
    return;
  }

  console.log('用法：');
  console.log('  node scripts/test.mjs basic');
  console.log('  node scripts/test.mjs adv A');
  console.log('  node scripts/test.mjs adv B');
  console.log('  node scripts/test.mjs adv C');
  console.log('  node scripts/test.mjs all');
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
