let _chart    = null;
let _mode     = "pdf"; // "pdf" | "cdf"
let _grouped  = false;
let _quantile = 0.5;   // 0–1, CDF annotation line
let _onViewCb = null;  // called after the view changes (pan/zoom/resize) so overlays reposition

export function getChart()   { return _chart; }
export function onView(cb)   { _onViewCb = cb; }
function _fireView() { if (_onViewCb) _onViewCb(); }

export function setChartMode(mode)  { _mode = mode; }
export function getChartMode()      { return _mode; }
export function setGrouped(g)       { _grouped = g; }
export function getGrouped()        { return _grouped; }
export function setQuantile(q)      { _quantile = q; }

export function renderChart(series, canvasId = "chart") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const visible = series.filter(s => s.visible);
  const isPdf   = _mode === "pdf";
  const yLabel  = isPdf ? "Probability" : "Cumulative probability";

  // Compute global integer range so all series share the same x positions
  let globalMin = Infinity, globalMax = -Infinity;
  for (const s of visible) {
    const { xs } = isPdf ? s.toXY() : s.toCDF();
    if (xs.length) {
      globalMin = Math.min(globalMin, xs[0]);
      globalMax = Math.max(globalMax, xs[xs.length - 1]);
    }
  }

  function padData(xs, ys, isCdf) {
    const map = new Map(xs.map((x, i) => [x, ys[i]]));
    const out = [];
    for (let x = globalMin; x <= globalMax; x++) {
      if (map.has(x)) {
        out.push({ x, y: map.get(x) });
      } else if (isCdf) {
        // Fill CDF gaps by finding the last known value before x
        let fill = 0;
        for (let xi = x - 1; xi >= globalMin; xi--) {
          if (map.has(xi)) { fill = map.get(xi); break; }
        }
        out.push({ x, y: fill });
      } else {
        out.push({ x, y: 0 });
      }
    }
    return out;
  }

  const datasets = visible.map(s => {
    const { xs, ys } = isPdf ? s.toXY() : s.toCDF();
    const data = padData(xs, ys, !isPdf);
    if (isPdf) {
      return {
        label: s.label,
        formula: s.formula,
        data,
        backgroundColor: s.color + "77",
        borderColor: s.color,
        borderWidth: 1,
        borderRadius: 1,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
      };
    } else {
      return {
        label: s.label,
        formula: s.formula,
        data,
        borderColor: s.color,
        backgroundColor: s.color + "22",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0,
        fill: true,
      };
    }
  });

  // ── Y-axis max + annotations ────────────────────────────────────────────────
  // Zero-bar handling (PDF): the outcome-0 spike (misses/fails) often dwarfs the
  // rest. Scale Y to the tallest NON-zero bar and label the clipped 0-bars.
  const yMax = computeYMax(visible, isPdf);
  const annotations = buildAnnotations(visible, isPdf, yMax);

  const commonScales = {
    x: {
      type: "linear",
      offset: false,
      title: { display: true, text: "Outcome (hp)" },
      ticks: { stepSize: 5, maxRotation: 0 },
    },
    y: {
      title: { display: true, text: yLabel },
      min: 0,
      max: yMax,           // undefined ⇒ Chart.js auto-scales
    },
  };

  const commonPlugins = {
    legend: { position: "top" },
    tooltip: {
      callbacks: {
        label: ctx => `${ctx.dataset.label}: ${(ctx.parsed.y * 100).toFixed(2)}%`,
        afterLabel: ctx => ctx.dataset.formula ? `  = ${ctx.dataset.formula}` : "",
      },
    },
    annotation: { annotations },
    zoom: {
      pan: { enabled: true, mode: "x", onPanComplete: _fireView },
      zoom: {
        wheel: { enabled: true, modifierKey: "ctrl" },  // plain wheel scrolls the page; Ctrl+wheel zooms
        drag:  { enabled: false },  // drag = pan (not a zoom box)
        pinch: { enabled: true },
        mode: "x",                  // x-axis locked: never zoom the probability axis
        onZoomComplete: _fireView,
      },
    },
  };

  if (_chart) {
    _chart.data.datasets = datasets;
    _chart.options.scales.y.title.text = yLabel;
    _chart.options.scales.y.max = yMax;
    _chart.options.plugins.annotation.annotations = annotations;
    _chart.update();
    _fireView();
    return;
  }

  _chart = new Chart(canvas, {
    type: isPdf ? "bar" : "line",
    data: { datasets },
    options: {
      grouped: isPdf ? _grouped : undefined,
      animation: isPdf ? undefined : false,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: commonScales,
      plugins: commonPlugins,
      onResize: _fireView,
    },
  });
  _fireView();
}

// ── Y-axis scaling helpers ─────────────────────────────────────────────────────
let _yMaxOverride = null;   // user override (Phase 4 click-to-edit); beats auto-scale

export function setYMax(v)  { _yMaxOverride = (v == null || Number.isNaN(v)) ? null : v; }
export function clearYMax() { _yMaxOverride = null; }

function computeYMax(visible, isPdf) {
  if (!isPdf) return undefined;              // CDF spans 0..1 naturally
  if (_yMaxOverride != null) return _yMaxOverride;
  let maxNonZero = 0, clipped = false;
  for (const s of visible) {
    const { xs, ys } = s.toXY();
    for (let i = 0; i < xs.length; i++)
      if (xs[i] !== 0 && ys[i] > maxNonZero) maxNonZero = ys[i];
  }
  for (const s of visible) {
    const { xs, ys } = s.toXY();
    const zi = xs.indexOf(0);
    if (zi !== -1 && ys[zi] > maxNonZero) clipped = true;
  }
  return (clipped && maxNonZero > 0) ? maxNonZero * 1.08 : undefined;
}

function buildAnnotations(visible, isPdf, yMax) {
  const ann = {};
  if (!isPdf) {
    ann.quantileLine = {
      type: "line", yMin: _quantile, yMax: _quantile,
      borderColor: "rgba(255,255,255,0.5)", borderWidth: 1.5, borderDash: [6, 4],
    };
    return ann;
  }
  if (yMax == null) return ann;
  // Collect every 0-bar that exceeds the plotted yMax (i.e. is clipped).
  const clipped = [];
  for (const s of visible) {
    const { xs, ys } = s.toXY();
    const zi = xs.indexOf(0);
    if (zi !== -1 && ys[zi] > yMax) clipped.push({ color: s.color, p: ys[zi] });
  }
  const K = clipped.length;
  if (!K) return ann;

  // Fat zero-bar: draw a wide, full-height box at x=0 so width conveys the clipped mass.
  // Multiple clipped series share a band [-FAT_HALF, +FAT_HALF] side by side.
  const FAT_HALF = 1.4;                 // band half-width in outcome units (tunable)
  const boxW = (2 * FAT_HALF) / K;
  clipped.forEach(({ color, p }, k) => {
    const x0 = -FAT_HALF + k * boxW;
    ann["zerobox" + k] = {
      type: "box",
      xMin: x0, xMax: x0 + boxW,
      yMin: 0, yMax: yMax,
      backgroundColor: color + "cc",
      borderColor: color,
      borderWidth: 1,
    };
    ann["zerolbl" + k] = {
      type: "label",
      xValue: 0, yValue: yMax,
      xAdjust: 34, yAdjust: 12 + k * 20,
      content: [`↑ ${(p * 100).toFixed(0)}% at 0`],
      color: "#fff", backgroundColor: color,
      font: { size: 10, weight: "bold" }, padding: 4, borderRadius: 3,
    };
  });
  return ann;
}

export function resetZoom() {
  if (_chart && _chart.resetZoom) _chart.resetZoom();
}

export function zoomBy(factor) {
  if (_chart && _chart.zoom) _chart.zoom(factor);
}

export function setXLimits(min, max) {
  if (!_chart || !_chart.zoomScale) return;
  const cur = _chart.scales.x;
  const lo = (min === null || min === undefined || Number.isNaN(min)) ? cur.min : min;
  const hi = (max === null || max === undefined || Number.isNaN(max)) ? cur.max : max;
  _chart.zoomScale("x", { min: lo, max: hi }, "default");
}

export function getXRange() {
  if (!_chart) return { min: null, max: null };
  return { min: _chart.scales.x.min, max: _chart.scales.x.max };
}

export function exportPNG(bg = "#1a1a1a", filename = "pf2dice.png") {
  if (!_chart) return;
  const src = _chart.canvas;
  const tmp = document.createElement("canvas");
  tmp.width = src.width;
  tmp.height = src.height;
  const ctx = tmp.getContext("2d");
  ctx.fillStyle = bg;                 // composite onto a solid background
  ctx.fillRect(0, 0, tmp.width, tmp.height);
  ctx.drawImage(src, 0, 0);
  const a = document.createElement("a");
  a.href = tmp.toDataURL("image/png");
  a.download = filename;
  a.click();
}

export function destroyChart() {
  if (_chart) { _chart.destroy(); _chart = null; }
}
