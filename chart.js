let _chart    = null;
let _mode     = "pdf"; // "pdf" | "cdf"
let _grouped  = false;
let _quantile = 0.5;   // 0–1, CDF annotation line

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
    },
  };

  const commonPlugins = {
    legend: { position: "top" },
    tooltip: {
      callbacks: {
        label: ctx => `${ctx.dataset.label}: ${(ctx.parsed.y * 100).toFixed(2)}%`,
      },
    },
  };

  if (!isPdf) {
    commonPlugins.annotation = {
      annotations: {
        quantileLine: {
          type: "line",
          yMin: _quantile,
          yMax: _quantile,
          borderColor: "rgba(255,255,255,0.5)",
          borderWidth: 1.5,
          borderDash: [6, 4],
        },
      },
    };
  }

  if (_chart) {
    _chart.data.datasets = datasets;
    _chart.options.scales.y.title.text = yLabel;
    if (!isPdf) {
      _chart.options.plugins.annotation.annotations.quantileLine.yMin = _quantile;
      _chart.options.plugins.annotation.annotations.quantileLine.yMax = _quantile;
    }
    _chart.update();
    return;
  }

  if (isPdf) {
    _chart = new Chart(canvas, {
      type: "bar",
      data: { datasets },
      options: {
        grouped: _grouped,
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: commonScales,
        plugins: commonPlugins,
      },
    });
  } else {
    _chart = new Chart(canvas, {
      type: "line",
      data: { datasets },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: commonScales,
        plugins: commonPlugins,
      },
    });
  }
}

export function destroyChart() {
  if (_chart) { _chart.destroy(); _chart = null; }
}
