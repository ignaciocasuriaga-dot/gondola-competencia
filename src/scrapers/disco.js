/**
 * Disco scraper — uses VTEX search API (same engine as El Dorado / Tienda Inglesa).
 * Disco runs on VTEX so we can query its catalog API directly without a browser.
 */
import axios from 'axios';
import { classifyCategory, classifyBrand } from '../classify.js';

const ENDPOINT = 'https://www.disco.com.uy/api/catalog_system/pub/products/search';
const HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Referer: 'https://www.disco.com.uy/',
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
    url: product.link ?? (product.linkText ? `https://www.disco.com.uy/${product.linkText}/p` : null),
  };
}

async function searchTerm(term) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('ft', term);
  url.searchParams.set('_from', '0');
  url.searchParams.set('_to', '49');

  const { data } = await axios.get(url.toString(), { headers: HEADERS, timeout: 30000 });
  return Array.isArray(data) ? data : [];
}

export async function scrapeDisco(terms) {
  const bySku = new Map();
  const searched = new Set();

  for (const rawTerm of terms) {
    const inputs = new Set([rawTerm]);
    const words = rawTerm.split(/\s+/).filter(w => w.length > 3);
    if (words.length > 1) inputs.add(words[words.length - 1]);

    for (const term of inputs) {
      if (!term || searched.has(term)) continue;
      searched.add(term);

      let products;
      try { products = await searchTerm(term); }
      catch (e) { console.error(`  ⚠ disco "${term}": ${e.message}`); continue; }

      for (const product of products) {
        const base = offerFrom(product);
        if (!base.name) continue;
        if (!base.price || base.price <= 0) continue;
        const category = classifyCategory(base.name);
        if (!category) continue;
        if (bySku.has(base.sku)) continue;

        const { brand, isOwn } = classifyBrand(base.name, base.brandField);
        bySku.set(base.sku, {
          super: 'Disco',
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
