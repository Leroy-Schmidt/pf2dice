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

## In flight

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

### 4. UI redesign + declutter
- [ ] Stats as a real table: mean, σ, min, Q1, median, Q3, P10, P90, max (add `std`,`q25`,`q75` to engine.stats)
- [ ] Toolbar split: data-view (PDF/CDF) separated from view controls (zoom)
- [ ] Zoom: x-axis-locked default, typed min/max limits, reset icon, optional scrollbar
- [ ] CDF value→probability lookup (inverse of quantile line)
- [ ] Declutter the attack form (move advanced bits behind a disclosure; code is primary now)
- [ ] Overall layout pass for clarity

### 5. Fantasy theme
- [ ] Parchment palette fleshed out, serif display font for headings, paper texture
- [ ] Ornamental dividers; "Parchment" becomes default
- [ ] Screenshot self-check (aesthetic — flag for human review)

---

## Parked (not in this run)
- Analysis tools: kill-chance / turns-to-kill, difference distribution, EV marker line
- v3 Turn Builder: conditional/branching sequences (trip → off-guard)
- Rounding of half-damage (PF2e floors)
