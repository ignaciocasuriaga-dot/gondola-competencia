/**
 * Category and brand classification for gondola-competencia.
 * Monitors ALL brands in 3 bread categories across Uruguayan supermarkets.
 */

const OWN_BRANDS = [
  { brand: 'Bimbo Artesano', test: h => /\bartesano\b/.test(h) && /\bbimbo\b/.test(h) },
  { brand: 'Los Sorchantes', test: h => /\bsorchantes\b/.test(h) },
  { brand: 'Rapiditas',      test: h => /\brapiditas\b/.test(h) },
  { brand: 'Tía Rosa',       test: h => /\btia\s*rosa\b/.test(h) },
  { brand: 'Bimbo',          test: h => /\bbimbo\b/.test(h) },
];

// Strip legal entity suffixes and country names from brand field
function normalizeBrand(bf) {
  return (bf || '')
    .replace(/\s+(s\.?\s*a\.?|s\.?\s*r\.?\s*l\.?|ltda?\.?|inc\.?|corp\.?|group|grupo)\b.*/gi, '')
    .replace(/\b(argentina|brasil|brazil|mexico|méxico|chile|paraguay|colombia|perú|peru)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function classifyCategory(name) {
  const n = (name || '').toLowerCase();
  if (/\btortuga\b/.test(n)) return 'Pan de Tortuga';
  if (/\bviena\b/.test(n)) return 'Pan de Viena';
  if (/\b(molde|lactal|lacteado|sandwich|tostado)\b/.test(n)) return 'Pan de Molde';
  return null;
}

export function classifyBrand(name, brandField) {
  const h = ((name || '') + ' ' + (brandField || '')).toLowerCase();
  for (const { brand, test } of OWN_BRANDS) {
    if (test(h)) return { brand, isOwn: true };
  }
  const normalized = normalizeBrand(brandField);
  return { brand: normalized || 'Otro', isOwn: false };
}
