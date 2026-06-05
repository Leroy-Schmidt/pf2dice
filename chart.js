import { Dist } from "./engine.js";

let _chart = null;
let _mode = "pdf"; // "pdf" | "cdf"

export function setChartMode(mode) {
  _mode = mode;
  return _mode;
}

export function getChartMode() {
  return _mode;
}

export function renderChart(series, canvasId = "chart") {
  // series: array of Dist with .label, .color, .visible set
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const datasets = series
    .filter(s => s.visible)
    .map(s => {
      const { xs, ys } = _mode === "pdf" ? s.toXY() : s.toCDF();
      return {
        label: s.label,
        data: xs.map((x, i) => ({ x, y: ys[i] })),
        borderColor: s.color,
        backgroundColor: s.color + "22",
        fill: true,
        tension: 0,
        pointRadius: 2,
        stepped: _mode === "pdf" ? false : "before",
      };
    });

  const yLabel = _mode === "pdf" ? "Probability" : "Cumulative probability";

  if (_chart) {
    _chart.data.datasets = datasets;
    _chart.options.scales.y.title.text = yLabel;
    _chart.update();
    return;
  }

  _chart = new Chart(canvas, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: "Outcome (hp)" },
        },
        y: {
          title: { display: true, text: yLabel },
          min: 0,
        },
      },
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${(ctx.parsed.y * 100).toFixed(2)}%`,
          },
        },
      },
    },
  });
}

export function destroyChart() {
  if (_chart) { _chart.destroy(); _chart = null; }
}
