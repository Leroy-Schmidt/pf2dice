import { Dist, d, pf2damage, degreesOfSuccess } from "./engine.js";

// Human-readable dice-math expansion shown under preset series (Phase 6).
const _b = n => (n ? ` + ${n}` : "");   // " + N" or "" for a damage bonus
function _twFormula(mod, dc, bonus, rs) {
  return rs
    ? `Risky: d20+${mod + 2} vs DC${dc} → hit 4d8${_b(bonus)} · CF −1d8 · −1d8 upfront`
    : `d20+${mod} vs DC${dc} → S 2d8${_b(bonus)} · CS 4d8${_b(bonus)} · CF −1d8`;
}

function _twDist(mod, dc, bonus) {
  const probs = [0, 0, 0, 0];
  for (let roll = 1; roll <= 20; roll++) probs[degreesOfSuccess(roll, mod, dc)] += 1/20;

  const cf_dist = d(8).negate();
  const f_dist  = Dist.const(0);
  const s_dist  = d(8).add(d(8)).shift(bonus);
  const cs_dist = d(8).add(d(8)).add(d(8)).add(d(8)).shift(bonus);

  return new Dist(new Map()).weightedSum([
    [cf_dist, probs[0]],
    [f_dist,  probs[1]],
    [s_dist,  probs[2]],
    [cs_dist, probs[3]],
  ]);
}

function _twRS(mod, dc, bonus, color) {
  const probs = [0, 0, 0, 0];
  for (let roll = 1; roll <= 20; roll++) probs[degreesOfSuccess(roll, mod + 2, dc)] += 1/20;

  const cf_dist = d(8).negate();
  const f_dist  = Dist.const(0);
  const cs_dist = d(8).add(d(8)).add(d(8)).add(d(8)).shift(bonus);

  const base = new Dist(new Map()).weightedSum([
    [cf_dist, probs[0]],
    [f_dist,  probs[1]],
    [cs_dist, probs[2] + probs[3]], // s folds into cs
  ]);
  return base.add(d(8).negate());
}

export function twTrained(mod, rs = false) {
  const dist = rs ? _twRS(mod, 15, 0) : _twDist(mod, 15, 0);
  dist.label = `TW trained${rs ? " RS" : ""} (+${mod})`;
  dist.color = "#888780";
  dist.formula = _twFormula(mod, 15, 0, rs);
  return dist;
}

export function twExpert(mod, rs = false) {
  const dist = rs ? _twRS(mod, 20, 10) : _twDist(mod, 20, 10);
  dist.label = `TW expert${rs ? " RS" : ""} (+${mod})`;
  dist.color = "#D85A30";
  dist.formula = _twFormula(mod, 20, 10, rs);
  return dist;
}

export function twMaster(mod, rs = false) {
  const dist = rs ? _twRS(mod, 30, 30) : _twDist(mod, 30, 30);
  dist.label = `TW master${rs ? " RS" : ""} (+${mod})`;
  dist.color = "#185FA5";
  dist.formula = _twFormula(mod, 30, 30, rs);
  return dist;
}

export function twLegendary(mod, rs = false) {
  const dist = rs ? _twRS(mod, 40, 50) : _twDist(mod, 40, 50);
  dist.label = `TW legendary${rs ? " RS" : ""} (+${mod})`;
  dist.color = "#1D9E75";
  dist.formula = _twFormula(mod, 40, 50, rs);
  return dist;
}

export function healSpell(rank) {
  let dist = Dist.const(rank * 8);
  for (let i = 0; i < rank; i++) dist = dist.add(d(8));
  dist.label = `Heal rank ${rank}`;
  dist.color = "#7F77DD";
  dist.formula = `${rank}d8 + ${rank * 8}`;
  return dist;
}

export function potionMinor() {
  const dist = d(8).add(d(8)).shift(5);
  dist.label = "Minor potion";
  dist.color = "#BA7517";
  dist.formula = "2d8 + 5";
  return dist;
}

export function potionLesser() {
  const dist = d(8).add(d(8)).add(d(8)).shift(10);
  dist.label = "Lesser potion";
  dist.color = "#D4537E";
  dist.formula = "3d8 + 10";
  return dist;
}

export function potionModerate() {
  const dist = d(8).add(d(8)).add(d(8)).add(d(8)).shift(15);
  dist.label = "Moderate potion";
  dist.color = "#BA7517";
  dist.formula = "4d8 + 15";
  return dist;
}

export function potionGreater() {
  let dist = Dist.const(25);
  for (let i = 0; i < 6; i++) dist = dist.add(d(8));
  dist.label = "Greater potion";
  dist.color = "#D4537E";
  dist.formula = "6d8 + 25";
  return dist;
}

export function strikeBasic(mod, dc, damageDist) {
  const dist = pf2damage(mod, dc, damageDist);
  dist.label = `Strike (+${mod} vs ${dc})`;
  dist.color = "#E24B4A";
  return dist;
}

function _applyResist(dist, resist) {
  // resist > 0: resistance (reduce, clamp at 0). resist < 0: weakness (increase).
  if (!resist) return dist;
  return dist.mapValues(v => Math.max(0, v - resist));
}

// One strike at a given attack modifier. Returns an unlabelled Dist.
// resist applies per damage instance (to hit/crit damage, not to the 0 of a miss).
export function singleStrike(attackMod, targetAC, numDice, dieSize, bonus = 0, resist = 0) {
  let baseDist = Dist.const(bonus);
  for (let i = 0; i < numDice; i++) baseDist = baseDist.add(d(dieSize));

  // Crit: double dice + double bonus (PF2e doubling)
  let critDist = Dist.const(bonus * 2);
  for (let i = 0; i < numDice * 2; i++) critDist = critDist.add(d(dieSize));

  baseDist = _applyResist(baseDist, resist);
  critDist = _applyResist(critDist, resist);

  const probs = [0, 0, 0, 0];
  for (let roll = 1; roll <= 20; roll++) probs[degreesOfSuccess(roll, attackMod, targetAC)] += 1/20;

  return new Dist(new Map()).weightedSum([
    [Dist.const(0), probs[0] + probs[1]], // miss + crit miss
    [baseDist,      probs[2]],             // hit
    [critDist,      probs[3]],             // crit
  ]);
}

export function strike(attackMod, targetAC, numDice, dieSize, bonus = 0, resist = 0) {
  const dist = singleStrike(attackMod, targetAC, numDice, dieSize, bonus, resist);
  dist.label = `Strike +${attackMod} vs AC${targetAC} (${numDice}d${dieSize}+${bonus})`;
  dist.color = "#E24B4A";
  dist.formula = `+${attackMod} vs AC${targetAC} → hit ${numDice}d${dieSize}${_b(bonus)}` +
                 ` · crit ${numDice * 2}d${dieSize}${_b(bonus * 2)}` +
                 (resist ? ` · ${resist > 0 ? "resist" : "weak"} ${Math.abs(resist)}` : "");
  return dist;
}

// Full-attack routine: several strikes with escalating MAP, summed (convolved).
// agile: MAP is -4/-8 instead of -5/-10.
export function strikeRoutine(attackMod, targetAC, numStrikes, numDice, dieSize, bonus = 0, agile = false, resist = 0) {
  const step = agile ? 4 : 5;
  const maps = [0, -step, -2 * step]; // 1st, 2nd, 3rd strike
  let total = Dist.const(0);
  for (let i = 0; i < numStrikes; i++) {
    total = total.add(singleStrike(attackMod + maps[i], targetAC, numDice, dieSize, bonus, resist));
  }
  total.label = `${numStrikes}× Strike +${attackMod} vs AC${targetAC}${agile ? " (agile)" : ""}`;
  total.color = "#E24B4A";
  total.formula = `${numStrikes}× ${numDice}d${dieSize}${_b(bonus)} vs AC${targetAC}, ` +
                  `MAP −${agile ? 4 : 5}/−${agile ? 8 : 10}`;
  return total;
}

export function saveSpell(dc, enemyMod, damageDist) {
  // PF2e save: cs=0, s=half, f=full, cf=double
  const probs = [0, 0, 0, 0];
  for (let roll = 1; roll <= 20; roll++) probs[degreesOfSuccess(roll, enemyMod, dc)] += 1/20;

  const dist = new Dist(new Map()).weightedSum([
    [damageDist.scale(2), probs[0]], // cf → double
    [damageDist,          probs[1]], // f  → full
    [damageDist.scale(0.5), probs[2]], // s → half
    [Dist.const(0),       probs[3]], // cs → none
  ]);
  dist.label = `Save spell (DC${dc} vs +${enemyMod})`;
  dist.color = "#378ADD";
  return dist;
}
