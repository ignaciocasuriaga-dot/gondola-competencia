/**
 * Main scraper orchestrator.
 * Searches all categories across 4 supermarkets, classifies results, saves to data/latest.json.
 */
import { fileURLToPath } from 'node:url';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { scrapeTata } from './scrapers/tata.js';
import { scrapeDisco } from './scrapers/disco.js';
import { scrapeTiendaInglesa } from './scrapers/tiendainglesa.js';
import { scrapeElDorado } from './scrapers/eldorado.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = process.env.DATA_FILE
  || (__dirname.startsWith('/var/task') ? '/tmp/gondola-latest.json' : join(__dirname, '..', 'data', 'latest.json'));

export const SEARCH_TERMS = [
  'pan bimbo', 'bimbo pan', 'bimbo artesano', 'los sorchantes', 'sorchantes',
  'pan de molde', 'pan lactal', 'pan sandwich',
  'pan tortuga', 'pan hamburguesa',
  'pan viena', 'pan pancho', 'pan panchos', 'panchos pan',
  'magno pan', 'pan magno',
  'bauducco', 'pan bauducco', 'bauducco pan', 'bauduco', 'pan bauduco', 'pan de miga bauduco',
  'visconti pan', 'pan visconti',
  'marbella pan', 'pan marbella',
  'precio lider pan', 'pan precio lider',
];

export async function runScrape() {
  console.log('Iniciando scraping...');
  const scrapers = [
    { name: 'TaTa', fn: () => scrapeTata(SEARCH_TERMS) },
    { name: 'Disco', fn: () => scrapeDisco(SEARCH_TERMS) },
    { name: 'Tienda Inglesa', fn: () => scrapeTiendaInglesa(SEARCH_TERMS) },
    { name: 'El Dorado', fn: () => scrapeElDorado(SEARCH_TERMS) },
  ];

  const results = await Promise.allSettled(scrapers.map(s => s.fn()));

  const scrapeResults = [];
  const allItems = [];

  for (let i = 0; i < scrapers.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      console.log(`  ✓ ${scrapers[i].name}: ${r.value.length} productos`);
      scrapeResults.push({ name: scrapers[i].name, ok: true, count: r.value.length });
      allItems.push(...r.value);
    } else {
      console.error(`  ✗ ${scrapers[i].name}: ${r.reason?.message ?? r.reason}`);
      scrapeResults.push({ name: scrapers[i].name, ok: false, count: 0, error: String(r.reason?.message ?? r.reason) });
    }
  }

  // Deduplicate across stores by super+sku
  const seen = new Set();
  const items = allItems.filter(item => {
    const key = `${item.super}::${item.sku}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const output = {
    generatedAt: new Date().toISOString(),
    scrapeResults,
    items,
  };

  const dataDir = dirname(DATA_FILE);
  await mkdir(dataDir, { recursive: true }).catch(() => {});
  await writeFile(DATA_FILE, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\nTotal: ${items.length} productos → ${DATA_FILE}`);
  return output;
}

// Allow running directly: node src/scrape.js
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runScrape().catch(e => { console.error(e); process.exit(1); });
}
