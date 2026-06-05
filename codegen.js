// Generates a read-only code string from the current series list.
// series: array of { id, preset, mod, dc, damageDist, rs, rank, label }

export function generateCode(series) {
  if (!series.length) return "// No series added yet.";
  return series.map(s => {
    const expr = _seriesExpr(s);
    return `output ${s.id} =\n  ${expr}`;
  }).join("\n\n");
}

function _seriesExpr(s) {
  switch (s.preset) {
    case "twTrained":    return `twTrained(${s.mod}${s.rs ? ", true" : ""})`;
    case "twExpert":     return `twExpert(${s.mod}${s.rs ? ", true" : ""})`;
    case "twMaster":     return `twMaster(${s.mod}${s.rs ? ", true" : ""})`;
    case "twLegendary":  return `twLegendary(${s.mod}${s.rs ? ", true" : ""})`;
    case "healSpell":    return `healSpell(${s.rank})`;
    case "potionMinor":  return `potionMinor()`;
    case "potionLesser": return `potionLesser()`;
    case "potionModerate": return `potionModerate()`;
    case "potionGreater":  return `potionGreater()`;
    default:             return `// unknown preset: ${s.preset}`;
  }
}
