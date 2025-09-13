// /docs/assets/js/ui/render-basic.js
import * as util from '../lib/util.js';
import * as loader from '../lib/loader.js';
import * as store from '../lib/store.js';

let __startedBasic = false;

export async function initRenderBasic(rootId = 'app') {
  if (__startedBasic) return; __startedBasic = true;

  let root = document.getElementById(rootId);
  if (!root) { root = document.createElement('div'); root.id = rootId; document.body.appendChild(root); }
  root.innerHTML = '';

  const title = document.createElement('h1');
  title.textContent = '基礎 32 題自測';
  root.appendChild(title);

  let items = await loader.loadItemsBasic();
  if (!Array.isArray(items) || items.length === 0) {
    const p = document.createElement('p'); p.textContent = '找不到題庫資料（items_public_32.json）。'; root.appendChild(p); return;
  }

  const pickStem  = (it)=> it.stem ?? it.prompt ?? it.title ?? it.desc ?? it.description ?? '';
  const pickTextA = (it)=> (Array.isArray(it.options)? it.options[0]:undefined) ?? it.A ?? it.a ?? it.optionA ?? it.textA ?? it.left ?? it.l ?? it.statementA ?? '';
  const pickTextB = (it)=> (Array.isArray(it.options)? it.options[1]:undefined) ?? it.B ?? it.b ?? it.optionB ?? it.textB ?? it.right ?? it.r ?? it.statementB ?? '';
  const pickId    = (it,i)=> it.id ?? it._id ?? it.key ?? `q${i+1}`;

  const originalOrder = items.map((it,i)=>pickId(it,i));
  items = util.shuffle(items.slice());

  const hint = document.createElement('p');
  hint.innerHTML = `請在每題的 A 與 B 之間做傾向選擇：<br/><strong>非常同意A、較同意A、中立、較同意B、非常同意B</strong><br/>（僅顯示敘述，不顯示任何功能名稱）`;
  root.appendChild(hint);

  const progressWrap=document.createElement('div'); progressWrap.style.margin='12px 0';
  const progressText=document.createElement('div'); progressText.textContent=`0 / ${items.length}`;
  const progressBar=document.createElement('div'); progressBar.style.cssText='height:8px;background:#eee;border-radius:999px;overflow:hidden';
  const progressInner=document.createElement('div'); progressInner.style.cssText='height:100%;width:0%;background:var(--accent,#4caf50)';
  progressBar.appendChild(progressInner); progressWrap.appendChild(progressText); progressWrap.appendChild(progressBar); root.appendChild(progressWrap);

  const form=document.createElement('form'); form.autocomplete='off'; form.noValidate=true; root.appendChild(form);

  const SCALE=[{label:'非常同意A',value:-2},{label:'較同意A',value:-1},{label:'中立',value:0},{label:'較同意B',value:1},{label:'非常同意B',value:2}];
  const answerMap=new Map();

  items.forEach((it,idx)=>{
    const qId=pickId(it,idx);
    const stem=String(pickStem(it)??'').trim();
    const textA=String(pickTextA(it)??'').trim();
    const textB=String(pickTextB(it)??'').trim();

    const block=document.createElement('section'); block.className='q-block'; block.style.cssText='border:1px solid var(--line,#ddd);border-radius:8px;padding:12px;margin:12px 0';
    const head=document.createElement('div'); head.style.cssText='font-weight:600;margin-bottom:8px'; head.textContent=`第 ${idx+1} 題`; block.appendChild(head);

    if(stem){ const stemEl=document.createElement('div'); stemEl.style.cssText='margin-bottom:8px;color:var(--fg-muted,#64748b);font-size:14px;'; stemEl.textContent=stem; block.appendChild(stemEl); }

    const abRow=document.createElement('div'); abRow.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:12px';
    const aBox=document.createElement('div'); aBox.innerHTML=`<div style="font-size:12px;opacity:.75;">A</div><div>${escapeHTML(textA)}</div>`; aBox.style.cssText='border:1px dashed var(--line,#ddd);border-radius:6px;padding:8px';
    const bBox=document.createElement('div'); bBox.innerHTML=`<div style="font-size:12px;opacity:.75;">B</div><div>${escapeHTML(textB)}</div>`; bBox.style.cssText='border:1px dashed var(--line,#ddd);border-radius:6px;padding:8px';
    abRow.appendChild(aBox); abRow.appendChild(bBox); block.appendChild(abRow);

    const scaleRow=document.createElement('div'); scaleRow.style.cssText=`display:grid;grid-template-columns:repeat(${SCALE.length},1fr);gap:8px;margin-top:10px`;
    const groupName=`q_${qId}`;
    SCALE.forEach(opt=>{
      const cell=document.createElement('label'); cell.style.cssText='display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;border:1px solid var(--line,#ddd);border-radius:6px;cursor:pointer';
      const radio=document.createElement('input'); radio.type='radio'; radio.name=groupName; radio.value=String(opt.value);
      radio.addEventListener('change',()=>{ answerMap.set(groupName, Number(radio.value)); updateProgress(); });
      const small=document.createElement('small'); small.textContent=opt.label;
      cell.appendChild(radio); cell.appendChild(small); scaleRow.appendChild(cell);
    });
    block.appendChild(scaleRow); form.appendChild(block);
  });

  const actions=document.createElement('div'); actions.style.cssText='display:flex;gap:12px;margin:16px 0';
  const btnSubmit=document.createElement('button'); btnSubmit.type='submit'; btnSubmit.textContent='送出並查看結果';
  btnSubmit.style.cssText='padding:10px 14px;border-radius:8px;border:none;background:var(--accent,#4caf50);color:#fff;font-weight:600';
  const btnReset=document.createElement('button'); btnReset.type='button'; btnReset.textContent='清除未送出作答';
  btnReset.style.cssText='padding:10px 14px;border-radius:8px;border:1px solid var(--line,#ddd)';
  btnReset.addEventListener('click',()=>{ form.reset(); answerMap.clear(); updateProgress(); });
  actions.appendChild(btnSubmit); actions.appendChild(btnReset); root.appendChild(actions);

  // 強化 submit：一定跳頁
  form.addEventListener('submit',(e)=>{
    e.preventDefault();
    try{
      const total=items.length;
      const names=items.map((it,idx)=>`q_${pickId(it,idx)}`);
      const missing=names.filter(n=>!answerMap.has(n));
      if(missing.length>0){ alert(`尚有 ${missing.length} 題未作答，請完成所有題目。`); return; }

      const answers=[], orderCurrent=[];
      items.forEach((it,idx)=>{ const id=pickId(it,idx); const val=Number(answerMap.get(`q_${id}`)); answers.push(val); orderCurrent.push(id); });

      const session={
        id: util.uuid(), kind:'basic', createdAt: util.nowISO(), version:1,
        meta:{ total, scale:'A/B 5-point (-2..2)' },
        originalOrder, order: orderCurrent,
        items: items.map((it,idx)=>({ id:pickId(it,idx), stem:String(pickStem(it)??''), A:String(pickTextA(it)??''), B:String(pickTextB(it)??'') })),
        answers,
      };

      let saved=false;
      try{ store.saveResult(session); saved=true; }
      catch(err){
        console.warn('[basic submit] saveResult 失敗，寫入 fallback：', err);
        try{ const k='__results_fallback'; const list=JSON.parse(localStorage.getItem(k)||'[]'); list.unshift({id:session.id, session, savedAt: util.nowISO()}); localStorage.setItem(k, JSON.stringify(list.slice(0,20))); saved=true; }
        catch(e2){ console.error('[basic submit] fallback 也失敗：', e2); }
      }
      console.debug('[basic submit] navigate, saved=', saved, 'id=', session.id);
      location.assign(`result.html?id=${encodeURIComponent(session.id)}`);
    }catch(fatal){ console.error('[basic submit] fatal:', fatal); alert('送出發生錯誤：'+(fatal?.message||fatal)); }
  });

  function updateProgress(){ const answered=answerMap.size, total=items.length; progressText.textContent=`${answered} / ${total}`; const pct=total>0?Math.round(answered/total*100):0; progressInner.style.width=`${pct}%`; }
  function escapeHTML(s){ return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
}
// ★ 檔尾不自動啟動（原檔的自啟動要移除）