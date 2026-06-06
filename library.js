// Content library: PF2e creature stats by level + spell damage helpers.
// Tables sourced from GM Core "Building Creatures" (Moderate column) and
// the Level-Based DCs table (Archives of Nethys). Dependency order: after engine.
import { Dist, d } from "./engine.js";

// Moderate Armor Class by creature level (-1 … 24).
export const AC_MODERATE = {
  "-1":14, 0:15, 1:15, 2:17, 3:18, 4:20, 5:21, 6:23, 7:24, 8:26, 9:27, 10:29,
  11:30, 12:32, 13:33, 14:35, 15:36, 16:38, 17:39, 18:41, 19:42, 20:44, 21:45,
  22:47, 23:48, 24:50,
};

// Moderate saving-throw modifier by creature level (-1 … 24).
export const SAVE_MODERATE = {
  "-1":5, 0:6, 1:7, 2:8, 3:9, 4:11, 5:12, 6:14, 7:15, 8:16, 9:18, 10:19,
  11:21, 12:22, 13:23, 14:25, 15:26, 16:28, 17:29, 18:30, 19:32, 20:33, 21:35,
  22:36, 23:37, 24:38,
};

// Level-Based DC by level (-1 … 25).
export const LEVEL_DC = {
  "-1":13, 0:14, 1:15, 2:16, 3:18, 4:19, 5:20, 6:22, 7:23, 8:24, 9:26, 10:27,
  11:28, 12:30, 13:31, 14:32, 15:34, 16:35, 17:36, 18:38, 19:39, 20:40, 21:42,
  22:44, 23:46, 24:48, 25:50,
};

function _lookup(table, level, lo, hi) {
  const L = Math.max(lo, Math.min(hi, Math.round(level)));
  return table[L];
}

export const targetAC   = level => _lookup(AC_MODERATE,   level, -1, 24);
export const targetSave = level => _lookup(SAVE_MODERATE, level, -1, 24);
export const levelDC    = level => _lookup(LEVEL_DC,      level, -1, 25);

// ── Spell / cantrip damage (dice only; combine with pf2save for the roll) ─────

// Fireball: 6d6 at rank 3, +2d6 per rank above 3.
export function fireball(rank) {
  const dice = 6 + 2 * (Math.max(3, rank) - 3);
  let dist = d(6);
  for (let i = 1; i < dice; i++) dist = dist.add(d(6));
  return dist;
}

// Electric Arc cantrip: 1d4 per spell rank + spellcasting modifier (electricity).
export function electricArc(rank, mod = 0) {
  let dist = Dist.const(mod);
  for (let i = 0; i < Math.max(1, rank); i++) dist = dist.add(d(4));
  return dist;
}
