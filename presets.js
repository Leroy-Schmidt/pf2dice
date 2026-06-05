import { Dist, d, pf2damage, degreesOfSuccess } from "./engine.js";

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
  return dist;
}

export function twExpert(mod, rs = false) {
  const dist = rs ? _twRS(mod, 20, 10) : _twDist(mod, 20, 10);
  dist.label = `TW expert${rs ? " RS" : ""} (+${mod})`;
  dist.color = "#D85A30";
  return dist;
}

export function twMaster(mod, rs = false) {
  const dist = rs ? _twRS(mod, 30, 30) : _twDist(mod, 30, 30);
  dist.label = `TW master${rs ? " RS" : ""} (+${mod})`;
  dist.color = "#185FA5";
  return dist;
}

export function twLegendary(mod, rs = false) {
  const dist = rs ? _twRS(mod, 40, 50) : _twDist(mod, 40, 50);
  dist.label = `TW legendary${rs ? " RS" : ""} (+${mod})`;
  dist.color = "#1D9E75";
  return dist;
}

export function healSpell(rank) {
  let dist = Dist.const(rank * 8);
  for (let i = 0; i < rank; i++) dist = dist.add(d(8));
  dist.label = `Heal rank ${rank}`;
  dist.color = "#7F77DD";
  return dist;
}

export function potionMinor() {
  const dist = d(8).add(d(8)).shift(5);
  dist.label = "Minor potion";
  dist.color = "#BA7517";
  return dist;
}

export function potionLesser() {
  const dist = d(8).add(d(8)).add(d(8)).shift(10);
  dist.label = "Lesser potion";
  dist.color = "#D4537E";
  return dist;
}

export function potionModerate() {
  const dist = d(8).add(d(8)).add(d(8)).add(d(8)).shift(15);
  dist.label = "Moderate potion";
  dist.color = "#BA7517";
  return dist;
}

export function potionGreater() {
  let dist = Dist.const(25);
  for (let i = 0; i < 6; i++) dist = dist.add(d(8));
  dist.label = "Greater potion";
  dist.color = "#D4537E";
  return dist;
}

export function strikeBasic(mod, dc, damageDist) {
  const dist = pf2damage(mod, dc, damageDist);
  dist.label = `Strike (+${mod} vs ${dc})`;
  dist.color = "#E24B4A";
  return dist;
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
