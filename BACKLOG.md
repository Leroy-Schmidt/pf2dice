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
- **Removed** — named scenarios (share links cover persistence).

---

## Next up (planned — inherited from the retired ROADMAP)

### Phase 4 — Parameters / sliders   ← NEXT
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

## Ideas under consideration (from review — not yet scheduled)

- **Fat zero-bar.** Instead of a thin spike, render the outcome-0 bar wider so the eye keeps
  a sense of the distribution's center of mass even while it's clipped. (Pairs with the
  existing zero-bar auto-scale + label.)
- **Clickable stats → highlight in plot.** Click a value in the stats table (median, P10,
  P90, mean, …) to draw a marker/line for it on the chart; same for the other quantiles.
  Reuse the annotation plugin already loaded.
- **σ label fix (quick).** Std dev *is* already in the stats table (`engine.stats().std`,
  rendered in `ui.js`), but `.stats-table th { text-transform: uppercase }` turns the "σ"
  header into "Σ", which reads as *summation*. Relabel (e.g. "SD") or exempt that header
  from the uppercase transform.
- **CDF quantile / reverse-quantile visualization.** The quantile line + "P(X ≤ x)" lookup
  don't read clearly as two lines with an intersection — feels cluttered. Decide whether to
  redesign the visual or keep it numeric-only (the readout panel without chart lines).
- **Scroll/zoom interaction rethink.** Current model overloads the wheel: page-scroll to get
  from Code down to the plot, then the wheel zooms once the cursor is over the chart — a
  context switch that's fine once learned but arguably surprising. Consider: drag-to-zoom
  only, with chart wheel/pan disabled so the wheel always scrolls the page. (Trade-off:
  loses quick wheel-zoom. Worth a small experiment.)

---

## Someday / maybe
- Analysis tools: kill-chance / turns-to-kill, difference distribution, EV marker line.
- v3 Turn Builder: conditional/branching sequences (trip → off-guard); needs `if`/loops.
- Half-damage rounding (PF2e floors).
- Share extras: `<iframe>` embed snippet; Discord rich preview (OG meta + static image);
  short/custom links (needs a backend).
- Code panel: syntax highlighting + function autocomplete (deferred — needs an overlay or
  CodeMirror; not worth a fragile textarea hack).
