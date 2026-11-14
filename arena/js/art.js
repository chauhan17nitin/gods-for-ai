// Inline SVG art: god sigils and game glyphs. All drawn with currentColor
// so each one takes the colour of whatever realm it sits in.

window.ART = (() => {
  const sigils = {
    null: `
      <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
        <circle cx="100" cy="100" r="92" opacity=".35"/>
        <circle cx="100" cy="100" r="80" stroke-dasharray="2 10" opacity=".7"/>
        <path d="M30 60 L170 60 L100 178 Z" stroke-width="4"/>
        <path d="M58 60 L70 22 L86 48 L100 14 L114 48 L130 22 L142 60" stroke-width="4"/>
        <circle cx="100" cy="98" r="22" stroke-width="5"/>
        <path d="M82 116 L118 80" stroke-width="5"/>
        <path d="M100 150 L100 162" opacity=".8"/>
      </svg>`,
    karma: `
      <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
        <circle cx="100" cy="100" r="92" opacity=".35"/>
        <circle cx="100" cy="100" r="70" stroke-width="4"/>
        <circle cx="100" cy="100" r="14" stroke-width="4"/>
        ${Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          const x1 = 100 + Math.cos(a) * 14, y1 = 100 + Math.sin(a) * 14;
          const x2 = 100 + Math.cos(a) * 70, y2 = 100 + Math.sin(a) * 70;
          return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke-width="2.5"/>`;
        }).join("")}
        ${Array.from({ length: 24 }, (_, i) => {
          const a = (i * Math.PI) / 12;
          const x1 = 100 + Math.cos(a) * 80, y1 = 100 + Math.sin(a) * 80;
          const x2 = 100 + Math.cos(a) * 88, y2 = 100 + Math.sin(a) * 88;
          return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" opacity=".7"/>`;
        }).join("")}
      </svg>`,
    plain: `
      <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
        <circle cx="100" cy="100" r="92" opacity=".35"/>
        <path d="M100 22 L168 61 L168 139 L100 178 L32 139 L32 61 Z" stroke-width="4"/>
        <path d="M100 52 L141 76 L141 124 L100 148 L59 124 L59 76 Z" opacity=".6"/>
        <circle cx="100" cy="100" r="10" fill="currentColor"/>
        <path d="M100 22 L100 52 M168 61 L141 76 M168 139 L141 124 M100 178 L100 148 M32 139 L59 124 M32 61 L59 76" opacity=".6"/>
      </svg>`,
    locked: `
      <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
        <circle cx="100" cy="100" r="80" stroke-dasharray="4 12"/>
        <text x="100" y="124" text-anchor="middle" font-size="72" fill="currentColor" stroke="none" font-family="Cinzel, serif">?</text>
      </svg>`,
  };

  const glyphs = {
    split: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="32" cy="32" r="20"/><path d="M32 8 L32 56" stroke-dasharray="3 4"/><path d="M22 26 l-6 6 6 6 M42 26 l6 6 -6 6"/></svg>`,
    chains: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="22" width="24" height="20" rx="10"/><rect x="34" y="22" width="24" height="20" rx="10"/><path d="M24 32 L40 32"/></svg>`,
    scales: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M32 8 L32 56 M20 56 L44 56 M10 18 L54 18"/><path d="M10 18 L4 34 L16 34 Z M54 18 L48 34 L60 34 Z"/></svg>`,
    coin: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="16" opacity=".5"/><path d="M38 24 C30 20 24 26 30 30 C38 34 34 42 26 40 M32 18 L32 46"/></svg>`,
    comet: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="18" cy="32" r="7"/><circle cx="46" cy="32" r="7"/><path d="M2 26 L10 28 M2 38 L10 36 M62 26 L54 28 M62 38 L54 36 M32 20 L32 26 M32 38 L32 44 M27 32 L37 32"/></svg>`,
    hands: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 40 L22 40 L32 30 M58 40 L42 40 L32 30"/><circle cx="32" cy="18" r="6"/><path d="M26 48 L38 48" opacity=".6"/></svg>`,
    well: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><ellipse cx="32" cy="24" rx="20" ry="7"/><path d="M12 24 L12 46 C12 54 52 54 52 46 L52 24"/><circle cx="26" cy="12" r="3"/><circle cx="38" cy="8" r="3"/></svg>`,
    moon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M40 8 A24 24 0 1 0 56 40 A18 18 0 1 1 40 8 Z"/></svg>`,
    map: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><path d="M6 14 L22 8 L42 14 L58 8 L58 50 L42 56 L22 50 L6 56 Z M22 8 L22 50 M42 14 L42 56"/></svg>`,
  };

  return {
    sigil: (key) => sigils[key] || sigils.locked,
    glyph: (key) => glyphs[key] || "",
  };
})();
