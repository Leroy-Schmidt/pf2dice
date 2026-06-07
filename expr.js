// Expression engine for PF2Dice (design doc §16).
// Evaluates expressions like:  pf2attack(+5, 20) * (2d6 + 5)
// Dependency order: engine → presets → expr → ...
import { Dist, d, degreesOfSuccess, keepHigh, keepLow, persistentDamage } from "./engine.js";
import {
  twTrained, twExpert, twMaster, twLegendary,
  healSpell, potionMinor, potionLesser, potionModerate, potionGreater,
  strike, strikeRoutine,
} from "./presets.js";
import { targetAC, targetSave, levelDC, fireball, electricArc } from "./library.js";

// ── Tokenizer ──────────────────────────────────────────────────────────────

const TT = { NUM: "NUM", DICE: "DICE", IDENT: "IDENT", OP: "OP", EOF: "EOF" };

export function tokenize(src) {
  const tokens = [];
  let i = 0;
  const isDigit = c => c >= "0" && c <= "9";
  const isAlpha = c => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";

  while (i < src.length) {
    const c = src[i];

    if (c === " " || c === "\t" || c === "\r" || c === "\n") { i++; continue; }
    if (c === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }

    // number, possibly a dice literal NdM
    if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
      let j = i;
      while (j < src.length && (isDigit(src[j]) || src[j] === ".")) j++;
      const numStr = src.slice(i, j);
      if (src[j] === "d" && isDigit(src[j + 1])) {
        let k = j + 1;
        while (k < src.length && isDigit(src[k])) k++;
        tokens.push({ t: TT.DICE, n: parseInt(numStr), faces: parseInt(src.slice(j + 1, k)) });
        i = k;
      } else {
        tokens.push({ t: TT.NUM, v: parseFloat(numStr) });
        i = j;
      }
      continue;
    }

    // bare dice literal dM (= 1dM)
    if (c === "d" && isDigit(src[i + 1])) {
      let k = i + 1;
      while (k < src.length && isDigit(src[k])) k++;
      tokens.push({ t: TT.DICE, n: 1, faces: parseInt(src.slice(i + 1, k)) });
      i = k;
      continue;
    }

    if (isAlpha(c)) {
      let j = i;
      while (j < src.length && (isAlpha(src[j]) || isDigit(src[j]))) j++;
      tokens.push({ t: TT.IDENT, name: src.slice(i, j) });
      i = j;
      continue;
    }

    if ("+-*(),".includes(c)) { tokens.push({ t: TT.OP, op: c }); i++; continue; }

    throw new Error(`Unexpected character '${c}' at position ${i}`);
  }

  tokens.push({ t: TT.EOF });
  return tokens;
}

// ── Parser (recursive descent, precedence) ───────────────────────────────────
// AST nodes: {k:"num",v} {k:"dice",n,faces} {k:"var",name}
//            {k:"call",name,args[]} {k:"unary",op,arg} {k:"bin",op,l,r}

export function parseExpr(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const expectOp = op => {
    const t = next();
    if (t.t !== TT.OP || t.op !== op) throw new Error(`Expected '${op}'`);
  };

  function parseAdditive() {
    let node = parseMultiplicative();
    while (peek().t === TT.OP && (peek().op === "+" || peek().op === "-")) {
      const op = next().op;
      node = { k: "bin", op, l: node, r: parseMultiplicative() };
    }
    return node;
  }

  function parseMultiplicative() {
    let node = parseUnary();
    while (peek().t === TT.OP && peek().op === "*") {
      next();
      node = { k: "bin", op: "*", l: node, r: parseUnary() };
    }
    return node;
  }

  function parseUnary() {
    if (peek().t === TT.OP && (peek().op === "+" || peek().op === "-")) {
      const op = next().op;
      return { k: "unary", op, arg: parseUnary() };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = next();
    if (t.t === TT.NUM)  return { k: "num", v: t.v };
    if (t.t === TT.DICE) return { k: "dice", n: t.n, faces: t.faces };
    if (t.t === TT.OP && t.op === "(") {
      const node = parseAdditive();
      expectOp(")");
      return node;
    }
    if (t.t === TT.IDENT) {
      if (peek().t === TT.OP && peek().op === "(") {
        next(); // (
        const args = [];
        if (!(peek().t === TT.OP && peek().op === ")")) {
          args.push(parseAdditive());
          while (peek().t === TT.OP && peek().op === ",") { next(); args.push(parseAdditive()); }
        }
        expectOp(")");
        return { k: "call", name: t.name, args };
      }
      return { k: "var", name: t.name };
    }
    throw new Error("Unexpected token in expression");
  }

  const node = parseAdditive();
  if (peek().t !== TT.EOF) throw new Error("Trailing tokens after expression");
  return node;
}

// ── Evaluator ────────────────────────────────────────────────────────────────

function isPointMass(dist) { return dist.map.size === 1; }
function asScalar(dist) {
  if (!isPointMass(dist)) throw new Error("Expected a number, got a distribution");
  return [...dist.map.keys()][0];
}

// faceProb(roll) gives the probability of the kept d20 face being `roll`.
// Default: fair 1/20. Fortune (keep higher of 2): (2k-1)/400.
const FAIR    = () => 1 / 20;
const FORTUNE = k => (2 * k - 1) / 400;

function degreeDist(mod, dc, mults, faceProb = FAIR) {
  const m = new Map();
  for (let roll = 1; roll <= 20; roll++) {
    const val = mults[degreesOfSuccess(roll, mod, dc)];
    m.set(val, (m.get(val) ?? 0) + faceProb(roll));
  }
  const dist = new Dist(m);
  dist.isDegree = true;
  return dist;
}

function applyDegree(deg, dmg) {
  // For each multiplier value m with prob p: contribute dmg.scale(m) weighted by p.
  const weights = [];
  for (const [mult, p] of deg.map) weights.push([dmg.scale(mult), p]);
  return new Dist(new Map()).weightedSum(weights);
}

function mul(a, b) {
  if (a.isDegree && !b.isDegree) return applyDegree(a, b);
  if (b.isDegree && !a.isDegree) return applyDegree(b, a);
  if (isPointMass(a)) return b.scale(asScalar(a));
  if (isPointMass(b)) return a.scale(asScalar(b));
  // independent product of two general distributions (rare)
  const result = new Map();
  for (const [va, pa] of a.map)
    for (const [vb, pb] of b.map) {
      const v = va * vb;
      result.set(v, (result.get(v) ?? 0) + pa * pb);
    }
  return new Dist(result);
}

const FUNCS = {
  d:          a => d(asScalar(a)),
  const:      a => Dist.const(asScalar(a)),
  pf2attack:  (mod, dc) => degreeDist(asScalar(mod), asScalar(dc), [0, 0, 1, 2]),
  pf2save:    (dc, saveMod) => degreeDist(asScalar(saveMod), asScalar(dc), [2, 1, 0.5, 0]),
  pf2attackfortune: (mod, dc) => degreeDist(asScalar(mod), asScalar(dc), [0, 0, 1, 2], FORTUNE),
  pf2savefortune:   (dc, saveMod) => degreeDist(asScalar(saveMod), asScalar(dc), [2, 1, 0.5, 0], FORTUNE),
  pf2roll:    (mod, dc, cf, f, s, cs) =>
                degreeDist(asScalar(mod), asScalar(dc),
                  [asScalar(cf), asScalar(f), asScalar(s), asScalar(cs)]),
  keephigh:   (n, faces) => keepHigh(asScalar(n), asScalar(faces)),
  keeplow:    (n, faces) => keepLow(asScalar(n), asScalar(faces)),
  persistent: (dmg, dc) => persistentDamage(dmg, dc ? asScalar(dc) : 15),
  // Content library
  targetAC:   lvl => Dist.const(targetAC(asScalar(lvl))),
  targetSave: lvl => Dist.const(targetSave(asScalar(lvl))),
  levelDC:    lvl => Dist.const(levelDC(asScalar(lvl))),
  fireball:   rank => fireball(asScalar(rank)),
  electricArc: (rank, mod) => electricArc(asScalar(rank), mod ? asScalar(mod) : 0),
  twTrained:   (mod, rs) => twTrained(asScalar(mod), rs ? !!asScalar(rs) : false),
  twExpert:    (mod, rs) => twExpert(asScalar(mod), rs ? !!asScalar(rs) : false),
  twMaster:    (mod, rs) => twMaster(asScalar(mod), rs ? !!asScalar(rs) : false),
  twLegendary: (mod, rs) => twLegendary(asScalar(mod), rs ? !!asScalar(rs) : false),
  healSpell:   r => healSpell(asScalar(r)),
  potionMinor:    () => potionMinor(),
  potionLesser:   () => potionLesser(),
  potionModerate: () => potionModerate(),
  potionGreater:  () => potionGreater(),
  strike: (atk, ac, nd, ds, b, res) =>
            strike(asScalar(atk), asScalar(ac), asScalar(nd), asScalar(ds),
                   b ? asScalar(b) : 0, res ? asScalar(res) : 0),
  strikeRoutine: (atk, ac, ns, nd, ds, b, ag, res) =>
            strikeRoutine(asScalar(atk), asScalar(ac), asScalar(ns), asScalar(nd),
                   asScalar(ds), b ? asScalar(b) : 0, ag ? !!asScalar(ag) : false,
                   res ? asScalar(res) : 0),
};

function evalNode(node, env) {
  switch (node.k) {
    case "num":  return Dist.const(node.v);
    case "dice": {
      let dist = d(node.faces);
      for (let i = 1; i < node.n; i++) dist = dist.add(d(node.faces));
      return dist;
    }
    case "var": {
      if (env && node.name in env) return env[node.name];
      if (node.name === "true")  return Dist.const(1);   // boolean literal → flag scalar
      if (node.name === "false") return Dist.const(0);
      throw new Error(`Unknown name '${node.name}'`);
    }
    case "call": {
      const fn = FUNCS[node.name];
      if (!fn) throw new Error(`Unknown function '${node.name}'`);
      return fn(...node.args.map(a => evalNode(a, env)));
    }
    case "unary": {
      const v = evalNode(node.arg, env);
      return node.op === "-" ? v.negate() : v;
    }
    case "bin": {
      const l = evalNode(node.l, env);
      const r = evalNode(node.r, env);
      if (node.op === "+") return l.add(r);
      if (node.op === "-") return l.add(r.negate());
      if (node.op === "*") return mul(l, r);
      throw new Error(`Unknown operator '${node.op}'`);
    }
  }
  throw new Error("Cannot evaluate node");
}

// Evaluate a single expression string to a Dist (no statements).
export function evalExpr(src, env = {}) {
  return evalNode(parseExpr(src), env);
}

// ── Statement layer (design doc §16.2) ───────────────────────────────────────
// Parses a multi-line program. Returns { series: Dist[], errors: [{line, message}] }.

export function evaluate(src) {
  const env = {};
  const series = [];
  const errors = [];
  const lines = src.split("\n");

  lines.forEach((rawLine, idx) => {
    // strip comment + trim, then drop an optional `let ` before an assignment (sugar)
    const line = rawLine.replace(/#.*$/, "").trim().replace(/^let\s+(?=[A-Za-z_]\w*\s*=)/, "");
    if (!line) return;
    try {
      const outMatch = line.match(/^output\s+(.*)$/s);
      if (outMatch) {
        let body = outMatch[1];
        let label = null;
        const named = body.match(/\s+named\s+"([^"]*)"\s*$/);
        if (named) { label = named[1]; body = body.slice(0, named.index); }
        const dist = evalExpr(body, env);
        if (label) dist.label = label;
        else if (!dist.label) dist.label = body.trim();
        dist.srcLine = idx;
        series.push(dist);
        return;
      }
      const assign = line.match(/^([A-Za-z_]\w*)\s*=\s*(.*)$/s);
      if (assign) {
        env[assign[1]] = evalExpr(assign[2], env);
        return;
      }
      // bare expression → treat as output
      const dist = evalExpr(line, env);
      if (!dist.label) dist.label = line;
      dist.srcLine = idx;
      series.push(dist);
    } catch (e) {
      errors.push({ line: idx + 1, message: e.message });
    }
  });

  return { series, errors };
}
