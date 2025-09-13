/*! chart.umd.js (lite polyfill) — supports 'radar' and 'bar' only.
 *  If real Chart.js exists on window, this file does nothing.
 *  Drop-in path: /docs/assets/js/vendor/chart.umd.js
 */
(function (global) {
  if (global.Chart) return; // If official Chart.js is loaded, use it.

  // --------- utilities ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function dpiCanvas(canvas) {
    const dpr = global.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  function measureText(ctx, text, font) {
    if (font) ctx.font = font;
    const m = ctx.measureText(text);
    return { w: m.width, h: (m.actualBoundingBoxAscent || 10) + (m.actualBoundingBoxDescent || 2) };
  }
  function toRGBA(hex, alpha) {
    if (!hex) return `rgba(0,0,0,${alpha ?? 1})`;
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) {
      // replace last alpha if rgba
      if (hex.startsWith('rgba')) {
        return hex.replace(/rgba\(([^)]+),\s*([0-9.]+)\)/, (m, rgb, _a) => `rgba(${rgb}, ${alpha ?? 1})`);
      }
      return hex.replace(/rgb\(([^)]+)\)/, (m, rgb) => `rgba(${rgb}, ${alpha ?? 1})`);
    }
    // #RRGGBB
    const c = hex.replace('#', '');
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha ?? 1})`;
  }

  // --------- minimal Chart class ----------
  class MiniChart {
    constructor(ctx, config) {
      this.ctx = ctx.canvas ? ctx : ctx.getContext ? ctx.getContext('2d') : ctx;
      this.canvas = this.ctx.canvas || ctx;
      this.config = JSON.parse(JSON.stringify(config || {}));
      this._onResize = () => this.update();
      global.addEventListener('resize', this._onResize);
      this.update();
    }

    update() {
      const ctx = dpiCanvas(this.canvas);
      if (!ctx) return;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      const type = (this.config.type || '').toLowerCase();
      if (type === 'radar') {
        this._drawRadar(ctx);
      } else if (type === 'bar') {
        this._drawBar(ctx);
      } else {
        // graceful message
        ctx.save();
        ctx.fillStyle = '#999';
        ctx.font = '14px system-ui, -apple-system, Segoe UI, Arial';
        ctx.fillText(`MiniChart: unsupported type "${type}"`, 10, 20);
        ctx.restore();
      }
    }

    destroy() {
      global.removeEventListener('resize', this._onResize);
    }

    // --------- Radar (八維雷達) ----------
    _drawRadar(ctx) {
      const cfg = this.config;
      const labels = (cfg.data && cfg.data.labels) || [];
      const datasets = (cfg.data && cfg.data.datasets) || [];
      const n = labels.length;
      if (!n) return;

      const W = this.canvas.getBoundingClientRect().width;
      const H = this.canvas.getBoundingClientRect().height;
      const pad = 24;
      const cx = W / 2, cy = H / 2;
      const rMax = Math.max(10, Math.min(W, H) / 2 - pad);

      // derive max value
      let maxVal = 0;
      datasets.forEach(ds => {
        (ds.data || []).forEach(v => { if (typeof v === 'number') maxVal = Math.max(maxVal, v); });
      });
      if (maxVal <= 0) maxVal = 1;

      // grid levels
      const levels = 4;
      ctx.save();
      ctx.strokeStyle = '#ddd';
      ctx.fillStyle = '#666';
      ctx.lineWidth = 1;

      for (let lv = 1; lv <= levels; lv++) {
        const rr = (rMax * lv) / levels;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const ang = (-Math.PI / 2) + (i * 2 * Math.PI / n);
          const x = cx + rr * Math.cos(ang);
          const y = cy + rr * Math.sin(ang);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // axes & labels
      ctx.strokeStyle = '#ccc';
      ctx.font = '12px system-ui, -apple-system, Segoe UI, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        const ang = (-Math.PI / 2) + (i * 2 * Math.PI / n);
        const x = cx + rMax * Math.cos(ang);
        const y = cy + rMax * Math.sin(ang);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.stroke();

        // label outwards slightly
        const lx = cx + (rMax + 14) * Math.cos(ang);
        const ly = cy + (rMax + 14) * Math.sin(ang);
        ctx.fillStyle = '#444';
        ctx.fillText(String(labels[i]), lx, ly);
      }

      // datasets polygons
      datasets.forEach((ds, idx) => {
        const data = ds.data || [];
        const stroke = ds.borderColor || '#007aff';
        const fill = ds.backgroundColor ? toRGBA(ds.backgroundColor, 0.25) : toRGBA(stroke, 0.15);
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const v = clamp(Number(data[i] || 0), 0, maxVal);
          const rr = (v / maxVal) * rMax;
          const ang = (-Math.PI / 2) + (i * 2 * Math.PI / n);
          const x = cx + rr * Math.cos(ang);
          const y = cy + rr * Math.sin(ang);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
      });

      ctx.restore();
    }

    // --------- Bar (四向度長條) ----------
    _drawBar(ctx) {
      const cfg = this.config;
      const labels = (cfg.data && cfg.data.labels) || [];
      const datasets = (cfg.data && cfg.data.datasets) || [];
      if (!labels.length || !datasets.length) return;

      // choose first dataset
      const ds = datasets[0];
      const data = ds.data || [];
      const W = this.canvas.getBoundingClientRect().width;
      const H = this.canvas.getBoundingClientRect().height;

      const padding = { top: 10, right: 18, bottom: 26, left: 42 };
      // detect horizontal mode if options.indexAxis === 'y'
      const horizontal = (cfg.options && cfg.options.indexAxis === 'y') || false;

      // compute domain
      let maxVal = 0;
      data.forEach(v => { if (typeof v === 'number') maxVal = Math.max(maxVal, v); });
      if (maxVal <= 0) maxVal = 1;

      ctx.save();
      ctx.font = '12px system-ui, -apple-system, Segoe UI, Arial';
      ctx.fillStyle = '#444';
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 1;

      if (!horizontal) {
        // vertical bars
        const cw = W - padding.left - padding.right;
        const ch = H - padding.top - padding.bottom;
        const n = labels.length;
        const gap = 0.2; // 20% gap
        const bw = cw / n * (1 - gap);

        // axes
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + ch);
        ctx.lineTo(padding.left + cw, padding.top + ch);
        ctx.stroke();

        // bars
        for (let i = 0; i < n; i++) {
          const val = clamp(Number(data[i] || 0), 0, maxVal);
          const h = (val / maxVal) * ch;
          const x = padding.left + (i * (cw / n)) + (cw / n - bw) / 2;
          const y = padding.top + ch - h;

          ctx.fillStyle = ds.backgroundColor || '#7aa5ff';
          ctx.fillRect(x, y, bw, h);

          // label
          ctx.fillStyle = '#333';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(String(labels[i]), x + bw / 2, padding.top + ch + 6);
        }
      } else {
        // horizontal bars
        const cw = W - padding.left - padding.right;
        const ch = H - padding.top - padding.bottom;
        const n = labels.length;
        const gap = 0.2;
        const bh = ch / n * (1 - gap);

        // axes
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + ch);
        ctx.lineTo(padding.left + cw, padding.top + ch);
        ctx.stroke();

        // bars
        for (let i = 0; i < n; i++) {
          const val = clamp(Number(data[i] || 0), 0, maxVal);
          const w = (val / maxVal) * cw;
          const x = padding.left;
          const y = padding.top + (i * (ch / n)) + (ch / n - bh) / 2;

          ctx.fillStyle = ds.backgroundColor || '#7aa5ff';
          ctx.fillRect(x, y, w, bh);

          // y labels
          ctx.fillStyle = '#333';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(labels[i]), padding.left - 6, y + bh / 2);
        }
      }
      ctx.restore();
    }
  }

  // mimic Chart.js constructor API
  function Chart(ctx, config) {
    return new MiniChart(ctx, config);
  }
  Chart.version = 'mini-1.0.0';
  Chart.defaults = {}; // compatibility stub

  // UMD-ish export
  global.Chart = Chart;
})(typeof window !== 'undefined' ? window : globalThis);