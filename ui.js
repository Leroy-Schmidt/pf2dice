import {
  twTrained, twExpert, twMaster, twLegendary,
  healSpell, potionMinor, potionLesser, potionModerate, potionGreater,
} from "./presets.js";
import { renderChart, setChartMode, getChartMode } from "./chart.js";
import { generateCode } from "./codegen.js";

const PRESETS = [
  { value: "twTrained",     label: "Treat Wounds — Trained",   hasMod: true,  hasRS: true,  hasRank: false },
  { value: "twExpert",      label: "Treat Wounds — Expert",    hasMod: true,  hasRS: true,  hasRank: false },
  { value: "twMaster",      label: "Treat Wounds — Master",    hasMod: true,  hasRS: true,  hasRank: false },
  { value: "twLegendary",   label: "Treat Wounds — Legendary", hasMod: true,  hasRS: true,  hasRank: false },
  { value: "healSpell",     label: "Heal Spell",               hasMod: false, hasRS: false, hasRank: true  },
  { value: "potionMinor",   label: "Minor Healing Potion",     hasMod: false, hasRS: false, hasRank: false },
  { value: "potionLesser",  label: "Lesser Healing Potion",    hasMod: false, hasRS: false, hasRank: false },
  { value: "potionModerate",label: "Moderate Healing Potion",  hasMod: false, hasRS: false, hasRank: false },
  { value: "potionGreater", label: "Greater Healing Potion",   hasMod: false, hasRS: false, hasRank: false },
];

const COLORS = [
  "#888780","#D85A30","#185FA5","#1D9E75",
  "#7F77DD","#BA7517","#D4537E","#E24B4A","#378ADD",
];

let _series = [];
let _nextId = 1;

function _colorFor(preset) {
  const found = PRESETS.find(p => p.value === preset);
  const idx = PRESETS.indexOf(found);
  return COLORS[idx] ?? COLORS[0];
}

function _buildDist(s) {
  switch (s.preset) {
    case "twTrained":     return twTrained(s.mod, s.rs);
    case "twExpert":      return twExpert(s.mod, s.rs);
    case "twMaster":      return twMaster(s.mod, s.rs);
    case "twLegendary":   return twLegendary(s.mod, s.rs);
    case "healSpell":     return healSpell(s.rank);
    case "potionMinor":   return potionMinor();
    case "potionLesser":  return potionLesser();
    case "potionModerate":return potionModerate();
    case "potionGreater": return potionGreater();
  }
}

function _refresh() {
  const dists = _series.map(s => {
    const dist = _buildDist(s);
    dist.label   = s.label;
    dist.color   = s.color;
    dist.visible = s.visible;
    return dist;
  });

  renderChart(dists);
  _renderStats(dists);
  _renderCode();
  _renderSeriesList();
  _saveToUrl();
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
  if (!el) return;
  el.textContent = generateCode(_series);
}

function _renderSeriesList() {
  const el = document.getElementById("series-list");
  if (!el) return;
  el.innerHTML = _series.map((s, i) => `
    <div class="series-item" data-i="${i}">
      <span class="series-swatch" style="background:${s.color}"></span>
      <span class="series-name">${s.label}</span>
      <label class="series-vis">
        <input type="checkbox" ${s.visible ? "checked" : ""} data-action="vis" data-i="${i}"> show
      </label>
      <button data-action="remove" data-i="${i}">✕</button>
    </div>`).join("");
}

function _addSeries() {
  const preset  = document.getElementById("f-preset").value;
  const meta    = PRESETS.find(p => p.value === preset);
  const mod     = parseInt(document.getElementById("f-mod").value) || 0;
  const rank    = parseInt(document.getElementById("f-rank").value) || 1;
  const rs      = document.getElementById("f-rs")?.checked ?? false;
  const label   = document.getElementById("f-label").value.trim()
    || `${meta.label}${meta.hasMod ? ` +${mod}` : ""}${meta.hasRank ? ` r${rank}` : ""}${rs ? " RS" : ""}`;

  _series.push({
    id:      `s${_nextId++}`,
    preset, mod, rank, rs,
    label,
    color:   _colorFor(preset),
    visible: true,
  });
  _refresh();
}

function _updateFormFields() {
  const preset = document.getElementById("f-preset").value;
  const meta   = PRESETS.find(p => p.value === preset);
  document.getElementById("row-mod").style.display  = meta.hasMod  ? "" : "none";
  document.getElementById("row-rs").style.display   = meta.hasRS   ? "" : "none";
  document.getElementById("row-rank").style.display = meta.hasRank ? "" : "none";
}

function _saveToUrl() {
  const state = { series: _series, chartMode: getChartMode() };
  try { window.location.hash = btoa(JSON.stringify(state)); } catch {}
}

function _loadFromUrl() {
  try {
    if (!window.location.hash) return;
    const state = JSON.parse(atob(window.location.hash.slice(1)));
    _series = state.series ?? [];
    if (state.chartMode) setChartMode(state.chartMode);
    if (_series.length) _nextId = Math.max(..._series.map(s => parseInt(s.id.slice(1)) || 0)) + 1;
  } catch {}
}

export function initUI() {
  _loadFromUrl();

  // Seed with two default series if empty
  if (_series.length === 0) {
    _series = [
      { id: "s1", preset: "twExpert",  mod: 10, rank: 1, rs: false, label: "TW expert +10",  color: "#D85A30", visible: true },
      { id: "s2", preset: "healSpell", mod: 0,  rank: 3, rs: false, label: "Heal spell r3",  color: "#7F77DD", visible: true },
    ];
    _nextId = 3;
  }

  // Populate preset dropdown
  const sel = document.getElementById("f-preset");
  PRESETS.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.value; opt.textContent = p.label;
    sel.appendChild(opt);
  });

  _updateFormFields();
  sel.addEventListener("change", _updateFormFields);

  document.getElementById("btn-add").addEventListener("click", _addSeries);

  document.getElementById("series-list").addEventListener("click", e => {
    const action = e.target.dataset.action;
    const i = parseInt(e.target.dataset.i);
    if (action === "remove") { _series.splice(i, 1); _refresh(); }
    if (action === "vis") { _series[i].visible = e.target.checked; _refresh(); }
  });

  document.getElementById("btn-pdf").addEventListener("click", () => {
    setChartMode("pdf");
    _refresh();
  });
  document.getElementById("btn-cdf").addEventListener("click", () => {
    setChartMode("cdf");
    _refresh();
  });

  _refresh();
}
