let _chart   = null;
let _mode    = "pdf"; // "pdf" | "cdf"
let _grouped = false; // pdf only: side-by-side vs overlapping

export function setChartMode(mode)      { _mode = mode; }
export function getChartMode()          { return _mode; }
export function setGrouped(g)           { _grouped = g; }
export function getGrouped()            { return _grouped; }

export function renderChart(series, canvasId = "chart") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const visible = series.filter(s => s.visible);
  const isPdf   = _mode === "pdf";
  const yLabel  = isPdf ? "Probability" : "Cumulative probability";

  const datasets = visible.map(s => {
    const { xs, ys } = isPdf ? s.toXY() : s.toCDF();
    if (isPdf) {
      return {
        label: s.label,
        data: xs.map((x, i) => ({ x, y: ys[i] })),
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
        data: xs.map((x, i) => ({ x, y: ys[i] })),
        borderColor: s.color,
        backgroundColor: s.color + "22",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0,
        stepped: "before",
        fill: true,
      };
    }
  });

  if (_chart) {
    _chart.data.datasets = datasets;
    _chart.options.scales.y.title.text = yLabel;
    _chart.update();
    return;
  }

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
