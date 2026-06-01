import { classifyCategory, classifyBrand } from '../classify.js';

const ENDPOINT = 'https://www.eldorado.com.uy/api/catalog_system/pub/products/search';
const HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

function offerFrom(product) {
  const item = product.items?.[0];
  const seller = item?.sellers?.find((s) => s.sellerDefault) ?? item?.sellers?.[0];
  return {
    sku: item?.itemId ?? product.productId,
    name: item?.nameComplete ?? item?.name ?? product.productName,
    brandField: product.brand ?? '',
    price: seller?.commertialOffer?.Price ?? null,
    listPrice: seller?.commertialOffer?.ListPrice ?? null,
    url: product.link ?? (product.linkText ? `https://www.eldorado.com.uy/${product.linkText}/p` : null),
  };
}

async function searchTerm(term) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('ft', term);
  url.searchParams.set('_from', '0');
  url.searchParams.set('_to', '49');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const resp = await fetch(url, { headers: HEADERS, signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  } finally {
    clearTimeout(timer);
  }
}

export async function scrapeElDorado(terms) {
  const bySku = new Map();
  const searched = new Set();

  for (const rawTerm of terms) {
    // For multi-word terms that may not match well, also try single-word fallback
    const inputs = new Set([rawTerm]);
    const words = rawTerm.split(/\s+/).filter(w => w.length > 3);
    if (words.length > 1) inputs.add(words[words.length - 1]); // add last meaningful word

    for (const term of inputs) {
      if (!term || searched.has(term)) continue;
      searched.add(term);

      let products;
      try { products = await searchTerm(term); }
      catch (e) { console.error(`  ⚠ eldorado "${term}": ${e.message}`); continue; }

      for (const product of products) {
        const base = offerFrom(product);
        if (!base.name) continue;
        if (!base.price || base.price <= 0) continue;
        const category = classifyCategory(base.name);
        if (!category) continue;
        if (bySku.has(base.sku)) continue;

        const { brand, isOwn } = classifyBrand(base.name, base.brandField);
        bySku.set(base.sku, {
          super: 'El Dorado',
          sku: base.sku,
          name: base.name,
          brand,
          isOwn,
          category,
          price: base.price,
          listPrice: base.listPrice,
          currency: 'UYU',
          url: base.url,
        });
      }
    }
  }
  return [...bySku.values()];
}
