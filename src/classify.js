/**
 * Category and brand classification for gondola-competencia.
 * We monitor ALL brands in 3 bread categories, not just RGM brands.
 */

export function classifyCategory(name) {
  const n = (name || '').toLowerCase();
  if (/tortuga/.test(n)) return 'Pan de Tortuga';
  if (/viena/.test(n)) return 'Pan de Viena';
  if (/molde|lactal|lacteado|sandwich|tostado/.test(n)) return 'Pan de Molde';
  return null; // exclude if none match
}

export function classifyBrand(name, brandField) {
  const h = ((name || '') + ' ' + (brandField || '')).toLowerCase();
  if (/\bartesano\b/.test(h) && /\bbimbo\b/.test(h)) return { brand: 'Bimbo Artesano', isOwn: true };
  if (/\bsorchantes\b/.test(h)) return { brand: 'Los Sorchantes', isOwn: true };
  if (/\brapiditas\b/.test(h)) return { brand: 'Rapiditas', isOwn: true };
  if (/\btia rosa\b/.test(h)) return { brand: 'Tía Rosa', isOwn: true };
  if (/\bbimbo\b/.test(h)) return { brand: 'Bimbo', isOwn: true };
  // Competitor: try to use the brand field, fall back to heuristics
  const bf = (brandField || '').trim();
  if (bf) return { brand: bf, isOwn: false };
  return { brand: 'Otro', isOwn: false };
}
