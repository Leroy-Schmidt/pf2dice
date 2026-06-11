# PF2Dice — Backlog & Notes

Single working doc: condensed history, what's next, and ideas under consideration.
Architecture lives in `pf2dice-DESIGN.md`. (`ROADMAP.md` was retired once its plan
shipped — its remaining phases are folded into "Next up" below.)

Legend: `[ ]` todo · `[~] `in progress · `[x]` done · ships working + `?test=1` green,
committed per step.

---

## Shipped (condensed history)

- **v1** — engine, presets, chart, UI; exact distributions + 4-degree-of-success.
- **Tier 1** — zoom, off-guard, MAP routine, resistance, P(A>B) comparison.
- **v2 expression engine** (`expr.js`) — tokenizer/parser/evaluator; editable code panel is
  the source of truth; scalar/degree `*` overloads.
- **Engine primitives** — `persistent()`, `keephigh`/`keeplow()`, Fortune attack/save.
- **Content** — `targetAC`/`targetSave`/`levelDC`, `fireball`/`electricArc`, sample builds.
- **QoL** — PNG/CSV export, copy-share-link, no-store dev server (`server.py`).
- **v2 UI** — stats table (incl. σ), zoom controls, CDF value lookup; parchment theme.
- **Redesign R1** — declutter + zoom fix, stacked layout, category icons + examples gallery.
- **Redesign R2** — `true`/`false` literals (Risky-Surgery fix) + `let` sugar; single-scroll
  layout (Code collapsed by default) + restored stats band; zero-bar auto-scale + label;
  click-to-edit axis ends; compare dialog; preset `.formula` transparency.
- **Polish** — stats `mean`/`σ` on the right (σ no longer reads as Σ); Compare in the plot
  toolbar; per-series ✕ delete; modifier-to-zoom (Ctrl+wheel); fat zero-bar boxes.
- **`degreeMix`** — per-degree expression mixer (the missing Turing-complete primitive);
  reproduces every TW/strike wrapper, unblocks custom cases (e.g. Medic Dedication). Plus a
  **Functions** reference dialog listing the base building blocks.
- **Removed** — named scenarios (share links cover persistence).

---

## Next up (planned — inherited from the retired ROADMAP)

### Expand wrappers → base functions (button "B")   ← small follow-up
- A button that rewrites a preset call in the code into its `degreeMix(...)` / dice form.
  Presets would carry a *machine-valid* `.expand` string (alongside the existing readable
  `.formula`); the button replaces the body on pure-preset `output` lines (skip composites
  like `pf2save(...) * fireball(5)`, which have no single expansion).
- Pairs with the shipped Functions reference + `degreeMix` so users can learn by expanding.

### Phase 4 — Parameters / sliders   ← then this
- `expr.js`: `evaluate(src, paramValues = {})`; support `x = slider(DEFAULT, MIN, MAX[, STEP])`
  (and/or `param X = DEFAULT (MIN..MAX[, STEP])`) — register a param, inject its current
  value (point-mass) into the env, return `{ series, errors, params }`.
- `ui.js`: `_paramValues` state; a labelled slider strip above the plot; dragging
  re-evaluates (debounced). Persist values in the URL hash / localStorage.
- Self-test: `evaluate('x = slider(12,0,20)\noutput twExpert(x)', {x:10})` → 1 series,
  mean == `twExpert(10).ev()`, 1 param.

### Phase 5 — Shareable interactive view
- New `embed.html` + `embed.js` (read-only): reads `{code, paramValues, chartMode}` from the
  URL hash; renders title + param sliders + chart + compact stats; no editor. Dragging a
  slider re-evaluates live.
- Main app: a "Share interactive" button builds `embed.html#<base64(state)>` and copies it.
  Self-contained, no server, never expires.

### Phase 6 — Developer docs
- `README.md`: what it is, how to run (`python server.py 8001`), module order
  (`engine → presets → expr → library → codegen → ui → chart`, + `icons`, `embed`), the
  expression language, testing, conventions (exact arithmetic, no build).
- `VISION.md`: the niche (exact PF2e distributions + A-vs-B + interactive sharing that DPR
  calculators don't offer), capabilities, ideas.

---

### Polish bundle  ✅ done
- [x] Stats table: `mean`/`σ` moved to the right; σ header exempt from uppercase (renders as
      a real lowercase σ, not "Σ")
- [x] Compare button moved into the plot toolbar (right-aligned)
- [x] Per-series delete ✕ on each chip (removes its `output` line via `dist.srcLine`)
- [x] Modifier-to-zoom: plain wheel scrolls the page, Ctrl+wheel / pinch zooms, drag pans
- [x] Fat zero-bar: clipped 0-bars drawn as wide full-height boxes (width conveys the mass)

## Ideas under consideration (from review — not yet scheduled)

- **Clickable stats → highlight in plot.** Click a value in the stats table (median, P10,
  P90, mean, …) to draw a marker/line for it on the chart. Reuse the annotation plugin.
- **CDF quantile / reverse-quantile visualization.** The quantile line + "P(X ≤ x)" lookup
  don't read clearly as two lines with an intersection — feels cluttered. Decide whether to
  redesign the visual or keep it numeric-only (the readout panel without chart lines).
- **Fat zero-bar tuning.** Width/opacity/offset (`FAT_HALF` in `chart.js`) are first-pass —
  revisit if it feels too wide or busy with many series.

---

## Someday / maybe
- Analysis tools: kill-chance / turns-to-kill, difference distribution, EV marker line.
- v3 Turn Builder: conditional/branching sequences (trip → off-guard); needs `if`/loops.
- Half-damage rounding (PF2e floors).
- Share extras: `<iframe>` embed snippet; Discord rich preview (OG meta + static image);
  short/custom links (needs a backend).
- Code panel: syntax highlighting + function autocomplete (deferred — needs an overlay or
  CodeMirror; not worth a fragile textarea hack).
