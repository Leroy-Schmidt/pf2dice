import {
  twTrained, twExpert, twMaster, twLegendary,
  healSpell, potionMinor, potionLesser, potionModerate, potionGreater,
  strike, strikeRoutine,
} from "./presets.js";
import { compare } from "./engine.js";
import { renderChart, setChartMode, getChartMode, destroyChart, setGrouped, getGrouped, setQuantile, resetZoom } from "./chart.js";
import { generateCode } from "./codegen.js";

const COLORS = [
  "#D85A30","#185FA5","#1D9E75","#7F77DD",
  "#888780","#BA7517","#D4537E","#E24B4A","#378ADD",
];
let _colorIdx = 0;
function _nextColor() { return COLORS[_colorIdx++ % COLORS.length]; }

let _series = [];
let _nextId  = 1;

function _resolvePreset() {
  const cat = document.getElementById("f-category").value;
  if (cat === "tw") {
    return {
      preset: document.getElementById("f-tw-tier").value,
      mod:    parseInt(document.getElementById("f-mod").value) || 0,
      rank:   1,
      rs:     document.getElementById("f-rs").checked,
    };
  }
  if (cat === "heal") {
    return { preset: "healSpell", mod: 0, rank: parseInt(document.getElementById("f-rank").value) || 1, rs: false };
  }
  if (cat === "potion") {
    return { preset: document.getElementById("f-potion-tier").value, mod: 0, rank: 1, rs: false };
  }
  if (cat === "attack") {
    return {
      preset:    "attack",
      atk:       parseInt(document.getElementById("f-atk").value)      || 0,
      ac:        parseInt(document.getElementById("f-ac").value)        || 15,
      numDice:   parseInt(document.getElementById("f-ndice").value)     || 1,
      dieSize:   parseInt(document.getElementById("f-dsize").value)     || 8,
      dmgBonus:  parseInt(document.getElementById("f-dmgbonus").value)  || 0,
      offguard:  document.getElementById("f-offguard").checked,
      nStrikes:  parseInt(document.getElementById("f-nstrikes").value)  || 1,
      agile:     document.getElementById("f-agile").checked,
      resist:    parseInt(document.getElementById("f-resist").value)    || 0,
    };
  }
}

function _buildDist(s) {
  switch (s.preset) {
    case "twTrained":      return twTrained(s.mod, s.rs);
    case "twExpert":       return twExpert(s.mod, s.rs);
    case "twMaster":       return twMaster(s.mod, s.rs);
    case "twLegendary":    return twLegendary(s.mod, s.rs);
    case "healSpell":      return healSpell(s.rank);
    case "potionMinor":    return potionMinor();
    case "potionLesser":   return potionLesser();
    case "potionModerate": return potionModerate();
    case "potionGreater":  return potionGreater();
    case "attack": {
      const ac = s.ac - (s.offguard ? 2 : 0);
      return (s.nStrikes && s.nStrikes > 1)
        ? strikeRoutine(s.atk, ac, s.nStrikes, s.numDice, s.dieSize, s.dmgBonus, s.agile, s.resist)
        : strike(s.atk, ac, s.numDice, s.dieSize, s.dmgBonus, s.resist);
    }
  }
}

function _autoLabel(p) {
  const tierLabels = {
    twTrained: "TW trained", twExpert: "TW expert",
    twMaster: "TW master",   twLegendary: "TW legendary",
    healSpell: "Heal spell",
    potionMinor: "Minor potion", potionLesser: "Lesser potion",
    potionModerate: "Moderate potion", potionGreater: "Greater potion",
  };
  const base = tierLabels[p.preset] ?? p.preset;
  if (p.preset.startsWith("tw"))   return `${base} +${p.mod}${p.rs ? " RS" : ""}`;
  if (p.preset === "healSpell")    return `${base} r${p.rank}`;
  if (p.preset === "attack") {
    const n = p.nStrikes > 1 ? `${p.nStrikes}× ` : "";
    const og = p.offguard ? " OG" : "";
    const ag = p.agile ? " agile" : "";
    return `${n}Strike +${p.atk} vs AC${p.ac}${og}${ag} (${p.numDice}d${p.dieSize}+${p.dmgBonus})`;
  }
  return base;
}

function _refresh() {
  const dists = _series.map(s => {
    const dist   = _buildDist(s);
    dist.label   = s.label;
    dist.color   = s.color;
    dist.visible = s.visible;
    return dist;
  });
  renderChart(dists);
  _renderStats(dists);
  _renderCode();
  _renderSeriesList();
  _renderCompare();
  _saveToUrl();
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

  // Preserve current selections where possible
  const prevA = selA.value, prevB = selB.value;
  const opts = _series.map((s, i) => `<option value="${i}">${s.label}</option>`).join("");
  selA.innerHTML = opts;
  selB.innerHTML = opts;
  selA.value = prevA && prevA < _series.length ? prevA : "0";
  selB.value = prevB && prevB < _series.length ? prevB : "1";
  if (selA.value === selB.value && _series.length > 1) {
    selB.value = selA.value === "0" ? "1" : "0";
  }

  const a = _series[parseInt(selA.value)];
  const b = _series[parseInt(selB.value)];
  if (!a || !b) { out.innerHTML = ""; return; }

  const distA = _buildDist(a);
  const distB = _buildDist(b);
  const c = compare(distA, distB);

  const pct = x => (x * 100).toFixed(1) + "%";
  const diffSign = c.meanDiff >= 0 ? "+" : "";

  out.innerHTML = `
    <div class="cmp-grid">
      <div class="cmp-stat">
        <span class="cmp-stat-val" style="color:${a.color}">${pct(c.pAgtB)}</span>
        <span class="cmp-stat-lbl">${a.label} &gt; ${b.label}</span>
      </div>
      <div class="cmp-stat">
        <span class="cmp-stat-val">${pct(c.pEq)}</span>
        <span class="cmp-stat-lbl">tie</span>
      </div>
      <div class="cmp-stat">
        <span class="cmp-stat-val" style="color:${b.color}">${pct(c.pAltB)}</span>
        <span class="cmp-stat-lbl">${b.label} &gt; ${a.label}</span>
      </div>
      <div class="cmp-stat">
        <span class="cmp-stat-val">${diffSign}${c.meanDiff.toFixed(1)}</span>
        <span class="cmp-stat-lbl">mean difference (A − B)</span>
      </div>
    </div>`;
}

function _renderStats(dists) {
  const bar = document.getElementById("stats-bar");
  if (!bar) return;
  bar.innerHTML = dists.filter(d => d.visible).map(d => {
    const s = d.stats();
    return `<div class="stat-row" style="border-left:4px solid ${d.color}">
      <span class="stat-label">${d.label}</span>
      <span>mean <b>${s.mean.toFixed(1)}</b></span>
      <span>med <b>${s.q50}</b></span>
      <span>P10 <b>${s.q10}</b></span>
      <span>P90 <b>${s.q90}</b></span>
      <span>min <b>${s.min}</b></span>
      <span>max <b>${s.max}</b></span>
    </div>`;
  }).join("");
}

function _renderCode() {
  const el = document.getElementById("code-panel");
  if (el) el.textContent = generateCode(_series);
}

function _renderSeriesList() {
  const el = document.getElementById("series-list");
  if (!el) return;
  el.innerHTML = _series.length === 0
    ? `<p class="hint">No series yet.</p>`
    : _series.map((s, i) => `
      <div class="series-item">
        <span class="series-swatch" style="background:${s.color}"></span>
        <span class="series-name">${s.label}</span>
        <label class="series-vis">
          <input type="checkbox" ${s.visible ? "checked" : ""} data-action="vis" data-i="${i}"> show
        </label>
        <button data-action="remove" data-i="${i}" title="Remove">✕</button>
      </div>`).join("");
}

function _updateCategoryRows() {
  const cat = document.getElementById("f-category").value;
  document.getElementById("rows-tw").style.display     = cat === "tw"     ? "" : "none";
  document.getElementById("rows-heal").style.display   = cat === "heal"   ? "" : "none";
  document.getElementById("rows-potion").style.display = cat === "potion" ? "" : "none";
  document.getElementById("rows-attack").style.display = cat === "attack" ? "" : "none";
  _updatePreview();
}

function _updatePreview() {
  const el = document.getElementById("preview-ev");
  if (!el) return;
  try {
    const p = _resolvePreset();
    const dist = _buildDist(p);
    if (!dist) { el.textContent = ""; return; }
    const s = dist.stats();
    el.innerHTML = `<span class="ev-label">Preview:</span> mean <b>${s.mean.toFixed(1)}</b> · min <b>${s.min}</b> · max <b>${s.max}</b>`;
  } catch { el.textContent = ""; }
}

function _addSeries() {
  const p     = _resolvePreset();
  const label = document.getElementById("f-label").value.trim() || _autoLabel(p);
  _series.push({ id: `s${_nextId++}`, ...p, label, color: _nextColor(), visible: true });
  document.getElementById("f-label").value = "";
  _refresh();
}

function _saveToUrl() {
  try { window.location.hash = btoa(JSON.stringify({ series: _series, chartMode: getChartMode() })); } catch {}
}

function _loadFromUrl() {
  try {
    if (!window.location.hash) return;
    const state = JSON.parse(atob(window.location.hash.slice(1)));
    _series = state.series ?? [];
    if (state.chartMode) setChartMode(state.chartMode);
    if (_series.length) {
      _nextId    = Math.max(..._series.map(s => parseInt(s.id.slice(1)) || 0)) + 1;
      _colorIdx  = _series.length % COLORS.length;
    }
  } catch {}
}

export function initUI() {
  _loadFromUrl();

  if (_series.length === 0) {
    _series = [
      { id: "s1", preset: "twExpert",  mod: 10, rank: 1, rs: false, label: "TW expert +10", color: COLORS[0], visible: true },
      { id: "s2", preset: "healSpell", mod: 0,  rank: 3, rs: false, label: "Heal spell r3",  color: COLORS[3], visible: true },
    ];
    _nextId   = 3;
    _colorIdx = 2;
  }

  // Category switcher
  const cat = document.getElementById("f-category");
  cat.addEventListener("change", _updateCategoryRows);
  _updateCategoryRows();

  // Weapon preset auto-fills dice
  document.getElementById("f-weapon")?.addEventListener("change", e => {
    const val = e.target.value;
    if (!val) return;
    const [n, size] = val.split("|");
    document.getElementById("f-ndice").value = n;
    document.getElementById("f-dsize").value = size;
    _updatePreview();
  });

  // Striking rune quick-picks
  document.querySelectorAll(".qp[data-striking]").forEach(btn =>
    btn.addEventListener("click", () => {
      document.getElementById("f-ndice").value = btn.dataset.striking;
      _updatePreview();
    })
  );
  document.querySelectorAll(".qp[data-atk]").forEach(btn =>
    btn.addEventListener("click", () => {
      document.getElementById("f-atk").value = btn.dataset.atk;
      _updatePreview();
    })
  );
  document.querySelectorAll(".qp[data-ac]").forEach(btn =>
    btn.addEventListener("click", () => {
      document.getElementById("f-ac").value = btn.dataset.ac;
      _updatePreview();
    })
  );
  document.querySelectorAll(".qp[data-dmg]").forEach(btn =>
    btn.addEventListener("click", () => {
      document.getElementById("f-dmgbonus").value = btn.dataset.dmg;
      _updatePreview();
    })
  );

  // Live preview triggers
  ["f-tw-tier","f-mod","f-rank","f-rs","f-potion-tier",
   "f-atk","f-ac","f-ndice","f-dsize","f-dmgbonus",
   "f-offguard","f-nstrikes","f-agile","f-resist"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", _updatePreview);
    document.getElementById(id)?.addEventListener("input",  _updatePreview);
  });

  // Quick-pick buttons
  document.querySelectorAll(".qp[data-mod]").forEach(btn =>
    btn.addEventListener("click", () => {
      document.getElementById("f-mod").value = btn.dataset.mod;
      _updatePreview();
    })
  );
  document.querySelectorAll(".qp[data-rank]").forEach(btn =>
    btn.addEventListener("click", () => {
      document.getElementById("f-rank").value = btn.dataset.rank;
      _updatePreview();
    })
  );

  document.getElementById("btn-add").addEventListener("click", _addSeries);

  document.getElementById("btn-clear")?.addEventListener("click", () => {
    if (!_series.length) return;
    _series = []; _colorIdx = 0;
    destroyChart(); _refresh();
  });

  document.getElementById("series-list").addEventListener("click", e => {
    const { action, i } = e.target.dataset;
    const idx = parseInt(i);
    if (isNaN(idx)) return;
    if (action === "remove") { _series.splice(idx, 1); _refresh(); }
    if (action === "vis")    { _series[idx].visible = e.target.checked; _refresh(); }
  });

  const btnPdf     = document.getElementById("btn-pdf");
  const btnCdf     = document.getElementById("btn-cdf");
  const btnGrouped = document.getElementById("btn-grouped");

  btnPdf.addEventListener("click", () => {
    setChartMode("pdf"); destroyChart(); _refresh();
    btnPdf.classList.add("active"); btnCdf.classList.remove("active");
    btnGrouped.style.display = "";
    quantileControl.style.display = "none";
  });
  btnCdf.addEventListener("click", () => {
    setChartMode("cdf"); destroyChart(); _refresh();
    btnCdf.classList.add("active"); btnPdf.classList.remove("active");
    btnGrouped.style.display = "none";
    quantileControl.style.display = "";
    _updateQuantile();
  });
  // Quantile slider (CDF only)
  const quantileControl = document.getElementById("quantile-control");
  const quantileSlider  = document.getElementById("quantile-slider");
  const quantileNum     = document.getElementById("quantile-num");
  const quantileHits    = document.getElementById("quantile-hits");

  function _updateQuantile() {
    const q = Math.max(0.001, Math.min(0.999, parseFloat(quantileSlider.value) || 0.5));
    quantileSlider.value = q;
    quantileNum.value    = q;
    setQuantile(q);

    // Compute interpolated intersection for each visible series
    const hits = _series
      .filter(s => s.visible)
      .map(s => {
        const dist = _buildDist(s);
        const { xs, ys } = dist.toCDF();
        // Find first index where CDF >= q
        let x = xs[xs.length - 1];
        for (let i = 0; i < ys.length; i++) {
          if (ys[i] >= q) {
            // Interpolate between i-1 and i
            if (i === 0) { x = xs[0]; break; }
            const y0 = ys[i - 1], y1 = ys[i];
            const x0 = xs[i - 1], x1 = xs[i];
            x = x0 + (q - y0) / (y1 - y0) * (x1 - x0);
            break;
          }
        }
        return { label: s.label, color: s.color, x };
      });

    quantileHits.innerHTML = hits.map(h =>
      `<span class="q-hit" style="border-color:${h.color}">
        <span class="q-hit-label">${h.label}</span>
        <b>${h.x.toFixed(1)}</b>
      </span>`
    ).join("");

    renderChart(_series.map(s => {
      const dist = _buildDist(s);
      dist.label   = s.label;
      dist.color   = s.color;
      dist.visible = s.visible;
      return dist;
    }));
  }

  quantileSlider.addEventListener("input", _updateQuantile);
  quantileNum.addEventListener("input", () => {
    quantileSlider.value = quantileNum.value;
    _updateQuantile();
  });

  btnGrouped.addEventListener("click", () => {
    const g = !getGrouped();
    setGrouped(g);
    btnGrouped.classList.toggle("active", g);
    btnGrouped.textContent = g ? "Overlapping" : "Side by side";
    destroyChart(); _refresh();
  });

  document.getElementById("btn-zoom-reset")?.addEventListener("click", resetZoom);

  // Comparison selectors
  document.getElementById("cmp-a")?.addEventListener("change", _renderCompare);
  document.getElementById("cmp-b")?.addEventListener("change", _renderCompare);

  _refresh();
}
