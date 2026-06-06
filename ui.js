import { compare } from "./engine.js";
import { evaluate, evalExpr } from "./expr.js";
import {
  renderChart, setChartMode, getChartMode, destroyChart,
  setGrouped, getGrouped, setQuantile, resetZoom, exportPNG,
  zoomBy, setXLimits,
} from "./chart.js";

const COLORS = [
  "#D85A30","#185FA5","#1D9E75","#7F77DD",
  "#888780","#BA7517","#D4537E","#E24B4A","#378ADD",
];

const DEFAULT_CODE =
`output twExpert(10) named "TW expert +10"
output healSpell(3) named "Heal spell r3"`;

let _series     = [];      // evaluated Dist[] (with colors + visibility applied)
let _visibility = [];      // bool[] keyed by output index
let _debounce   = null;

// ── Form → expression string (dogfoods the engine) ───────────────────────────

function _resolvePreset() {
  const cat = document.getElementById("f-category").value;
  if (cat === "tw") {
    return {
      preset: document.getElementById("f-tw-tier").value,
      mod:    parseInt(document.getElementById("f-mod").value) || 0,
      rs:     document.getElementById("f-rs").checked,
    };
  }
  if (cat === "heal")   return { preset: "healSpell", rank: parseInt(document.getElementById("f-rank").value) || 1 };
  if (cat === "potion") return { preset: document.getElementById("f-potion-tier").value };
  if (cat === "attack") {
    return {
      preset:   "attack",
      atk:      parseInt(document.getElementById("f-atk").value)     || 0,
      ac:       parseInt(document.getElementById("f-ac").value)       || 15,
      numDice:  parseInt(document.getElementById("f-ndice").value)    || 1,
      dieSize:  parseInt(document.getElementById("f-dsize").value)    || 8,
      dmgBonus: parseInt(document.getElementById("f-dmgbonus").value) || 0,
      offguard: document.getElementById("f-offguard").checked,
      nStrikes: parseInt(document.getElementById("f-nstrikes").value) || 1,
      agile:    document.getElementById("f-agile").checked,
      resist:   parseInt(document.getElementById("f-resist").value)   || 0,
    };
  }
}

function _formToExpr(p) {
  if (p.preset.startsWith("tw")) return `${p.preset}(${p.mod}${p.rs ? ", true" : ""})`;
  if (p.preset === "healSpell")  return `healSpell(${p.rank})`;
  if (p.preset.startsWith("potion")) return `${p.preset}()`;
  if (p.preset === "attack") {
    const ac = p.ac - (p.offguard ? 2 : 0);
    if (p.nStrikes > 1 || p.resist !== 0) {
      return `strikeRoutine(${p.atk}, ${ac}, ${p.nStrikes}, ${p.numDice}, ${p.dieSize}, ${p.dmgBonus}, ${p.agile}, ${p.resist})`;
    }
    return `pf2attack(+${p.atk}, ${ac}) * (${p.numDice}d${p.dieSize} + ${p.dmgBonus})`;
  }
  return "";
}

function _autoLabel(p) {
  const names = {
    twTrained: "TW trained", twExpert: "TW expert", twMaster: "TW master", twLegendary: "TW legendary",
    healSpell: "Heal spell",
    potionMinor: "Minor potion", potionLesser: "Lesser potion",
    potionModerate: "Moderate potion", potionGreater: "Greater potion",
  };
  if (p.preset.startsWith("tw"))     return `${names[p.preset]} +${p.mod}${p.rs ? " RS" : ""}`;
  if (p.preset === "healSpell")      return `${names[p.preset]} r${p.rank}`;
  if (p.preset.startsWith("potion")) return names[p.preset];
  if (p.preset === "attack") {
    const n = p.nStrikes > 1 ? `${p.nStrikes}× ` : "";
    const og = p.offguard ? " OG" : "";
    const ag = p.agile ? " agile" : "";
    return `${n}Strike +${p.atk} vs AC${p.ac}${og}${ag}`;
  }
  return "series";
}

// ── Evaluation pipeline ──────────────────────────────────────────────────────

function _codeEl() { return document.getElementById("code-input"); }

function _evaluateAndRender() {
  const code = _codeEl().value;
  const { series, errors } = evaluate(code);

  // Apply palette colors by output order; preserve visibility by index.
  series.forEach((s, i) => {
    s.color   = COLORS[i % COLORS.length];
    s.visible = _visibility[i] ?? true;
  });
  _visibility = series.map((s, i) => _visibility[i] ?? true);
  _series = series;

  _renderErrors(errors);
  destroyChart();
  renderChart(_series);
  _renderStats(_series);
  _renderSeriesList();
  _renderCompare();
  _persist();
}

function _renderErrors(errors) {
  const el = document.getElementById("code-errors");
  if (!el) return;
  el.innerHTML = errors.length === 0
    ? ""
    : errors.map(e => `<div class="code-error">Line ${e.line}: ${e.message}</div>`).join("");
}

function _renderStats(dists) {
  const bar = document.getElementById("stats-bar");
  if (!bar) return;
  const vis = dists.filter(d => d.visible);
  if (vis.length === 0) { bar.innerHTML = ""; return; }
  const f1 = x => x.toFixed(1);
  const rows = vis.map(d => {
    const s = d.stats();
    return `<tr>
      <td class="st-name"><span class="series-swatch" style="background:${d.color}"></span>${d.label}</td>
      <td>${f1(s.mean)}</td><td>${f1(s.std)}</td>
      <td>${s.min}</td><td>${s.q25}</td><td>${s.q50}</td><td>${s.q75}</td>
      <td>${s.q10}</td><td>${s.q90}</td><td>${s.max}</td>
    </tr>`;
  }).join("");
  bar.innerHTML = `<table class="stats-table">
    <thead><tr>
      <th class="st-name">Series</th>
      <th>mean</th><th>σ</th><th>min</th><th>Q1</th><th>med</th><th>Q3</th><th>P10</th><th>P90</th><th>max</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function _renderSeriesList() {
  const el = document.getElementById("series-list");
  if (!el) return;
  el.innerHTML = _series.length === 0
    ? `<p class="hint">No outputs yet. Use the form or type in the code panel.</p>`
    : _series.map((s, i) => `
      <div class="series-item">
        <span class="series-swatch" style="background:${s.color}"></span>
        <span class="series-name">${s.label}</span>
        <label class="series-vis">
          <input type="checkbox" ${s.visible ? "checked" : ""} data-action="vis" data-i="${i}"> show
        </label>
      </div>`).join("");
}

function _renderCompare() {
  const selA = document.getElementById("cmp-a");
  const selB = document.getElementById("cmp-b");
  const out  = document.getElementById("compare-result");
  if (!selA || !selB || !out) return;

  if (_series.length < 2) {
    selA.innerHTML = selB.innerHTML = "";
    out.innerHTML = `<p class="hint">Add at least two series to compare.</p>`;
    return;
  }

  const prevA = selA.value, prevB = selB.value;
  const opts = _series.map((s, i) => `<option value="${i}">${s.label}</option>`).join("");
  selA.innerHTML = opts;
  selB.innerHTML = opts;
  selA.value = (prevA && +prevA < _series.length) ? prevA : "0";
  selB.value = (prevB && +prevB < _series.length) ? prevB : "1";
  if (selA.value === selB.value) selB.value = selA.value === "0" ? "1" : "0";

  const a = _series[+selA.value], b = _series[+selB.value];
  const c = compare(a, b);
  const pct = x => (x * 100).toFixed(1) + "%";
  const sign = c.meanDiff >= 0 ? "+" : "";

  out.innerHTML = `
    <div class="cmp-grid">
      <div class="cmp-stat"><span class="cmp-stat-val" style="color:${a.color}">${pct(c.pAgtB)}</span><span class="cmp-stat-lbl">${a.label} &gt; ${b.label}</span></div>
      <div class="cmp-stat"><span class="cmp-stat-val">${pct(c.pEq)}</span><span class="cmp-stat-lbl">tie</span></div>
      <div class="cmp-stat"><span class="cmp-stat-val" style="color:${b.color}">${pct(c.pAltB)}</span><span class="cmp-stat-lbl">${b.label} &gt; ${a.label}</span></div>
      <div class="cmp-stat"><span class="cmp-stat-val">${sign}${c.meanDiff.toFixed(1)}</span><span class="cmp-stat-lbl">mean difference (A − B)</span></div>
    </div>`;
}

// ── Form preview + insert ────────────────────────────────────────────────────

function _updatePreview() {
  const el = document.getElementById("preview-ev");
  if (!el) return;
  try {
    const dist = evalExpr(_formToExpr(_resolvePreset()));
    const s = dist.stats();
    el.innerHTML = `<span class="ev-label">Preview:</span> mean <b>${s.mean.toFixed(1)}</b> · min <b>${s.min}</b> · max <b>${s.max}</b>`;
  } catch { el.textContent = ""; }
}

function _updateCategoryRows() {
  const cat = document.getElementById("f-category").value;
  document.getElementById("rows-tw").style.display     = cat === "tw"     ? "" : "none";
  document.getElementById("rows-heal").style.display   = cat === "heal"   ? "" : "none";
  document.getElementById("rows-potion").style.display = cat === "potion" ? "" : "none";
  document.getElementById("rows-attack").style.display = cat === "attack" ? "" : "none";
  _updatePreview();
}

function _insertSnippet() {
  const p     = _resolvePreset();
  const expr  = _formToExpr(p);
  const label = document.getElementById("f-label").value.trim() || _autoLabel(p);
  const line  = `output ${expr} named "${label}"`;
  const ta = _codeEl();
  ta.value = ta.value.trim() ? ta.value.replace(/\s*$/, "") + "\n" + line : line;
  document.getElementById("f-label").value = "";
  _evaluateAndRender();
}

// ── Persistence ──────────────────────────────────────────────────────────────

function _persist() {
  const code = _codeEl().value;
  try {
    localStorage.setItem("pf2dice-code", code);
    window.location.hash = btoa(unescape(encodeURIComponent(
      JSON.stringify({ code, chartMode: getChartMode() })
    )));
  } catch {}
}

function _loadCode() {
  try {
    if (window.location.hash) {
      const state = JSON.parse(decodeURIComponent(escape(atob(window.location.hash.slice(1)))));
      if (state.chartMode) setChartMode(state.chartMode);
      if (state.code != null) return state.code;
    }
  } catch {}
  return localStorage.getItem("pf2dice-code") ?? DEFAULT_CODE;
}

// ── Export / share / scenarios ───────────────────────────────────────────────

function _download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function _exportCSV() {
  const vis = _series.filter(s => s.visible);
  if (!vis.length) return;
  const xs = new Set();
  const maps = vis.map(s => {
    const m = new Map();
    for (const [v, p] of s.map) { m.set(v, p); xs.add(v); }
    return m;
  });
  const sorted = [...xs].sort((a, b) => a - b);
  const esc = s => `"${String(s).replace(/"/g, '""')}"`;
  const header = ["value", ...vis.map(s => esc(s.label))].join(",");
  const rows = sorted.map(x => [x, ...maps.map(m => m.get(x) ?? 0)].join(","));
  _download(new Blob([[header, ...rows].join("\n")], { type: "text/csv" }), "pf2dice.csv");
}

function _bgColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#1a1a1a";
}

const SCEN_KEY = "pf2dice-scenarios";
function _loadScenarios() {
  try { return JSON.parse(localStorage.getItem(SCEN_KEY)) || {}; } catch { return {}; }
}
function _saveScenarios(obj) { localStorage.setItem(SCEN_KEY, JSON.stringify(obj)); }
function _refreshScenarioList() {
  const sel = document.getElementById("scen-list");
  if (!sel) return;
  const scen = _loadScenarios();
  const names = Object.keys(scen).sort();
  sel.innerHTML = `<option value="">— saved —</option>` +
    names.map(n => `<option value="${n.replace(/"/g, "&quot;")}">${n}</option>`).join("");
}

// ── Init ─────────────────────────────────────────────────────────────────────

export function initUI() {
  if (typeof window !== "undefined") window.__pf2dice_build = "theme-1";
  _codeEl().value = _loadCode();

  // Live code editing (debounced)
  _codeEl().addEventListener("input", () => {
    clearTimeout(_debounce);
    _debounce = setTimeout(_evaluateAndRender, 250);
  });

  // Category + preview wiring
  const cat = document.getElementById("f-category");
  cat.addEventListener("change", _updateCategoryRows);
  _updateCategoryRows();

  ["f-tw-tier","f-mod","f-rank","f-rs","f-potion-tier",
   "f-atk","f-ac","f-ndice","f-dsize","f-dmgbonus",
   "f-offguard","f-nstrikes","f-agile","f-resist"].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener("change", _updatePreview);
    el?.addEventListener("input",  _updatePreview);
  });

  // Quick-pick buttons
  const qp = (sel, target) => document.querySelectorAll(sel).forEach(btn =>
    btn.addEventListener("click", () => { document.getElementById(target).value = btn.dataset[Object.keys(btn.dataset)[0]]; _updatePreview(); }));
  qp(".qp[data-mod]", "f-mod");
  qp(".qp[data-rank]", "f-rank");
  qp(".qp[data-atk]", "f-atk");
  qp(".qp[data-ac]", "f-ac");
  qp(".qp[data-dmg]", "f-dmgbonus");

  document.querySelectorAll(".qp[data-striking]").forEach(btn =>
    btn.addEventListener("click", () => { document.getElementById("f-ndice").value = btn.dataset.striking; _updatePreview(); }));

  document.getElementById("f-weapon")?.addEventListener("change", e => {
    if (!e.target.value) return;
    const [n, size] = e.target.value.split("|");
    document.getElementById("f-ndice").value = n;
    document.getElementById("f-dsize").value = size;
    _updatePreview();
  });

  // Snippet inserter
  document.getElementById("btn-snippet")?.addEventListener("click", () => {
    const snip = document.getElementById("f-snippet").value;
    if (!snip) return;
    const ta = _codeEl();
    ta.value = ta.value.trim() ? ta.value.replace(/\s*$/, "") + "\n" + snip : snip;
    _evaluateAndRender();
  });

  // Insert / clear
  document.getElementById("btn-add").addEventListener("click", _insertSnippet);
  document.getElementById("btn-clear")?.addEventListener("click", () => {
    _codeEl().value = "";
    _visibility = [];
    _evaluateAndRender();
  });

  // Visibility toggles
  document.getElementById("series-list").addEventListener("click", e => {
    const i = parseInt(e.target.dataset.i);
    if (isNaN(i) || e.target.dataset.action !== "vis") return;
    _visibility[i] = e.target.checked;
    _series[i].visible = e.target.checked;
    destroyChart();
    renderChart(_series);
    _renderStats(_series);
  });

  // Chart mode + view controls
  const btnPdf = document.getElementById("btn-pdf");
  const btnCdf = document.getElementById("btn-cdf");
  const btnGrouped = document.getElementById("btn-grouped");
  const cdfTools        = document.getElementById("cdf-tools");
  const quantileSlider  = document.getElementById("quantile-slider");
  const quantileNum     = document.getElementById("quantile-num");
  const quantileHits    = document.getElementById("quantile-hits");
  const lookupX         = document.getElementById("lookup-x");
  const lookupHits      = document.getElementById("lookup-hits");

  // CDF value lookup: P(X <= x) per visible series (linear interpolation on the CDF).
  function _cdfAt(s, x) {
    const { xs, ys } = s.toCDF();
    if (x <= xs[0]) return x < xs[0] ? 0 : ys[0];
    if (x >= xs[xs.length - 1]) return 1;
    for (let i = 1; i < xs.length; i++) {
      if (x <= xs[i]) {
        return ys[i - 1] + (x - xs[i - 1]) / (xs[i] - xs[i - 1]) * (ys[i] - ys[i - 1]);
      }
    }
    return 1;
  }
  function _updateLookup() {
    if (!lookupHits) return;
    const x = parseFloat(lookupX.value);
    if (Number.isNaN(x)) { lookupHits.innerHTML = ""; return; }
    lookupHits.innerHTML = _series.filter(s => s.visible).map(s => {
      const p = _cdfAt(s, x);
      return `<span class="q-hit" style="border-color:${s.color}"><span class="q-hit-label">${s.label}</span><b>${(p * 100).toFixed(1)}%</b></span>`;
    }).join("");
  }
  lookupX?.addEventListener("input", _updateLookup);

  function _updateQuantile() {
    const q = Math.max(0.001, Math.min(0.999, parseFloat(quantileSlider.value) || 0.5));
    quantileSlider.value = q;
    quantileNum.value    = q;
    setQuantile(q);

    const hits = _series.filter(s => s.visible).map(s => {
      const { xs, ys } = s.toCDF();
      let x = xs[xs.length - 1];
      for (let i = 0; i < ys.length; i++) {
        if (ys[i] >= q) {
          if (i === 0) { x = xs[0]; break; }
          x = xs[i - 1] + (q - ys[i - 1]) / (ys[i] - ys[i - 1]) * (xs[i] - xs[i - 1]);
          break;
        }
      }
      return { label: s.label, color: s.color, x };
    });
    quantileHits.innerHTML = hits.map(h =>
      `<span class="q-hit" style="border-color:${h.color}"><span class="q-hit-label">${h.label}</span><b>${h.x.toFixed(1)}</b></span>`).join("");

    destroyChart();
    renderChart(_series);
  }

  quantileSlider.addEventListener("input", _updateQuantile);
  quantileNum.addEventListener("input", () => { quantileSlider.value = quantileNum.value; _updateQuantile(); });

  btnPdf.addEventListener("click", () => {
    setChartMode("pdf"); destroyChart(); renderChart(_series);
    btnPdf.classList.add("active"); btnCdf.classList.remove("active");
    btnGrouped.style.display = ""; cdfTools.style.display = "none";
    _persist();
  });
  btnCdf.addEventListener("click", () => {
    setChartMode("cdf"); destroyChart(); renderChart(_series);
    btnCdf.classList.add("active"); btnPdf.classList.remove("active");
    btnGrouped.style.display = "none"; cdfTools.style.display = "";
    _updateQuantile(); _updateLookup(); _persist();
  });
  btnGrouped.addEventListener("click", () => {
    const g = !getGrouped();
    setGrouped(g);
    btnGrouped.classList.toggle("active", g);
    btnGrouped.textContent = g ? "Overlapping" : "Side by side";
    destroyChart(); renderChart(_series);
  });

  // Zoom controls (x-axis)
  document.getElementById("btn-zoom-in")?.addEventListener("click", () => zoomBy(1.25));
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => zoomBy(0.8));
  const xMin = document.getElementById("x-min");
  const xMax = document.getElementById("x-max");
  const _applyXLimits = () => {
    const lo = xMin.value === "" ? null : parseFloat(xMin.value);
    const hi = xMax.value === "" ? null : parseFloat(xMax.value);
    if (lo === null && hi === null) return;
    setXLimits(lo, hi);
  };
  xMin?.addEventListener("change", _applyXLimits);
  xMax?.addEventListener("change", _applyXLimits);
  document.getElementById("btn-zoom-reset")?.addEventListener("click", () => {
    resetZoom();
    if (xMin) xMin.value = ""; if (xMax) xMax.value = "";
  });
  document.getElementById("cmp-a")?.addEventListener("change", _renderCompare);
  document.getElementById("cmp-b")?.addEventListener("change", _renderCompare);

  // Export / share
  document.getElementById("btn-png")?.addEventListener("click", () => exportPNG(_bgColor(), "pf2dice.png"));
  document.getElementById("btn-csv")?.addEventListener("click", _exportCSV);
  document.getElementById("btn-share")?.addEventListener("click", async e => {
    try {
      await navigator.clipboard.writeText(location.href);
      const b = e.target; const t = b.textContent;
      b.textContent = "Copied!";
      setTimeout(() => { b.textContent = t; }, 1200);
    } catch {}
  });

  // Scenarios
  _refreshScenarioList();
  document.getElementById("btn-scen-save")?.addEventListener("click", () => {
    const name = document.getElementById("scen-name").value.trim();
    if (!name) return;
    const scen = _loadScenarios();
    scen[name] = _codeEl().value;
    _saveScenarios(scen);
    _refreshScenarioList();
    document.getElementById("scen-list").value = name;
    document.getElementById("scen-name").value = "";
  });
  document.getElementById("btn-scen-load")?.addEventListener("click", () => {
    const name = document.getElementById("scen-list").value;
    if (!name) return;
    const scen = _loadScenarios();
    if (scen[name] != null) { _codeEl().value = scen[name]; _evaluateAndRender(); }
  });
  document.getElementById("btn-scen-del")?.addEventListener("click", () => {
    const name = document.getElementById("scen-list").value;
    if (!name) return;
    const scen = _loadScenarios();
    delete scen[name];
    _saveScenarios(scen);
    _refreshScenarioList();
  });

  // Reflect persisted chart mode in toolbar
  if (getChartMode() === "cdf") btnCdf.click();

  _evaluateAndRender();
}
