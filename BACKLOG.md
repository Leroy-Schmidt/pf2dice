# PF2Dice — Backlog

Working list for the autonomous build. Order = execution order. Each item ships
working + self-tested (`?test=1`) + committed before the next begins. Aesthetic
items get a screenshot self-check.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Done (history)
- [x] v1 engine, presets, chart, UI (engine→presets→chart→ui→html)
- [x] Tier 1: zoom, off-guard, MAP routine, resistance, comparison P(A>B)
- [x] v2 expr engine (`expr.js`): tokenizer, parser, evaluator, scalar/degree `*`
- [x] v2 Phase 2: editable code panel as source of truth

---

## Next up
Block planned in **`ROADMAP.md`**. Phases 1–3 ✅ shipped (declutter & zoom fix, stacked
layout, category icons + examples gallery). Remaining (deferred): Phase 4 `param` sliders,
Phase 5 shareable interactive embed, Phase 6 developer docs (`README.md` / `VISION.md`).

---

## Shipped (this run)

### 1. New engine primitives  ✅ done
- [x] `persistent(dmg, flatDC=15)` — total persistent damage until flat check passes (geometric mixture, exact)
- [x] `keephigh(n, faces)` / `keeplow(n, faces)` — max/min of n dice (advantage-style)
- [x] `pf2attackfortune` / `pf2savefortune` — Fortune (roll d20 twice, keep higher), nat1/20 on kept die
- [x] Self-tests: persistent(d6) mean ≈ 11.667, keephigh(2,20) mean ≈ 13.825, fortune ≥ normal
- [x] Doc §16.5 updated
- [x] Node-safe modules + headless verification (preview_eval; Node test file kept for when node exists)

### 2. Content presets  ✅ done
- [x] Creature-level target tables → `targetAC(level)`, `targetSave(level)`, `levelDC(level)` (authoritative GM Core / AoN values)
- [x] Class/weapon strike sample snippets (Fighter, Rogue w/ sneak, Barbarian rage)
- [x] Spell/cantrip damage helpers (`fireball(rank)`, `electricArc(rank,mod)`)
- [x] Form: "Snippets" inserter (low-clutter dropdown → appends code)
- [x] Self-tests (target tables, fireball/electricArc means, all snippets evaluate clean)

### 3. Quality of life  ✅ done (highlighting/autocomplete deferred)
- [x] Export chart as PNG (composited onto theme background)
- [x] Export visible distribution(s) as CSV (value + per-series PDF columns)
- [x] "Copy share link" button (current URL hash) with "Copied!" feedback
- [x] Saved scenarios (named localStorage slots: save / load / delete)
- [~] Code panel syntax highlighting + autocomplete — DEFERRED (needs overlay or
      CodeMirror; not worth a fragile textarea hack. Revisit during/after redesign.)
- [x] Dev: no-store server (server.py) for reliable live verification

### 4. UI redesign + declutter  ✅ done
- [x] Stats as a real table: mean, σ, min, Q1, median, Q3, P10, P90, max (added `std` to engine.stats)
- [x] Toolbar split: data-view (PDF/CDF) vs view controls (zoom) vs export, grouped
- [x] Zoom: x-axis-locked, +/−/reset icons, typed min/max limits, drag-box on x
- [x] CDF value→probability lookup: P(X ≤ x) per series (inverse of quantile line)
- [x] Declutter attack form (advanced options behind a <details> disclosure)
- [x] Layout pass (segmented button groups, table stats)

### 5. Fantasy theme  ✅ done (⚠ flagged for human aesthetic review)
- [x] Parchment palette deepened; Cinzel display font; EB Garamond body; paper texture
- [x] Ornamental dividers (❧ on headings, ⚜ flourishes on title); "Parchment" is now default
- [x] Screenshot self-check passed — NEEDS YOUR EYE to confirm it feels right

---

## Someday / maybe
- Analysis tools: kill-chance / turns-to-kill, difference distribution, EV marker line
- v3 Turn Builder: conditional/branching sequences (trip → off-guard)
- Rounding of half-damage (PF2e floors)
- Share extras: `<iframe>` embed snippet; Discord rich preview (OG meta tags + static
  preview image); short/custom links (needs a backend)
- Code panel: syntax highlighting + function autocomplete (deferred in QoL)
