// docs/assets/js/ui/render-basic.js
(function () {
  async function renderBasicImpl() {
    // === 這段先作為「探針」確認管線 ===
    const root = document.querySelector('#app') || document.body;
    // 清空舊內容（避免殘影）
    // root.innerHTML = ''; // 若你的渲染器會自行建立 DOM，打開這行

    if (!document.querySelector('#_basic_probe')) {
      const probe = document.createElement('div');
      probe.id = '_basic_probe';
      probe.textContent = 'renderBasic 已執行（請將此區塊替換為你的題目渲染邏輯）';
      probe.style.cssText = 'margin:12px 0;padding:12px;border:1px dashed #94a3b8;color:#475569;border-radius:8px;';
      root.prepend(probe);
    }

    // === TODO：把上面探針改成你的實際渲染 ===
    // 例如：
    // const items = await loader.loadItemsBasic();
    // renderQuestions(root, items);
    // bindScaleHandlers();
  }

  // 關鍵：掛到全域，讓入口檔能呼叫到
  window.renderBasic = renderBasicImpl;
})();
