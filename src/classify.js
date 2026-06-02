/**
 * Category and brand classification for gondola-competencia.
 * Only tracks RGM own brands + 5 specific competitors.
 * Returns null for anything else to exclude it.
 */

const OWN_BRANDS = [
  {
    brand: 'Bimbo',
    test: (h) =>
      /\bbimbo\b/.test(h) ||
      /\bartesano\s+bimbo\b/.test(h) ||
      /\bbimbo\s+artesano\b/.test(h) ||
      /\btia\s*rosa\b/.test(h) ||
      (/\brapiditas\b/.test(h) && /\bpan\b/.test(h)),
  },
  {
    brand: 'Los Sorchantes',
    test: (h) => /\bsorchantes\b/.test(h),
  },
];

const COMPETITOR_BRANDS = [
  { brand: 'Magno',        test: (h) => /\bmagno\b/.test(h) },
  { brand: 'Bauducco',     test: (h) => /bauduco+/i.test(h) },
  { brand: 'Visconti',     test: (h) => /\bvisconti\b/.test(h) },
  { brand: 'Marbella',     test: (h) => /\bmarbella\b/.test(h) },
  {
    brand: 'Precio Líder',
    test: (h) =>
      /\bprecio\s*l[ií]der\b/.test(h) ||
      (/\bl[ií]der\b/.test(h) && !/\bde\s+l[ií]der\b/.test(h) && !/\btienda\s+l[ií]der\b/.test(h)),
  },
];

export function classifyCategory(name) {
  const n = (name || '').toLowerCase();
  if (/\btortuga\b|\bhamburguesa\b/.test(n)) return 'Pan de Tortuga';
  if (/\bviena\b|\bpanchos?\b/.test(n)) return 'Pan de Viena';
  if (/\b(molde|lactal|lacteado|sandwich|tostado|miga|americano|blanco|integral|negro|salvado|centeno|brioche|artesano|tierno|suave|casero|campo|extra|clasico|clásico|especial|grande|familiar|rallado)\b/.test(n)) return 'Pan de Molde';
  // Fallback: any product containing "pan" that didn't match viena/tortuga → Pan de Molde
  if (/\bpan\b/.test(n)) return 'Pan de Molde';
  return null;
}

export function classifyBrand(name, brandField) {
  const h = ((name || '') + ' ' + (brandField || '')).toLowerCase();

  for (const { brand, test } of OWN_BRANDS) {
    if (test(h)) return { brand, isOwn: true };
  }

  for (const { brand, test } of COMPETITOR_BRANDS) {
    if (test(h)) return { brand, isOwn: false };
  }

  // Exclude everything else
  return null;
}
