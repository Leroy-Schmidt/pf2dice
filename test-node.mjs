// Headless test runner for autonomous verification: `node test-node.mjs`
// Mirrors the in-browser ?test=1 checks plus engine/expr math.
// Exits non-zero on any failure.
import { Dist, d, compare, keepHigh, keepLow, persistentDamage } from "./engine.js";
import {
  twTrained, twExpert, twMaster, twLegendary, healSpell,
  strike, strikeRoutine, singleStrike,
} from "./presets.js";
import { evalExpr, evaluate } from "./expr.js";
import { targetAC, targetSave, levelDC, fireball, electricArc } from "./library.js";

let pass = 0, fail = 0;
const near = (a, b, t = 1e-6) => Math.abs(a - b) < t;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`PASS: ${name}`); }
  else { fail++; console.error(`FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

// ── Core distributions ──
check("d6 mean", near(d(6).ev(), 3.5));
check("2d8 mean", near(d(8).add(d(8)).ev(), 9));

// ── Presets ──
check("twExpert(10) mean", near(twExpert(10).ev(), 10.675, 1e-4), `${twExpert(10).ev()}`);
check("twExpert(10) RS mean", near(twExpert(10, true).ev(), 13.475, 1e-4), `${twExpert(10, true).ev()}`);
check("twTrained(5) mean", near(twTrained(5).ev(), 5.175, 1e-4));
check("twMaster(18) mean", near(twMaster(18).ev(), 17.55, 1e-4));
check("healSpell(3) mean", near(healSpell(3).ev(), 37.5));

// ── Tier 1 ──
const c = compare(d(6), d(6));
check("compare(d6,d6) symmetric", near(c.pAgtB, c.pAltB) && near(c.meanDiff, 0) && near(c.pAgtB + c.pEq + c.pAltB, 1));
const rMean = strikeRoutine(10, 18, 2, 1, 8, 4).ev();
const sMean = singleStrike(10, 18, 1, 8, 4).ev() + singleStrike(5, 18, 1, 8, 4).ev();
check("routine(2) == sum of strikes", near(rMean, sMean), `${rMean} vs ${sMean}`);
check("resistance lowers mean", strike(10, 18, 1, 8, 4, 3).ev() <= strike(10, 18, 1, 8, 4).ev());

// ── Expression engine ──
check("expr 2d6+5 mean", near(evalExpr("2d6 + 5").ev(), 12));
check("expr 2*d6 scales values", near(evalExpr("2 * d6").ev(), 7));
check("expr pf2attack*dmg == strike()", near(evalExpr("pf2attack(+5,20) * (2d6+5)").ev(), strike(5, 20, 2, 6, 5).ev()));
const prog = evaluate('gs = pf2attack(+9,20) * (2d6+4)\noutput gs named "Greatsword"\noutput twExpert(12)');
check("statement layer", prog.errors.length === 0 && prog.series.length === 2 && prog.series[0].label === "Greatsword");

// ── New primitives ──
check("persistent(d6) mean", near(persistentDamage(d(6)).ev(), 3.5 / 0.3), `${persistentDamage(d(6)).ev()}`);
check("keephigh(2,20) mean", near(keepHigh(2, 20).ev(), 13.825), `${keepHigh(2, 20).ev()}`);
check("keeplow(2,20) mean", near(keepLow(2, 20).ev(), 7.175), `${keepLow(2, 20).ev()}`);
check("expr persistent(d6,15)", near(evalExpr("persistent(d6, 15)").ev(), 3.5 / 0.3));
check("fortune >= normal", evalExpr("pf2attackfortune(+5,20)*(2d6+5)").ev() >= evalExpr("pf2attack(+5,20)*(2d6+5)").ev() - 1e-9);
check("keephigh/keeplow sum to 2*mean", near(keepHigh(2, 20).ev() + keepLow(2, 20).ev(), 21));

// ── Content library ──
check("targetAC(5)=21", targetAC(5) === 21);
check("targetAC(8)=26", targetAC(8) === 26);
check("targetSave(5)=12", targetSave(5) === 12);
check("levelDC(5)=20", levelDC(5) === 20);
check("levelDC(12)=30", levelDC(12) === 30);
check("fireball(3) mean 21", near(fireball(3).ev(), 21));
check("fireball(5) mean 35", near(fireball(5).ev(), 35));
check("electricArc(3,4) mean 11.5", near(electricArc(3, 4).ev(), 11.5));
check("expr targetAC == literal", near(evalExpr("pf2attack(+15, targetAC(8)) * (1d8+4)").ev(), evalExpr("pf2attack(+15, 26) * (1d8+4)").ev()));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
