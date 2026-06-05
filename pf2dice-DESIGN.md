# PF2Dice — Design Document
**Version:** 0.1 (pre-build)  
**Purpose:** This document is the single source of truth for the project. Any new AI session or contributor should read this before touching any file. It encodes all design decisions made in the planning conversation so they do not have to be reconstructed.

---

## 1. What this is

A browser-based dice probability calculator for Pathfinder 2e (PF2e). It computes **exact probability distributions** (not Monte Carlo) for healing, damage, and other dice expressions, with native support for PF2e's four-degree-of-success system.

Reference: [AnyDice](https://anydice.com/) is the closest existing tool. This is similar but PF2e-native and hosted statically.

**Hosting:** GitHub Pages. Single repo, no build step, no bundler, no npm. Pure ES modules. Works by opening `index.html` in a browser directly (file://) or via GitHub Pages URL.

**Audience:** PF2e players, primarily the author, secondarily shareable to a table. Non-coders should be able to use the form UI. Technically curious users can read the generated code panel.

---

## 2. File structure

```
pf2dice/
├── index.html      Shell: loads modules, defines layout skeleton
├── engine.js       Core: Dist class, all primitives, self-tests
├── presets.js      Named series: TW tiers, heal spells, potions, strikes
├── codegen.js      Form state → expression string (read-only mirror, v1)
├── ui.js           Form rendering, event wiring, URL state encode/decode
├── chart.js        Chart.js wrapper: multi-series PDF/CDF, stats bar, expand
└── style.css       Split-pane layout, theming, stats bar, responsive
```

**Rule:** No file imports from a file below it in this list except `index.html` which imports all. Dependency order: `engine → presets → codegen → ui → chart`. This keeps each file independently readable.

---

## 3. Core data structure

A **distribution** is a JavaScript `Map` from integer outcome value to probability (a plain `number` in [0,1]). Probabilities across all keys must sum to 1.0 (within floating point tolerance).

```javascript
// Example: a fair d4
// { 1: 0.25, 2: 0.25, 3: 0.25, 4: 0.25 }
```

The `Dist` class wraps this map and carries metadata:

```javascript
class Dist {
  constructor(map)          // map: plain object or Map of {int -> float}
  
  // Metadata (set after construction, used by chart/ui)
  this.label  = ""          // series name shown in legend e.g. "TW expert"
  this.color  = "#D85A30"   // hex color for chart series
  this.visible = true       // whether plotted

  // Core operations (all return new Dist, never mutate)
  add(other)                // convolve: independent sum of two distributions
  scale(k)                  // multiply every outcome value by scalar k (integer or float)
  shift(k)                  // add constant k to every outcome (same as convolve with point mass)
  negate()                  // multiply every outcome by -1
  weightedSum(weights)      // weights: array of [Dist, probability] pairs → weighted mixture

  // Stats
  stats()    // returns { mean, min, max, q10, q25, q50, q75, q90 }
  ev()       // alias for stats().mean

  // Output
  toXY()     // returns { xs: int[], ys: float[] } sorted by x, for Chart.js
  toCDF()    // returns { xs: int[], ys: float[] } cumulative
}
```

**Key invariant:** `add()` is convolution (independent sum), not mixture. `2d6` = `d(6).add(d(6))`, not an average.  
**Key invariant:** `scale(k)` scales *values*, not probabilities. `d(6).scale(2)` gives {2:1/6, 4:1/6, ..., 12:1/6}. This is NOT the same as `d(6).add(d(6))`.

---

## 4. Primitive functions (engine.js)

These are the building blocks. All return `Dist` instances.

```javascript
d(n)
// Uniform distribution over {1, 2, ..., n}
// d(6) → fair d6, d(8) → d8, etc.

Dist.const(k)
// Point mass: 100% probability at value k
// Dist.const(10) → always returns 10

pf2roll(mod, dc, cf=0, f=0, s=1, cs=2)
// Rolls d20+mod vs dc using PF2e degree-of-success rules:
//   nat 1 drops degree by 1, nat 20 raises degree by 1
// Returns distribution over outcome values {cf, f, s, cs}
// Default values encode standard attack/save profile:
//   cf=0 (no effect), f=0 (miss), s=1 (hit), cs=2 (double)
// For Treat Wounds: pf2roll(mod, dc, -1, 0, 1, 2)
//   where the result is later multiplied by a damage expression
// Degrees map: crit fail → cf, fail → f, success → s, crit success → cs
// Note: {-1,0,1,2} is the natural player-facing encoding but the actual
//   output values are whatever cf/f/s/cs are set to.

// IMPORTANT: pf2roll(mod, dc) * damage_dist is handled by pf2damage() below,
//   NOT by Dist.scale(). They are different operations.

pf2damage(mod, dc, damage_dist, cf_mult=0, f_mult=0, s_mult=1, cs_mult=2)
// The key PF2e primitive. Combines a pf2roll with a damage distribution.
// For each degree d with probability p(d) and multiplier m(d):
//   contribution = damage_dist.scale(m(d)), weighted by p(d)
// Returns weighted mixture of scaled damage distributions.
// Example: pf2damage(12, 20, d(8).add(d(8)).shift(10))
//   → full distribution of TW expert healing outcomes

// Risky Surgery variant is just:
//   pf2damage(mod+2, dc, cs_dist, cf_mult=0, f_mult=0, s_mult=1, cs_mult=1)
//   then convolve result with d(8).negate()
//   (the 1d8 upfront damage is independent, hence convolution)
```

**Operator syntax mapping** (for codegen and future parser):

| Syntax | Engine call |
|---|---|
| `2d8` | `d(8).add(d(8))` |
| `3d6 + 10` | `d(6).add(d(6)).add(d(6)).shift(10)` |
| `A + B` | `A.add(B)` |
| `2 * d6` | `d(6).scale(2)` ← scales values, not same as `d6+d6` |
| `pf2roll(12, 20)` | `pf2roll(12, 20)` with defaults |
| `output X as "label"` | assigns label, adds to active series |

---

## 5. PF2e degree-of-success rules (exact implementation)

This is subtle. Implement exactly as follows:

```javascript
function degreesOfSuccess(roll, mod, dc) {
  // roll: integer 1-20 (the die face)
  // returns integer: 0=crit fail, 1=fail, 2=success, 3=crit success
  const margin = roll + mod - dc;
  let degree;
  if      (margin >= 10) degree = 3;  // crit success
  else if (margin >= 0)  degree = 2;  // success
  else if (margin >= -9) degree = 1;  // fail
  else                   degree = 0;  // crit fail
  if (roll === 20) degree = Math.min(3, degree + 1);  // nat 20 bumps up
  if (roll === 1)  degree = Math.max(0, degree - 1);  // nat 1 drops down
  return degree;
}
```

This has been validated by hand-calculation in the planning conversation for multiple cases. Do not modify without re-running the self-tests.

---

## 6. Treat Wounds — validated rules and expected values

**Healing table (from official source):**

| Proficiency | DC | Success healing | Crit success healing | Crit fail |
|---|---|---|---|---|
| Trained | 15 | 2d8 | 4d8 | −1d8 (all tiers) |
| Expert | 20 | 2d8+10 | 4d8+10 | −1d8 |
| Master | 30 | 2d8+30 | 4d8+30 | −1d8 |
| Legendary | 40 | 2d8+50 | 4d8+50 | −1d8 |

**Critical rule:** Crit fail deals −1d8 at ALL proficiency tiers, not just trained. Fail always gives 0 hp. This was a bug in early prototype versions.

**Risky Surgery (feat):**
- Deals 1d8 damage to patient unconditionally at start (independent die)
- +2 bonus to Medicine check
- Every Success becomes a Crit Success (degree shift, not stat change)
- Crit Success stays Crit Success
- Fail stays Fail (but patient already took 1d8)
- Crit Fail: −1d8 TW + −1d8 RS = two independent d8s of damage (convolve, not add as scalars)

**Implementation of Risky Surgery:**
```
1. Compute pf2p(mod+2, dc) → get {cf, f, s, cs} probabilities
2. Fold s into cs: eff_cs = s + cs, eff_s = 0
3. Build distribution: cf→neg(d8), f→{0}, cs→4d8+bonus
4. Convolve entire result with neg(d8)   ← independent RS damage
```

**Validated test cases** (from planning conversation, Python-verified):

| Case | Mod | DC | RS | E[heal] | Min | Max |
|---|---|---|---|---|---|---|
| Expert | +10 | 20 | No | 10.675 | −8 | 42 |
| Expert | +10 | 20 | Yes | 13.475 | −16 | 41 |
| Trained | +5 | 15 | No | 5.175 | −8 | 32 |
| Master | +18 | 30 | No | 17.55 | −8 | 62 |

Note: max for RS case is 41, not 34. The RS damage die (−1d8 min = −1) and the CS heal die (4d8+10 max = 42) roll independently, giving 42−1=41.

---

## 7. Heal spell (2-action cast on ally)

Rank N: heals `Nd8 + 8N` hp. No roll, no DC. Pure distribution.

```javascript
function healSpell(rank) {
  // rank: integer 1-10
  // returns Dist of Nd8 + 8N
  let dist = Dist.const(rank * 8);
  for (let i = 0; i < rank; i++) dist = dist.add(d(8));
  return dist;
}
```

Expected values: rank 1 = 12.5, rank 2 = 25, rank 3 = 37.5, ..., rank N = N × 12.5.

---

## 8. Presets (presets.js)

Each preset is a function returning a `Dist` with `.label` and `.color` set.

```javascript
// Treat Wounds
twTrained(mod)    // DC 15, 2d8/4d8, bonus 0
twExpert(mod)     // DC 20, 2d8+10/4d8+10
twMaster(mod)     // DC 30, 2d8+30/4d8+30
twLegendary(mod)  // DC 40, 2d8+50/4d8+50

// Heal spell
healSpell(rank)   // Nd8 + 8N

// Potions (fixed, no roll)
potionMinor()     // 2d8+5,  Minor Healing Potion
potionLesser()    // 3d8+10, Lesser Healing Potion
potionModerate()  // 4d8+15, Moderate Healing Potion
potionGreater()   // 6d8+25, Greater Healing Potion

// Strikes (basic attack roll damage)
// pf2damage with standard 0,0,1,2 multipliers
strikeBasic(mod, dc, damageDist)

// Basic saving throw spell damage
// PF2e save: cs=0, s=half, f=full, cf=double
// cs_mult=0, s_mult=0.5, f_mult=1, cf_mult=2
saveSpell(dc, enemyMod, damageDist)
```

---

## 9. UI layout

```
┌──────────────────────┬────────────────────────┐
│  FORM PANEL          │  CODE PANEL (read-only) │
│  (left, collapsible) │  (right, monospace)     │
│                      │                         │
│  [Preset dropdown]   │  output tw_expert =     │
│  [Mod slider +label] │    twExpert(12)          │
│  [DC field]          │                         │
│  [cf/f/s/cs fields]  │  output heal_3 =        │
│  [+ Add series btn]  │    healSpell(3)          │
│  [series list]       │                         │
└──────────────────────┴─────────────────────────┘
  [stats bar: one row per visible series, colour-coded]
  mean 19.3  median 18  P10 0  P25 9  P75 28  P90 36  min −8  max 42
┌────────────────────────────────────────────────────┐
│  CHART (Chart.js, line+fill, stepped)              │
│  [PDF | CDF toggle]  [Expand ⤢ button]             │
│  Multiple series, hover tooltips, legend           │
└────────────────────────────────────────────────────┘
```

---

## 10. URL state / sharing

State is serialized to the URL hash as base64-encoded JSON. No server involved.

```javascript
// Encode
const state = { series: [...], modValue: 12 };
window.location.hash = btoa(JSON.stringify(state));

// Decode on load
if (window.location.hash) {
  const state = JSON.parse(atob(window.location.hash.slice(1)));
  // restore form + re-render
}
```

State schema (v1):
```json
{
  "series": [
    {
      "id": "tw_expert",
      "preset": "twExpert",
      "mod": 12,
      "visible": true,
      "label": "TW expert",
      "color": "#D85A30"
    }
  ],
  "chartMode": "pdf"
}
```

---

## 11. Self-tests (bottom of engine.js)

These run on page load in dev mode (`?test=1` URL param) and log pass/fail to the console. They must all pass before any UI work proceeds.

```javascript
// Test 1: d(6) has correct mean
// E[d6] = 3.5, all values equal probability 1/6

// Test 2: d(8).add(d(8)) has correct range and mean
// Range [2,16], mean 9.0

// Test 3: pf2roll degree distribution, expert DC20 mod+10
// CF=1/20, F=10/20, S=8/20, CS=1/20  (validated in planning)
// Wait — re-check: mod+10 vs DC20, need roll>=10 for margin>=0
// roll 20: margin=10→CS, nat20 bump→CS. roll 10-19: S (10 rolls). 
// roll 2-9: F (8 rolls). roll 1: nat1 drops F→CF (1 roll).
// CF=1, F=8, S=10, CS=1 → CHECK AGAINST PYTHON OUTPUT: CF=1,F=8,S=10,CS=1 ✓

// Test 4: twExpert(10) mean ≈ 10.675 (Python-verified)

// Test 5: twExpert(10) with Risky Surgery mean ≈ 13.475, min=-16, max=41

// Test 6: healSpell(3) mean = 37.5, min=27, max=48
// 3d8+24: min=3+24=27, max=24+24=48, mean=3*4.5+24=37.5
```

If any test fails, stop and debug `engine.js` before proceeding. The presets and UI are only correct if the engine is correct.

---

## 12. Build order

Strictly follow this order. Each step should be working before the next begins.

1. **`engine.js`** — `Dist` class, `d()`, `Dist.const()`, `pf2roll()`, `pf2damage()`. Run self-tests in browser console. All 6 tests pass.
2. **`presets.js`** — All preset functions. Spot-check means against table in §6 and §7.
3. **`chart.js`** — Chart.js multi-series rendering. Test with two hardcoded presets before wiring to form.
4. **`ui.js`** + **`codegen.js`** — Form, event handling, code mirror output.
5. **`index.html`** + **`style.css`** — Layout, split pane, stats bar, URL state.
6. **GitHub Pages** — Push repo, enable Pages on `main` branch, test shared URL.

---

## 13. Colour palette for series

Consistent across sessions:

| Series | Hex |
|---|---|
| TW trained | `#888780` |
| TW expert | `#D85A30` |
| TW master | `#185FA5` |
| TW legendary | `#1D9E75` |
| Heal spell | `#7F77DD` |
| Minor potion | `#BA7517` |
| Lesser potion | `#D4537E` |
| User series 1 | `#E24B4A` |
| User series 2 | `#378ADD` |

---

## 14. Known design decisions and their rationale

| Decision | Rationale |
|---|---|
| Exact arithmetic, not Monte Carlo | Distributions are small (max ~200 values wide). Exact is instant and perfectly reproducible. |
| No bundler/npm | Eliminates entire class of environment setup failures. One HTML file works offline. |
| Degree encoding {cf,f,s,cs} as user-settable values, default {0,0,1,2} | Covers attacks (0,0,1,2), saves (2,1,0.5,0 from enemy perspective), TW (−1,0,1,2) with one function. |
| Crit fail always −1d8 for TW | Verified against official table. Early prototype had this wrong for expert+. |
| Risky Surgery as convolution with −d8 | The RS damage is an independent roll, not a scalar offset. Max is 41 not 34. Verified. |
| Read-only code mirror in v1 | Two-way sync requires robust parser. Read-only + "copy to edit" escape hatch is the pragmatic v1 call. |
| URL hash for sharing | No server required. Hash is not sent to GitHub's servers. Works on GitHub Pages. |

---

## 15. What v1 does NOT include

These are explicitly deferred to avoid scope creep:

- Expression parser / editable code panel (v2)
- Advantage/disadvantage rolls
- Persistent saves / multiple named scenarios
- Mobile-optimised layout
- Syntax highlighting in code panel
- Any backend, database, or user accounts
- Anything requiring npm or a build step

---

*End of design document. If you are a new AI session reading this: implement strictly according to this spec. If something is ambiguous, add a comment in code and note it for the human. Do not invent features not listed here.*
