class Dist {
  constructor(map) {
    if (map instanceof Map) {
      this.map = map;
    } else {
      this.map = new Map(Object.entries(map).map(([k, v]) => [parseInt(k), v]));
    }
    this.label = "";
    this.color = "#D85A30";
    this.visible = true;
  }

  add(other) {
    const result = new Map();
    for (const [a, pa] of this.map) {
      for (const [b, pb] of other.map) {
        const k = a + b;
        result.set(k, (result.get(k) ?? 0) + pa * pb);
      }
    }
    return new Dist(result);
  }

  scale(k) {
    const result = new Map();
    for (const [v, p] of this.map) {
      const nv = v * k;
      result.set(nv, (result.get(nv) ?? 0) + p);
    }
    return new Dist(result);
  }

  shift(k) {
    const result = new Map();
    for (const [v, p] of this.map) {
      result.set(v + k, p);
    }
    return new Dist(result);
  }

  negate() {
    return this.scale(-1);
  }

  mapValues(fn) {
    // Apply fn to every outcome value, merging probabilities that collide.
    // Used for resistance/weakness (e.g. v => Math.max(0, v - R)).
    const result = new Map();
    for (const [v, p] of this.map) {
      const nv = fn(v);
      result.set(nv, (result.get(nv) ?? 0) + p);
    }
    return new Dist(result);
  }

  weightedSum(weights) {
    // weights: array of [Dist, probability]
    const result = new Map();
    for (const [dist, w] of weights) {
      for (const [v, p] of dist.map) {
        result.set(v, (result.get(v) ?? 0) + p * w);
      }
    }
    return new Dist(result);
  }

  stats() {
    const entries = [...this.map.entries()].sort((a, b) => a[0] - b[0]);
    let mean = 0;
    for (const [v, p] of entries) mean += v * p;

    let cumulative = 0;
    let q10, q25, q50, q75, q90;
    for (const [v, p] of entries) {
      cumulative += p;
      if (q10 === undefined && cumulative >= 0.10) q10 = v;
      if (q25 === undefined && cumulative >= 0.25) q25 = v;
      if (q50 === undefined && cumulative >= 0.50) q50 = v;
      if (q75 === undefined && cumulative >= 0.75) q75 = v;
      if (q90 === undefined && cumulative >= 0.90) q90 = v;
    }

    return {
      mean,
      min: entries[0][0],
      max: entries[entries.length - 1][0],
      q10, q25, q50, q75, q90,
    };
  }

  ev() {
    return this.stats().mean;
  }

  toXY() {
    const entries = [...this.map.entries()].sort((a, b) => a[0] - b[0]);
    return { xs: entries.map(e => e[0]), ys: entries.map(e => e[1]) };
  }

  toCDF() {
    const entries = [...this.map.entries()].sort((a, b) => a[0] - b[0]);
    const xs = entries.map(e => e[0]);
    const ys = [];
    let cum = 0;
    for (const [, p] of entries) { cum += p; ys.push(cum); }
    return { xs, ys };
  }

  static const(k) {
    return new Dist(new Map([[k, 1.0]]));
  }
}

function d(n) {
  const map = new Map();
  for (let i = 1; i <= n; i++) map.set(i, 1 / n);
  return new Dist(map);
}

function degreesOfSuccess(roll, mod, dc) {
  const margin = roll + mod - dc;
  let degree;
  if      (margin >= 10) degree = 3;
  else if (margin >= 0)  degree = 2;
  else if (margin >= -9) degree = 1;
  else                   degree = 0;
  if (roll === 20) degree = Math.min(3, degree + 1);
  if (roll === 1)  degree = Math.max(0, degree - 1);
  return degree;
}

function pf2roll(mod, dc, cf = 0, f = 0, s = 1, cs = 2) {
  const outcomes = [cf, f, s, cs];
  const result = new Map();
  for (let roll = 1; roll <= 20; roll++) {
    const deg = degreesOfSuccess(roll, mod, dc);
    const v = outcomes[deg];
    result.set(v, (result.get(v) ?? 0) + 1 / 20);
  }
  return new Dist(result);
}

function pf2damage(mod, dc, damage_dist, cf_mult = 0, f_mult = 0, s_mult = 1, cs_mult = 2) {
  // Accumulate degree probabilities
  const probs = [0, 0, 0, 0]; // [cf, f, s, cs]
  for (let roll = 1; roll <= 20; roll++) {
    probs[degreesOfSuccess(roll, mod, dc)] += 1 / 20;
  }
  const mults = [cf_mult, f_mult, s_mult, cs_mult];
  const weights = [];
  for (let deg = 0; deg < 4; deg++) {
    if (probs[deg] === 0) continue;
    weights.push([damage_dist.scale(mults[deg]), probs[deg]]);
  }
  return Dist.prototype.weightedSum.call(null, weights);
}

// --- Self-tests (run with ?test=1) ---

function runTests() {
  const eps = 1e-9;
  let passed = 0;
  let failed = 0;

  function assert(name, cond, detail = "") {
    if (cond) {
      console.log(`PASS: ${name}`);
      passed++;
    } else {
      console.error(`FAIL: ${name}${detail ? " — " + detail : ""}`);
      failed++;
    }
  }

  function near(a, b, tol = 1e-6) { return Math.abs(a - b) < tol; }

  // Test 1: d6 mean and uniform probabilities
  const d6 = d(6);
  const s1 = d6.stats();
  assert("T1 d6 mean", near(s1.mean, 3.5), `got ${s1.mean}`);
  assert("T1 d6 min/max", s1.min === 1 && s1.max === 6);
  for (const [, p] of d6.map) assert("T1 d6 uniform", near(p, 1/6), `got ${p}`);

  // Test 2: 2d8 range and mean
  const two_d8 = d(8).add(d(8));
  const s2 = two_d8.stats();
  assert("T2 2d8 mean", near(s2.mean, 9.0), `got ${s2.mean}`);
  assert("T2 2d8 min", s2.min === 2, `got ${s2.min}`);
  assert("T2 2d8 max", s2.max === 16, `got ${s2.max}`);

  // Test 3: pf2roll degree distribution, mod+10 vs DC20
  // Expected: CF=1, F=8, S=10, CS=1 (out of 20)
  const counts = [0, 0, 0, 0];
  for (let roll = 1; roll <= 20; roll++) counts[degreesOfSuccess(roll, 10, 20)]++;
  assert("T3 CF=1", counts[0] === 1, `got ${counts[0]}`);
  assert("T3 F=8",  counts[1] === 8, `got ${counts[1]}`);
  assert("T3 S=10", counts[2] === 10, `got ${counts[2]}`);
  assert("T3 CS=1", counts[3] === 1, `got ${counts[3]}`);

  // Test 4: twExpert(10) mean ≈ 10.675
  // Expert: DC20, success=2d8+10, crit=4d8+10, critfail=-1d8, fail=0
  const base = d(8).add(d(8)).shift(10);
  const tw_expert_10 = pf2damage(10, 20, base, -1/8, 0, 1, 2);
  // cf_mult=-1/8 doesn't work — need custom cf handling
  // Actually: cf → -1d8 (fixed), f → 0, s → 2d8+10, cs → 4d8+10
  // pf2damage scales damage_dist, so we need a different approach for cf
  // Rebuild manually:
  const probs = [0, 0, 0, 0];
  for (let roll = 1; roll <= 20; roll++) probs[degreesOfSuccess(roll, 10, 20)] += 1/20;
  const cf_dist = d(8).negate();                     // -1d8
  const f_dist  = Dist.const(0);
  const s_dist  = d(8).add(d(8)).shift(10);          // 2d8+10
  const cs_dist = d(8).add(d(8)).add(d(8)).add(d(8)).shift(10); // 4d8+10
  const tw_e10 = new Dist(new Map()).weightedSum([
    [cf_dist, probs[0]],
    [f_dist,  probs[1]],
    [s_dist,  probs[2]],
    [cs_dist, probs[3]],
  ]);
  const s4 = tw_e10.stats();
  assert("T4 twExpert(10) mean", near(s4.mean, 10.675, 1e-4), `got ${s4.mean}`);

  // Test 5: twExpert(10) Risky Surgery mean ≈ 13.475, min=-16, max=41
  // RS: mod+2=12, DC20, s folds into cs, convolve with -d8
  const rs_probs = [0, 0, 0, 0];
  for (let roll = 1; roll <= 20; roll++) rs_probs[degreesOfSuccess(roll, 12, 20)] += 1/20;
  const eff_cs = rs_probs[2] + rs_probs[3]; // s becomes cs
  const rs_base = new Dist(new Map()).weightedSum([
    [cf_dist,  rs_probs[0]],
    [f_dist,   rs_probs[1]],
    [cs_dist,  eff_cs],
  ]);
  const rs_result = rs_base.add(d(8).negate());
  const s5 = rs_result.stats();
  assert("T5 RS mean", near(s5.mean, 13.475, 1e-4), `got ${s5.mean}`);
  assert("T5 RS min",  s5.min === -16, `got ${s5.min}`);
  assert("T5 RS max",  s5.max === 41,  `got ${s5.max}`);

  // Test 6: healSpell(3) mean=37.5, min=27, max=48
  let hs3 = Dist.const(3 * 8);
  for (let i = 0; i < 3; i++) hs3 = hs3.add(d(8));
  const s6 = hs3.stats();
  assert("T6 healSpell(3) mean", near(s6.mean, 37.5), `got ${s6.mean}`);
  assert("T6 healSpell(3) min",  s6.min === 27, `got ${s6.min}`);
  assert("T6 healSpell(3) max",  s6.max === 48, `got ${s6.max}`);

  console.log(`\n${passed} passed, ${failed} failed`);
}

if (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("test") === "1") {
  runTests();
}

function keepHigh(n, faces) {
  // Distribution of the highest of n independent d(faces).
  const m = new Map();
  const denom = Math.pow(faces, n);
  for (let x = 1; x <= faces; x++) {
    m.set(x, (Math.pow(x, n) - Math.pow(x - 1, n)) / denom);
  }
  return new Dist(m);
}

function keepLow(n, faces) {
  // Distribution of the lowest of n independent d(faces).
  const m = new Map();
  const denom = Math.pow(faces, n);
  for (let x = 1; x <= faces; x++) {
    const hiTail = faces - x + 1; // count of faces >= x
    m.set(x, (Math.pow(hiTail, n) - Math.pow(hiTail - 1, n)) / denom);
  }
  return new Dist(m);
}

function persistentDamage(dmg, flatDC = 15) {
  // PF2e persistent damage: deal dmg, then attempt a flat check to end it; repeat.
  // Number of ticks N ~ Geometric(p), p = chance to pass the flat check.
  // Returns the exact distribution of total damage = mixture over k of (dmg convolved k times).
  const dcClamped = Math.max(2, Math.min(20, flatDC));
  const p = (21 - dcClamped) / 20; // success chance per check (DC15 -> 0.30)
  const acc = new Map();
  let running = dmg;     // total after k ticks (k = 1 -> one tick)
  let tail = 1;          // (1 - p)^(k-1)
  let k = 1;
  while (tail * p > 1e-12 && k < 2000) {
    const pk = tail * p; // P(N = k)
    for (const [v, pr] of running.map) acc.set(v, (acc.get(v) ?? 0) + pr * pk);
    running = running.add(dmg);
    tail *= (1 - p);
    k++;
  }
  return new Dist(acc);
}

function compare(distA, distB) {
  // Returns { pAgtB, pEq, pAltB, meanDiff } for two independent distributions.
  let pAgt = 0, pEq = 0, pAlt = 0;
  for (const [a, pa] of distA.map) {
    for (const [b, pb] of distB.map) {
      const joint = pa * pb;
      if      (a > b) pAgt += joint;
      else if (a < b) pAlt += joint;
      else            pEq  += joint;
    }
  }
  return {
    pAgtB: pAgt,
    pEq,
    pAltB: pAlt,
    meanDiff: distA.ev() - distB.ev(),
  };
}

export { Dist, d, pf2roll, pf2damage, degreesOfSuccess, compare, keepHigh, keepLow, persistentDamage };
