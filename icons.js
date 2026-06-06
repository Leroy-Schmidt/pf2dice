// icons.js — inline SVG glyphs for the category picker.
// Themed via `currentColor`; generic line-art (no Paizo / third-party assets).
// Dependency order: loaded after presets.js, before ui.js. No imports.

const svg = inner =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const ICONS = {
  // Treat Wounds — adhesive bandage (plaster) with centre pad dots
  tw: svg(
    `<g transform="rotate(45 12 12)">` +
    `<rect x="3" y="8.5" width="18" height="7" rx="3.5"/>` +
    `<line x1="9" y1="8.5" x2="9" y2="15.5"/>` +
    `<line x1="15" y1="8.5" x2="15" y2="15.5"/>` +
    `</g>` +
    `<circle cx="10.6" cy="10.6" r=".5" fill="currentColor" stroke="none"/>` +
    `<circle cx="13.4" cy="10.6" r=".5" fill="currentColor" stroke="none"/>` +
    `<circle cx="10.6" cy="13.4" r=".5" fill="currentColor" stroke="none"/>` +
    `<circle cx="13.4" cy="13.4" r=".5" fill="currentColor" stroke="none"/>`
  ),
  // Heal spell — medical cross (plus)
  heal: svg(`<path d="M12 5v14M5 12h14" stroke-width="2.4"/>`),
  // Potion — conical flask
  potion: svg(
    `<path d="M9 3h6"/>` +
    `<path d="M10 3v6l-4.2 8.4A2 2 0 0 0 7.6 20.5h8.8a2 2 0 0 0 1.8-3.1L14 9V3"/>` +
    `<path d="M7 15h10"/>`
  ),
  // Attack / Strike — sword
  attack: svg(
    `<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/>` +
    `<line x1="13" y1="19" x2="19" y2="13"/>` +
    `<line x1="16" y1="16" x2="20" y2="20"/>` +
    `<line x1="19" y1="21" x2="21" y2="19"/>`
  ),
};
