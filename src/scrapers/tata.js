import axios from 'axios';
import { classifyCategory, classifyBrand } from '../classify.js';

// TaTa runs on VTEX — use the catalog search API (simpler and more stable than GraphQL)
const ENDPOINT = 'https://www.tata.com.uy/api/catalog_system/pub/products/search';
const HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'es-UY,es;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Referer: 'https://www.tata.com.uy/',
  Origin: 'https://www.tata.com.uy',
};

function offerFrom(product) {
  const item = product.items?.[0];
  const seller = item?.sellers?.find(s => s.sellerDefault) ?? item?.sellers?.[0];
  return {
    sku: item?.itemId ?? product.productId,
    name: item?.nameComplete ?? item?.name ?? product.productName ?? '',
    brandField: product.brand ?? '',
    price: seller?.commertialOffer?.Price ?? null,
    listPrice: seller?.commertialOffer?.ListPrice ?? null,
    url: product.link ?? (product.linkText ? `https://www.tata.com.uy/${product.linkText}/p` : null),
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

export async function scrapeTata(terms) {
  const bySku = new Map();
  const searched = new Set();

  for (const rawTerm of terms) {
    const inputs = [rawTerm];
    const words = rawTerm.split(/\s+/).filter(w => w.length > 3);
    if (words.length > 1) inputs.push(words[words.length - 1]);

    for (const term of inputs) {
      if (!term || searched.has(term)) continue;
      searched.add(term);

      let products;
      try {
        products = await searchTerm(term);
      } catch (e) {
        console.error(`  ⚠ tata "${term}": ${e.message}`);
        continue;
      }

      for (const product of products) {
        const base = offerFrom(product);
        if (!base.name) continue;
        if (!base.price || base.price <= 0) continue;

        const category = classifyCategory(base.name);
        if (!category) continue;
        if (bySku.has(base.sku)) continue;

        const _br = classifyBrand(base.name, base.brandField);
        if (!_br) continue;
        const { brand, isOwn } = _br;
        bySku.set(base.sku, {
          super: 'TaTa',
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
