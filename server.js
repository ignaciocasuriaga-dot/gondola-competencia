import express from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { runScrape } from './src/scrape.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use DATA_FILE env var, or /tmp in read-only environments (Lambda, serverless), or local data/
const DATA_FILE = process.env.DATA_FILE
  || (__dirname.startsWith('/var/task') ? '/tmp/gondola-latest.json' : join(__dirname, 'data', 'latest.json'));

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// GET /api/data — serve cached latest.json
app.get('/api/data', async (req, res) => {
  // Try primary data file, then /tmp fallback
  const candidates = [DATA_FILE, '/tmp/gondola-latest.json'].filter((v, i, a) => a.indexOf(v) === i);
  for (const f of candidates) {
    try {
      const raw = await readFile(f, 'utf-8');
      return res.type('json').send(raw);
    } catch (e) {
      if (e.code !== 'ENOENT') return res.status(500).json({ error: e.message });
    }
  }
  res.json({ generatedAt: null, items: [], scrapeResults: [] });
});

// POST /api/refresh — run scraper, return new data
let scrapeInProgress = false;
app.post('/api/refresh', async (req, res) => {
  if (scrapeInProgress) {
    return res.status(429).json({ error: 'Scrape already in progress. Please wait.' });
  }
  scrapeInProgress = true;
  try {
    const data = await runScrape();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    scrapeInProgress = false;
  }
});

app.listen(PORT, () => {
  console.log(`Gondola Competencia corriendo en http://localhost:${PORT}`);
});
