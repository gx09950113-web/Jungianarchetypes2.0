// docs/assets/js/ui/render-basic.js
(function () {
  const DRAFT_KEY = 'jung_basic_draft_v1';

  // ---------- 小工具 ----------
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  function el(tag, props={}, children=[]) {
    const node = document.createElement(tag);
    for (const [k,v] of Object.entries(props)) {
      if (v == null) continue;
      if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k in node) node[k] = v;
      else node.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }
  const storage = {
    load() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; } },
    save(v){ localStorage.setItem(DRAFT_KEY, JSON.stringify(v || {})); },
    clear(){ localStorage.removeItem(DRAFT_KEY); }
  };

  // ---------- 資料載入（優先用你的 loader，否則用 fallback 抓 JSON） ----------
  async function loadWithLoader() {
    // 動態 import：若沒用 ES Module 也不會炸，會丟到 catch
    const mod = await import('../lib/loader.js');
    const items = await mod.loadItemsBasic(); // 會自動處理各種路徑
    return items;
  }
  async function fetchJSON(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  }
  function candidateBases() {
    const bases = ['./data','../data','/data','./docs/data','../docs/data'];
    try {
      const u = new URL(document.baseURI);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 1) {
        const repo = `/${parts[0]}`;
        for (const p of [`${repo}/data`, `${repo}/docs/data`]) {
          if (!bases.includes(p)) bases.push(p);
        }
      }
    } catch {}
    return [...new Set(bases)];
  }
  async function loadWithFallback() {
    const rel = 'items_public_32.json';
    const bases = candidateBases();
    const errs = [];
    for (const b of bases) {
      const url = `${b}/${rel}`.replace(/\/{2,}/g,'/');
      try { return await fetchJSON(url); }
      catch (e) { errs.push(`${url} → ${e.message}`); }
    }
    throw new Error(`[render-basic] 無法載入 ${rel}\n候選：\n- ${bases.join('\n- ')}\n錯誤：\n- ${errs.join('\n- ')}`);
  }
  async function loadItemsBasic() {
    try { return await loadWithLoader(); }
    catch { return await loadWithFallback(); }
  }

  // ---------- UI：Likert（5點，固定 A/B 文案） ----------
  function Likert({ name, value=null }) {
    const labels = ['非常同意A','較同意A','我不知道','較同意B','非常同意B'];
    const ul = el('ul', {
      class: 'likert',
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(56px,1fr))',
        gap: '8px', alignItems: 'center',
        margin: '12px 0 4px', padding: 0, listStyle: 'none'
      }
    });
    for (let i = 1; i <= 5; i++) {
      const id = `${name}-${i}`;
      ul.appendChild(
        el('li', { style: { display:'flex', flexDirection:'column', alignItems:'center', gap:'6px' } }, [
          el('input', { id, name, type:'radio', value:String(i), checked:(value == i), style:{ width:'18px', height:'18px', cursor:'pointer' } }),
          el('label', { htmlFor:id, class:'muted small', style:{ fontSize:'12px', color:'var(--fg-muted,#64748b)', textAlign:'center', userSelect:'none' } }, labels[i-1])
        ])
      );
    }
    return ul;
  }

  // ---------- UI：單題卡片 ----------
  function renderItemCard(item, savedVal) {
    const stem = item.stem ?? item.text ?? '';
    const [optA, optB] = Array.isArray(item.options) ? item.options : [null, null];

    const header = el('div', { class:'q-head', style:{ display:'flex', alignItems:'baseline', gap:'8px', marginBottom:'8px' } }, [
      el('div', { class:'qid', style:{ fontWeight:600, color:'var(--fg-muted,#64748b)' } }, item.id),
      el('div', { class:'q-stem', style:{ fontSize:'16px', lineHeight:1.6 } }, stem)
    ]);

    const abRow = (optA || optB) ? el('div', {
      class:'ab-row',
      style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginTop:'6px' }
    }, [
      el('div', { class:'optA', style:{ fontSize:'13px', color:'var(--fg-muted,#64748b)' } }, ['A．', optA || '（選項A）']),
      el('div', { class:'optB', style:{ fontSize:'13px', color:'var(--fg-muted,#64748b)', textAlign:'right' } }, [optB || '（選項B）', ' ．B'])
    ]) : null;

    return el('section', {
      class:'q-card', 'data-qid': item.id,
      style:{
        border:'1px solid var(--border,#e2e8f0)', borderRadius:'12px',
        padding:'16px', margin:'12px 0', background:'var(--card,#fff)'
      }
    }, [
      header,
      abRow,
      Likert({ name:item.id, value:savedVal })
    ]);
  }

  // ---------- 主渲染 ----------
  async function renderBasicImpl() {
    const root = $('#app') || document.body;
    root.innerHTML = '';

    // 標頭 + 進度
    root.appendChild(
      el('div', { style:{ margin:'8px 0 12px' } }, [
        el('p', { class:'muted', style:{ color:'var(--fg-muted,#64748b)', fontSize:'14px' } },
          '請依直覺作答。每題提供 A / B 兩側描述，量尺代表你傾向哪一側；沒有對錯之分。')
      ])
    );
    const progWrap = el('div', {
      id:'progress',
      style:{ display:'flex', alignItems:'center', gap:'10px', margin:'8px 0 16px', fontSize:'14px' }
    }, [
      el('div', { id:'progText' }, '完成度 0 / 0'),
      el('div', { style:{ flex:'1 1 auto', height:'8px', background:'var(--accent-50,#eff6ff)', borderRadius:'999px', overflow:'hidden' } }, [
        el('div', { id:'progBar', style:{ width:'0%', height:'100%', background:'var(--accent,#2563eb)' } })
      ])
    ]);
    root.appendChild(progWrap);

    // 載入題庫（優先 loader）
    let items = await loadItemsBasic();
    // 保險：確保有 id/stem/options
    items = items.map((it, i) => ({
      id: it.id ?? `q_${i+1}`,
      stem: (it.stem ?? it.text ?? '').trim(),
      options: Array.isArray(it.options) ? it.options.slice(0,2) : [null, null]
    }));

    // 草稿
    const draft = storage.load();

    // 題目列表
    const list = el('div', { id:'qList' });
    items.forEach(it => list.appendChild(renderItemCard(it, draft[it.id] || null)));
    root.appendChild(list);

    // 進度更新
    const updateProgress = () => {
      const total = items.length;
      const done = items.reduce((n, it) => n + (draft[it.id] ? 1 : 0), 0);
      $('#progText').textContent = `完成度 ${done} / ${total}`;
      $('#progBar').style.width = `${total ? Math.round(done/total*100) : 0}%`;
    };

    // 即時存草稿
    list.addEventListener('change', (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || input.type !== 'radio') return;
      draft[input.name] = input.value; // 1..5
      storage.save(draft);
      updateProgress();
    });

    // 清除草稿按鈕
    const clearBtn = $('#clear, [data-role="clear"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        storage.clear();
        Object.keys(draft).forEach(k => delete draft[k]);
        $$('#qList input[type="radio"]:checked').forEach(r => (r.checked = false));
        updateProgress();
        console.log('[basic] 已清除暫存答案');
      });
    }

    // 初始進度
    updateProgress();

    // 可選：鍵盤左右切換選項（提升體驗）
    list.addEventListener('keydown', (e) => {
      if (!['ArrowLeft','ArrowRight'].includes(e.key)) return;
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || input.type !== 'radio') return;
      const name = input.name;
      const current = Number(input.value);
      const next = e.key === 'ArrowLeft' ? Math.max(1, current - 1) : Math.min(5, current + 1);
      const nxt = $(`#qList input[name="${CSS.escape(name)}"][value="${next}"]`);
      if (nxt) { nxt.focus(); nxt.click(); }
      e.preventDefault();
    });
  }

  // 掛到全域
  window.renderBasic = renderBasicImpl;
})();
