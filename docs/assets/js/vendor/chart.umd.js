/*!
 * chart.umd.js — 軽量版本
 * 支援：radar / bar；簡單 legend、tooltip、軸與 label
 * 若 window.Chart 已存在，則不覆蓋，以便未來切回完整版 Chart.js
 */
(function (global) {
  if (global.Chart) return;

  // ---- Utilities ----
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function dpiCanvas(canvas) {
    const dpr = global.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width, height = rect.height;
    if (width === 0 || height === 0) return null;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  function toRGBA(hex, alpha) {
    if (!hex) return `rgba(0,0,0,${alpha ?? 1})`;
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) {
      if (hex.startsWith('rgba')) {
        return hex.replace(/rgba\(([^)]+),\s*([0-9.]+)\)/, (m, rgb, _a) => `rgba(${rgb}, ${alpha ?? 1})`);
      }
      return hex.replace(/rgb\(([^)]+)\)/, (m, rgb) => `rgba(${rgb}, ${alpha ?? 1})`);
    }
    const c = hex.replace('#', '');
    let r, g, b;
    if (c.length === 3) {
      // shorthand #rgb
      r = parseInt(c[0] + c[0], 16);
      g = parseInt(c[1] + c[1], 16);
      b = parseInt(c[2] + c[2], 16);
    } else {
      r = parseInt(c.slice(0,2), 16);
      g = parseInt(c.slice(2,4), 16);
      b = parseInt(c.slice(4,6), 16);
    }
    return `rgba(${r},${g},${b},${alpha ?? 1})`;
  }

  function measureText(ctx, text, font) {
    if (font) ctx.font = font;
    const m = ctx.measureText(text);
    return {
      width: m.width,
      height: (m.actualBoundingBoxAscent || 0) + (m.actualBoundingBoxDescent || 0) || 12
    };
  }

  // ---- MiniChart class ----
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
        ctx.save();
        ctx.fillStyle = '#999';
        ctx.font = '14px sans-serif';
        ctx.fillText(`MiniChart: unsupported type "${type}"`, 10, 20);
        ctx.restore();
      }

      if (this.config.options && this.config.options.plugins && this.config.options.plugins.legend) {
        this._drawLegend(ctx);
      }
    }

    destroy() {
      global.removeEventListener('resize', this._onResize);
    }

    // ---- Legend ----
    _drawLegend(ctx) {
      const cfg = this.config;
      const opt = cfg.options.plugins.legend;
      if (!opt || !cfg.data || !cfg.data.datasets) return;
      const datasets = cfg.data.datasets;
      const fontSize = opt.fontSize || 12;
      const padding = opt.padding || 10;
      const boxSize = opt.boxSize || 12;
      const pos = opt.position || 'top'; // only top or bottom
      ctx.save();
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textBaseline = 'middle';
      const totalWidth = datasets.reduce((sum, ds) => {
        const label = ds.label || '';
        const m = ctx.measureText(label);
        return sum + boxSize + 4 + m.width + padding;
      }, 0);
      const canvasWidth = this.canvas.getBoundingClientRect().width;
      let x = (canvasWidth - totalWidth) / 2;
      let y;
      if (pos === 'top') {
        y = padding + fontSize / 2;
      } else {
        const H = this.canvas.getBoundingClientRect().height;
        y = H - padding - fontSize / 2;
      }
      datasets.forEach((ds) => {
        // box
        ctx.fillStyle = ds.backgroundColor || '#007aff';
        ctx.fillRect(x, y - boxSize/2, boxSize, boxSize);
        // label
        ctx.fillStyle = ds.borderColor || '#000';
        ctx.textAlign = 'left';
        ctx.fillText(ds.label || '', x + boxSize + 4, y);
        x += boxSize + 4 + ctx.measureText(ds.label || '').width + padding;
      });
      ctx.restore();
    }

    // ---- Radar chart ----
    _drawRadar(ctx) {
      const cfg = this.config;
      const labels = (cfg.data && cfg.data.labels) || [];
      const datasets = (cfg.data && cfg.data.datasets) || [];
      const n = labels.length;
      if (!n) return;

      const rect = this.canvas.getBoundingClientRect();
      const W = rect.width, H = rect.height;
      const pad = 30;
      const cx = W / 2, cy = H / 2;
      const rMax = Math.max(10, Math.min(W, H) / 2 - pad);

      // compute max value
      let maxVal = 0;
      datasets.forEach(ds => {
        (ds.data || []).forEach(v => {
          if (typeof v === 'number') maxVal = Math.max(maxVal, v);
        });
      });
      if (maxVal <= 0) maxVal = 1;

      const levels = (cfg.options && cfg.options.radar && cfg.options.radar.levels) || 4;

      ctx.save();
      // grid
      for (let lv = 1; lv <= levels; lv++) {
        const rr = (rMax * lv) / levels;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const ang = -Math.PI/2 + (i * 2 * Math.PI / n);
          const x = cx + rr * Math.cos(ang);
          const y = cy + rr * Math.sin(ang);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = (cfg.options && cfg.options.radar && cfg.options.radar.gridColor) || '#ddd';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // axes & labels
      ctx.font = (cfg.options && cfg.options.radar && cfg.options.radar.font) || '12px sans-serif';
      ctx.fillStyle = (cfg.options && cfg.options.radar && cfg.options.radar.labelColor) || '#444';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < n; i++) {
        const ang = -Math.PI/2 + (i * 2 * Math.PI / n);
        const x = cx + rMax * Math.cos(ang);
        const y = cy + rMax * Math.sin(ang);

        // axis line
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.strokeStyle = (cfg.options && cfg.options.radar && cfg.options.radar.axisColor) || '#ccc';
        ctx.lineWidth = 1;
        ctx.stroke();

        // label
        const lx = cx + (rMax + 20) * Math.cos(ang);
        const ly = cy + (rMax + 20) * Math.sin(ang);
        ctx.fillText(labels[i], lx, ly);
      }

      // data polygons
      datasets.forEach((ds) => {
        const data = ds.data || [];
        const stroke = ds.borderColor || '#007aff';
        const fill = ds.backgroundColor ? toRGBA(ds.backgroundColor, 0.25) : toRGBA(stroke, 0.15);
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const v = clamp(Number(data[i] || 0), 0, maxVal);
          const rr = (v / maxVal) * rMax;
          const ang = -Math.PI/2 + (i * 2 * Math.PI / n);
          const x = cx + rr * Math.cos(ang);
          const y = cy + rr * Math.sin(ang);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
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

    // ---- Bar chart ----
    _drawBar(ctx) {
      const cfg = this.config;
      const labels = (cfg.data && cfg.data.labels) || [];
      const datasets = (cfg.data && cfg.data.datasets) || [];
      if (!labels.length || !datasets.length) return;
      const ds = datasets[0];
      const data = ds.data || [];

      const rect = this.canvas.getBoundingClientRect();
      const W = rect.width, H = rect.height;

      const padding = {
        top: (cfg.options && cfg.options.padding && cfg.options.padding.top) || 20,
        right: (cfg.options && cfg.options.padding && cfg.options.padding.right) || 20,
        bottom: (cfg.options && cfg.options.padding && cfg.options.padding.bottom) || 40,
        left: (cfg.options && cfg.options.padding && cfg.options.padding.left) || 50
      };

      const horizontal = (cfg.options && cfg.options.indexAxis === 'y');

      // max value
      let maxVal = 0;
      data.forEach(v => { if (typeof v === 'number') maxVal = Math.max(maxVal, v); });
      if (maxVal <= 0) maxVal = 1;

      ctx.save();
      ctx.font = (cfg.options && cfg.options.font) || '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = (cfg.options && cfg.options.color) || '#333';

      if (!horizontal) {
        const cw = W - padding.left - padding.right;
        const ch = H - padding.top - padding.bottom;
        const n = labels.length;
        const gapRatio = (cfg.options && cfg.options.barGap) || 0.2;
        const bw = cw / n * (1 - gapRatio);

        // Y-axis
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + ch);
        ctx.lineTo(padding.left + cw, padding.top + ch);
        ctx.strokeStyle = (cfg.options && cfg.options.axisColor) || '#ccc';
        ctx.stroke();

        // bars
        labels.forEach((lbl, i) => {
          const val = clamp(Number(data[i] || 0), 0, maxVal);
          const h = (val / maxVal) * ch;
          const x = padding.left + i * (cw / n) + (cw / n - bw) / 2;
          const y = padding.top + ch - h;

          ctx.fillStyle = (ds.backgroundColor) || '#7aa5ff';
          ctx.fillRect(x, y, bw, h);

          ctx.fillStyle = (cfg.options && cfg.options.labelColor) || '#333';
          ctx.textAlign = 'center';
          ctx.fillText(lbl, x + bw / 2, padding.top + ch + 6);
        });
      } else {
        // horizontal bars
        const cw = W - padding.left - padding.right;
        const ch = H - padding.top - padding.bottom;
        const n = labels.length;
        const gapRatio = (cfg.options && cfg.options.barGap) || 0.2;
        const bh = ch / n * (1 - gapRatio);

        // X-axis
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + ch);
        ctx.lineTo(padding.left + cw, padding.top + ch);
        ctx.strokeStyle = (cfg.options && cfg.options.axisColor) || '#ccc';
        ctx.stroke();

        labels.forEach((lbl, i) => {
          const val = clamp(Number(data[i] || 0), 0, maxVal);
          const w = (val / maxVal) * cw;
          const x = padding.left;
          const y = padding.top + i * (ch / n) + (ch / n - bh) / 2;

          ctx.fillStyle = (ds.backgroundColor) || '#7aa5ff';
          ctx.fillRect(x, y, w, bh);

          ctx.fillStyle = (cfg.options && cfg.options.labelColor) || '#333';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(lbl, padding.left - 6, y + bh / 2);
        });
      }

      ctx.restore();
    }
  }

  // ---- Export ----
  function Chart(ctx, config) {
    return new MiniChart(ctx, config);
  }
  Chart.version = 'mini-full-1.0.0';
  Chart.defaults = {
    // placeholder defaults; 若有需要可以再擴充
    plugins: {
      legend: {
        position: 'top',
        fontSize: 12,
        boxSize: 12,
        padding: 10
      }
    },
    radar: {
      levels: 4,
      gridColor: '#ddd',
      axisColor: '#ccc',
      labelColor: '#444',
      font: '12px sans-serif'
    },
    padding: {
      top: 20,
      right: 20,
      bottom: 40,
      left: 50
    },
    axisColor: '#ccc',
    labelColor: '#333',
    barGap: 0.2
  };

  global.Chart = Chart;

})(typeof window !== 'undefined' ? window : globalThis);