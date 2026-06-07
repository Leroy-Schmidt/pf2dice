# PF2Dice — Roadmap: Declutter, Restack, Onboard & Share

> Status: **R1 (Phases 1–3) ✅ + Redesign round 2 ✅.**
> R1: declutter & zoom · stacked layout · icons + examples gallery.
> R2 (post-review): single-scroll layout (Code collapsed by default), restored stats band,
> zero-bar auto-scale, click-to-edit axes, compare dialog, preset `.formula` transparency,
> plus language fixes (`true`/`false` literals → Risky Surgery; `let` sugar).
> **Next up: Phase 4 `param`/`slider()` live sliders** (e.g. `x = slider(12, 0, 20)`), then
> Phase 5 shareable embed and Phase 6 developer docs. See `BACKLOG.md` for history.

## Context

The tool has grown powerful but cluttered: three side-by-side panels, low-value
"quick" pickers, examples hidden in a dropdown, and a zoom interaction that fights
itself. Goal — **distill it back**: a cleaner stacked layout, a real examples gallery,
fewer controls, and a new headline capability — **sharing a clean, interactive
mini-view** where a viewer drags a parameter (e.g. the modifier in `twExpert(X)`) and
watches the distribution + stats update. Plus durable docs for future developers.

The app is **fully static** (GitHub Pages, no backend, no build step). All sharing must
be self-contained in the URL. Live verification is done via the preview tooling against
`server.py` (no-store static server) on port 8001; logic via `preview_eval`, visuals via
screenshots. (Node isn't installed locally; `test-node.mjs` exists for when it is.)

### Locked decisions
- **Layout:** stacked — Form + Code side-by-side on top (each collapsible; collapsing
  one widens the other); output scrolls below.
- **Onboarding:** minimal — an **Examples gallery** only (no modal, no tour).
- **Share:** **param sliders + stats** (core) and a **self-contained long share link**.
- **Icons:** clean inline SVG (sword / plus / bandage), no Paizo assets (license).

---

## Phase 1 — Declutter & zoom fix ✅ done
- `chart.js`: `zoom.zoom.drag.enabled = false` (keep `pan {mode:"x"}` + wheel/pinch).
  Drag = pan, wheel = zoom, no more drag-select box.
- `index.html`: removed attack numeric quick-picks (`data-atk`/`data-ac`/`data-dmg`);
  kept weapon-preset `<select>` + striking-rune row. Removed the top **Snippets** section.
- `ui.js`: removed the matching `qp(...)` and snippet wiring. Build marker `declutter-1`.

## Phase 2 — Stacked layout (Overleaf-style) ✅ done
- `index.html`: top `.io-row` with two collapsible panels **Form** (left) + **Code**
  (right); below it `.output-area` (toolbar, `#cdf-tools`, `#stats-bar`, `.chart-wrap`,
  compare panel).
- Collapsing one top panel shrinks it to a 28px strip; the sibling grows (`flex:1 1 0`).
  Reused the existing collapse/localStorage wiring unchanged (`pf2dice-sidebar-${side}`).
- `style.css`: `.app-layout` is `flex-direction:column`; new `.io-row{display:flex;
  height:42vh}`; `.main-area` renamed `.output-area`.
- `ui.js`: collapse wiring untouched (ids preserved); build marker `stacked-1`.

## Phase 3 — Category icons + Examples gallery ✅ done
- New `icons.js`: inline SVG glyphs (Treat Wounds=bandage, Heal=plus, Potion=flask,
  Strike=sword), themed via `currentColor`. Icon-button row at the top of the Form sets
  `#f-category`; the `<select>` is kept visually-hidden as an accessible fallback.
- **Examples gallery** (replaced Snippets): an "Examples…" button opens a `<dialog>` of
  cards (title + one-line explanation + code preview + "Load"); Load appends the example
  to the Code panel and re-renders. Card data `EXAMPLES` in `ui.js`. Build `gallery-1`.

## Phase 4 — Parameters (`param`)
- `expr.js`: `evaluate(src, paramValues = {})` parses
  `param NAME = DEFAULT (MIN..MAX[, STEP])`, injects current value (point-mass) into the
  env, and returns `{ series, errors, params }`.
- `ui.js`: `_paramValues` state; a Parameters strip (`#params-bar`) of labelled sliders
  above the chart; dragging re-evaluates (debounced). Persist values in URL/localStorage.
- Self-test: `evaluate('param X = 12 (0..20)\noutput twExpert(X)', {X:10})` → 1 series,
  mean == `twExpert(10).ev()`, 1 param.

## Phase 5 — Shareable interactive view
- New `embed.html` + `embed.js` (minimal, read-only): reads `{code, paramValues,
  chartMode}` from the URL hash; renders title + param sliders + chart + compact stats;
  no form/editor. Dragging a slider re-evaluates live.
- Main app: a **"Share interactive"** button builds `embed.html#<base64(state)>` (absolute
  URL) and copies it. Self-contained, no server, never expires.

## Phase 6 — Documentation
- `README.md`: developer guide — what it is, how to run (`python server.py 8001`),
  module dependency order (`engine → presets → expr → library → codegen → ui → chart`,
  + `icons`, `embed`), the expression language (grammar/operators/functions/`param`),
  testing, file map, conventions (exact arithmetic, no build).
- `VISION.md`: the niche (exact PF2e distributions + A-vs-B + interactive sharing that
  DPR calculators don't offer), capabilities, improvement ideas, someday/maybe.
- Update `pf2dice-DESIGN.md` (`param`, embed view, stacked layout).

---

## Files
- **Edit:** `chart.js`, `index.html`, `style.css`, `ui.js`, `expr.js`,
  `pf2dice-DESIGN.md`, `BACKLOG.md`.
- **New:** `embed.html`, `embed.js`, `icons.js`, `README.md`, `VISION.md`.
- **Tests:** extend the in-browser `?test=1` block + `test-node.mjs` with param checks.

## Verification
1. Bump `window.__pf2dice_build` each phase; reload preview on **:8001** and confirm the
   fresh marker (defeats module cache; bump the port if a stale build sticks).
2. `preview_eval`: full regression (existing 24 checks) + param parse/eval; confirm the
   share link builds a valid `embed.html#…` URL and `embed.js` reconstructs + renders.
3. Screenshots: stacked layout (both open, each collapsed → other full width); icons;
   Examples dialog; Parameters slider; embed view dragging a param.
4. Zoom: wheel zooms, drag pans, no drag-select box.
5. Re-run `?test=1` (all PASS) before each commit. Commit per phase.

## Non-goals / someday-maybe
- No backend → no short/custom links, no SSR. Share = long self-contained URL.
- **Discord:** can't render interactive iframes — only OG link-preview cards. A rich
  Discord preview (OG meta tags + a static preview image) and an `<iframe>` embed snippet
  are parked.
- Parked features: analysis tools (kill-chance / turns-to-kill / difference distribution
  / EV marker), v3 Turn Builder (conditional sequences), half-damage rounding.
