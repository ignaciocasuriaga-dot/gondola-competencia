/**
 * Góndola Competencia — Frontend (5-view rewrite)
 * Vanilla JS, ES modules. Chart.js from CDN.
 */

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES = ['Pan de Molde', 'Pan de Viena', 'Pan de Tortuga'];

const CAT_META = {
  'Pan de Molde':   { emoji: '🍞', cls: 'molde',   color: '#1976d2', label: 'PAN DE MOLDE' },
  'Pan de Viena':   { emoji: '🥖', cls: 'viena',   color: '#7b1fa2', label: 'PAN DE VIENA' },
  'Pan de Tortuga': { emoji: '🍔', cls: 'tortuga', color: '#e65100', label: 'PAN DE HAMBURGUESA' },
};

const SUPERS = ['Disco', 'TaTa', 'Tienda Inglesa', 'El Dorado'];

const SUPER_COLORS = {
  'Disco':          '#00897b',
  'TaTa':           '#6a1b9a',
  'Tienda Inglesa': '#2e7d32',
  'El Dorado':      '#e65100',
};

const BRAND_COLORS = {
  'Bimbo':          '#1565c0',
  'Los Sorchantes': '#0288d1',
  'Bauducco':       '#c2185b',
  'Visconti':       '#7b1fa2',
  'Magno':          '#e65100',
  'Marbella':       '#388e3c',
};

const OWN_BRANDS  = ['Bimbo', 'Los Sorchantes'];
const COMP_BRANDS = ['Bauducco', 'Visconti', 'Magno', 'Marbella'];
const ALL_BRANDS  = [...OWN_BRANDS, ...COMP_BRANDS];

// ── State ──────────────────────────────────────────────────────────────────

const state = {
  raw:          { generatedAt: null, items: [] },
  currentView:  'resumen',
  activeSupers: new Set(['Disco', 'TaTa', 'Tienda Inglesa', 'El Dorado']),
};

const charts = {};

// ── Utilities ──────────────────────────────────────────────────────────────

const fmt    = (n) => (n != null && !isNaN(n)) ? `$${Number(n).toFixed(0)}` : '—';
const avg    = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
const gapPct = (a, b) => (a != null && b != null && b !== 0) ? ((a - b) / b * 100) : null;

function groupBy(arr, key) {
  const m = new Map();
  for (const item of arr) {
    const k = item[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

function formatDate(iso) {
  if (!iso) return 'Sin datos';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function destroyAllCharts() {
  Object.keys(charts).forEach(destroyChart);
}

function brandColor(brand, semitransparent = false) {
  const c = BRAND_COLORS[brand] || '#9e9e9e';
  return semitransparent ? c + 'aa' : c;
}

function filteredItems() {
  return state.raw.items.filter(
    (i) => state.activeSupers.has(i.super) && ALL_BRANDS.includes(i.brand)
  );
}

function brandStatsFor(brand, items) {
  const brandItems = items.filter((i) => i.brand === brand);
  const prices     = brandItems.map((i) => i.price).filter((p) => p != null);
  const offers     = brandItems.filter((i) => i.listPrice && i.listPrice > i.price);
  const discounts  = offers.map((i) => (1 - i.price / i.listPrice) * 100);
  return {
    total:       brandItems.length,
    avgPrice:    avg(prices),
    minPrice:    prices.length ? Math.min(...prices) : null,
    maxPrice:    prices.length ? Math.max(...prices) : null,
    offerCount:  offers.length,
    offerItems:  offers,
    avgDiscount: avg(discounts),
  };
}

// ── Toast ──────────────────────────────────────────────────────────────────

function toast(msg, type = 'info', duration = 4500) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

function clearToasts() {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
}

// ── Header ─────────────────────────────────────────────────────────────────

function updateLastUpdate() {
  const el = document.getElementById('lastUpdate');
  if (el) el.textContent = state.raw.generatedAt
    ? `Actualizado: ${formatDate(state.raw.generatedAt)}`
    : 'Sin datos';
}

// ── Navigation ─────────────────────────────────────────────────────────────

function setView(view) {
  destroyAllCharts();
  state.currentView = view;
  document.querySelectorAll('.nav-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.view === view);
  });
  render();
}

// ── CSV Export ─────────────────────────────────────────────────────────────

function exportCSV() {
  const items = state.raw.items;
  if (!items || !items.length) { toast('No hay datos para exportar.', 'error'); return; }

  const headers = ['Supermercado', 'Marca', 'Categoría', 'Producto', 'Precio', 'Precio Lista', 'En Oferta', 'Descuento %', 'SKU', 'URL'];
  const rows = items.map((i) => {
    const hasOffer = i.listPrice && i.listPrice > i.price;
    const disc = hasOffer ? ((1 - i.price / i.listPrice) * 100).toFixed(1) : '';
    return [
      i.super, i.brand, i.category, i.name,
      i.price ?? '', i.listPrice ?? '',
      hasOffer ? 'Sí' : 'No', disc, i.sku, i.url ?? '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const date = state.raw.generatedAt ? new Date(state.raw.generatedAt).toISOString().slice(0, 10) : 'datos';
  const a    = document.createElement('a');
  a.href = url; a.download = `gondola-competencia-${date}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast(`CSV exportado: ${items.length} productos`, 'success');
}

// ── Empty state helper ─────────────────────────────────────────────────────

function emptyStateHtml() {
  return `
    <div class="empty-state">
      <div class="empty-state-emoji">📦</div>
      <h3>Sin datos cargados</h3>
      <p>Todavía no se han obtenido precios. Hacé clic en "Actualizar" para iniciar el relevamiento.</p>
      <button class="btn-refresh" id="emptyRefreshBtn">
        <svg class="refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Actualizar Precios
      </button>
    </div>`;
}

// ── Horizontal bar chart helper ────────────────────────────────────────────

function makeHBarChart(canvasId, entries, highlightBrands = []) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx || !entries.length) return;
  destroyChart(canvasId);
  const bgColors = entries.map((e) => {
    const isOwn = OWN_BRANDS.includes(e.brand);
    const base  = brandColor(e.brand);
    if (highlightBrands.length) {
      return highlightBrands.includes(e.brand) ? base : base + 'aa';
    }
    return isOwn ? base : base + 'aa';
  });
  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: entries.map((e) => e.brand),
      datasets: [{
        data:            entries.map((e) => Math.round(e.avgPrice)),
        backgroundColor: bgColors,
        borderRadius:    6,
        borderSkipped:   false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` $${c.parsed.x}` } },
      },
      scales: {
        x: {
          beginAtZero: false,
          ticks: { callback: (v) => '$' + v, font: { size: 10 } },
          grid: { color: '#f0f0f0' },
          border: { display: false },
        },
        y: {
          ticks: { font: { size: 11 }, color: '#334155' },
          grid: { display: false },
          border: { display: false },
        },
      },
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 1 — RESUMEN
// ══════════════════════════════════════════════════════════════════════════

function renderResumen() {
  const main  = document.getElementById('appMain');
  const items = filteredItems();

  if (!items.length) {
    main.innerHTML = emptyStateHtml();
    document.getElementById('emptyRefreshBtn')?.addEventListener('click', doRefresh);
    return;
  }

  const totalSKUs  = items.length;
  const brands     = [...new Set(items.map((i) => i.brand))].filter((b) => ALL_BRANDS.includes(b));
  const offers     = items.filter((i) => i.listPrice && i.listPrice > i.price);
  const superCount = [...new Set(items.map((i) => i.super))].length;

  const kpiHtml = `
    <div class="summary-kpis">
      <div class="kpi-card">
        <div class="kpi-val">${totalSKUs}</div>
        <div class="kpi-lbl">Total SKUs</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val">${brands.length}</div>
        <div class="kpi-lbl">Marcas encontradas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val">${offers.length}</div>
        <div class="kpi-lbl">Productos en oferta</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val">${superCount}</div>
        <div class="kpi-lbl">Supermercados</div>
      </div>
    </div>`;

  const catCardsHtml = CATEGORIES.map((cat) => {
    const catItems = items.filter((i) => i.category === cat);
    const catBrands = ALL_BRANDS.filter((b) => catItems.some((i) => i.brand === b));
    const chartH = Math.max(160, catBrands.length * 44 + 40);
    const meta = CAT_META[cat];
    return `
      <div class="resumen-card">
        <div class="section-card-head">
          <span style="font-size:1.4rem">${meta.emoji}</span>
          <span class="section-card-title">${cat}</span>
          <span class="section-card-meta">${catBrands.length} marcas · ${catItems.length} SKUs</span>
        </div>
        <div style="position:relative;height:${chartH}px">
          <canvas id="resumen-chart-${meta.cls}"></canvas>
        </div>
      </div>`;
  }).join('');

  main.innerHTML = `
    ${kpiHtml}
    <div class="resumen-grid">${catCardsHtml}</div>
    <div class="csv-bar">
      <button class="btn-csv" id="btnExportCSV">⬇ Descargar CSV completo</button>
      <span class="csv-meta">${totalSKUs} productos · ${state.raw.generatedAt ? formatDate(state.raw.generatedAt) : '—'}</span>
    </div>`;

  document.getElementById('btnExportCSV')?.addEventListener('click', exportCSV);

  requestAnimationFrame(() => {
    for (const cat of CATEGORIES) {
      const meta = CAT_META[cat];
      const catItems = items.filter((i) => i.category === cat);
      const entries = ALL_BRANDS
        .map((brand) => {
          const s = brandStatsFor(brand, catItems);
          return s.total && s.avgPrice != null ? { brand, avgPrice: s.avgPrice } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.avgPrice - b.avgPrice);
      makeHBarChart(`resumen-chart-${meta.cls}`, entries);
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 2 — MIS MARCAS
// ══════════════════════════════════════════════════════════════════════════

function renderMisMarcas() {
  const main  = document.getElementById('appMain');
  const items = filteredItems();

  if (!items.length) {
    main.innerHTML = emptyStateHtml();
    document.getElementById('emptyRefreshBtn')?.addEventListener('click', doRefresh);
    return;
  }

  // Hero cards per own brand
  const heroHtml = OWN_BRANDS.map((brand) => {
    const bColor  = brandColor(brand);
    const bItems  = items.filter((i) => i.brand === brand);
    const prices  = bItems.map((i) => i.price).filter((p) => p != null);
    const avgP    = avg(prices);
    const stores  = [...new Set(bItems.map((i) => i.super))];
    return `
      <div class="mm-hero-card" style="border-left-color:${bColor}">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <span class="brand-pill own" style="background:${bColor}22;color:${bColor};font-size:.85rem;padding:4px 12px">${brand}</span>
          <span class="brand-hero-badge own-badge" style="background:${bColor}">NUESTRA MARCA</span>
        </div>
        <div class="brand-hero-kpis" style="justify-content:flex-start;gap:28px">
          <div class="brand-kpi">
            <div class="brand-kpi-val">${bItems.length}</div>
            <div class="brand-kpi-label">SKUs</div>
          </div>
          <div class="brand-kpi">
            <div class="brand-kpi-val">${fmt(avgP)}</div>
            <div class="brand-kpi-label">Precio prom.</div>
          </div>
          <div class="brand-kpi">
            <div class="brand-kpi-val">${stores.length}</div>
            <div class="brand-kpi-label">Supers presentes</div>
          </div>
        </div>
        <div style="margin-top:10px;font-size:.8rem;color:#64748b">${stores.join(', ') || 'Sin datos'}</div>
      </div>`;
  }).join('');

  // Per-category price chart sections
  const catChartsHtml = CATEGORIES.map((cat) => {
    const catItems = items.filter((i) => i.category === cat);
    const meta = CAT_META[cat];
    const catBrands = ALL_BRANDS.filter((b) => catItems.some((i) => i.brand === b));
    const chartH = Math.max(160, catBrands.length * 44 + 40);
    return `
      <div class="section-card" style="margin:0 0 0 0">
        <div class="section-card-head">
          <span style="font-size:1.1rem">${meta.emoji}</span>
          <span class="section-card-title">${cat}</span>
          <span class="section-card-meta">${catBrands.length} marcas</span>
        </div>
        <div style="position:relative;height:${chartH}px">
          <canvas id="mm-chart-${meta.cls}"></canvas>
        </div>
      </div>`;
  }).join('');

  // GAP table: own brands vs each competitor
  const gapRowsHtml = OWN_BRANDS.map((own) => {
    const ownStats = brandStatsFor(own, items);
    if (!ownStats.avgPrice) return '';
    const cells = COMP_BRANDS.map((comp) => {
      const compStats = brandStatsFor(comp, items);
      const gap = gapPct(ownStats.avgPrice, compStats.avgPrice);
      if (gap === null) return '<td class="price-cell">—</td>';
      const sign = gap > 0 ? '+' : '';
      const cls  = gap <= 0 ? 'positive' : 'negative';
      return `<td class="price-cell"><span class="gap-pill ${cls}">${sign}${gap.toFixed(1)}%</span></td>`;
    }).join('');
    return `
      <tr>
        <td><span class="brand-pill own">${own}</span></td>
        <td class="price-cell">${fmt(ownStats.avgPrice)}</td>
        ${cells}
      </tr>`;
  }).join('');

  const compHeaderCells = COMP_BRANDS.map((b) => `<th>${b}</th>`).join('');

  // Active offers for own brands
  const ownOffers = items.filter((i) => OWN_BRANDS.includes(i.brand) && i.listPrice && i.listPrice > i.price);
  const offersHtml = ownOffers.length
    ? ownOffers.map((p) => {
        const disc = Math.round((1 - p.price / p.listPrice) * 100);
        return `
          <div class="offer-row">
            <span class="offer-super-tag">${p.super}</span>
            <span class="brand-pill own">${p.brand}</span>
            <span class="offer-cat-tag">${p.category}</span>
            <span class="offer-name">${p.name}</span>
            <span class="offer-prices">
              <s class="offer-list-price">${fmt(p.listPrice)}</s>
              <strong class="offer-sale-price">${fmt(p.price)}</strong>
            </span>
            <span class="offer-badge">-${disc}%</span>
          </div>`;
      }).join('')
    : '<div class="tab-empty">No hay ofertas activas para Mis Marcas.</div>';

  main.innerHTML = `
    <div class="mm-hero-grid">${heroHtml}</div>

    <div class="section-card" style="margin:16px 0 0">
      <div class="section-card-head">
        <span class="section-card-title">Precio promedio por categoría (propias destacadas)</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
        ${catChartsHtml}
      </div>
    </div>

    <div class="section-card" style="margin:16px 0 0">
      <div class="section-card-head">
        <span class="section-card-title">GAP % — Mis Marcas vs Competencia (precio promedio global)</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Marca propia</th>
              <th>Precio prom.</th>
              ${compHeaderCells}
            </tr>
          </thead>
          <tbody>${gapRowsHtml || '<tr><td colspan="6" class="tab-empty">Sin datos</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <div class="section-card" style="margin:16px 0 0">
      <div class="section-card-head">
        <span class="section-card-title">Ofertas activas — Mis Marcas (${ownOffers.length})</span>
      </div>
      ${offersHtml}
    </div>`;

  requestAnimationFrame(() => {
    for (const cat of CATEGORIES) {
      const meta = CAT_META[cat];
      const catItems = items.filter((i) => i.category === cat);
      const entries = ALL_BRANDS
        .map((brand) => {
          const s = brandStatsFor(brand, catItems);
          return s.total && s.avgPrice != null ? { brand, avgPrice: s.avgPrice } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.avgPrice - b.avgPrice);
      makeHBarChart(`mm-chart-${meta.cls}`, entries, OWN_BRANDS);
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 3 — OFERTAS
// ══════════════════════════════════════════════════════════════════════════

function renderOfertas() {
  const main  = document.getElementById('appMain');
  const items = filteredItems();

  if (!items.length) {
    main.innerHTML = emptyStateHtml();
    document.getElementById('emptyRefreshBtn')?.addEventListener('click', doRefresh);
    return;
  }

  const offers = items.filter((i) => i.listPrice && i.listPrice > i.price);

  if (!offers.length) {
    main.innerHTML = `<div class="tab-empty" style="padding:80px 24px">No hay ofertas activas con los filtros seleccionados.</div>`;
    return;
  }

  const discounts = offers.map((i) => (1 - i.price / i.listPrice) * 100);
  const avgDisc   = avg(discounts);
  const maxDisc   = Math.max(...discounts);
  const ownOffers = offers.filter((i) => OWN_BRANDS.includes(i.brand)).length;

  const kpiHtml = `
    <div class="summary-kpis">
      <div class="kpi-card">
        <div class="kpi-val">${offers.length}</div>
        <div class="kpi-lbl">Productos en oferta</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val">${avgDisc?.toFixed(1) ?? '—'}%</div>
        <div class="kpi-lbl">Descuento promedio</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val">${maxDisc?.toFixed(0) ?? '—'}%</div>
        <div class="kpi-lbl">Mayor descuento</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val">${ownOffers}</div>
        <div class="kpi-lbl">Ofertas propias</div>
      </div>
    </div>`;

  // Sort all offers by discount desc, then group by brand
  const sorted  = [...offers].sort((a, b) =>
    (1 - a.price / a.listPrice) - (1 - b.price / b.listPrice)
  ).reverse();

  const byBrand = groupBy(sorted, 'brand');
  // Sort brands: own first, then by number of offers desc
  const brandOrder = [...byBrand.entries()].sort((a, b) => {
    const aOwn = OWN_BRANDS.includes(a[0]) ? 0 : 1;
    const bOwn = OWN_BRANDS.includes(b[0]) ? 0 : 1;
    if (aOwn !== bOwn) return aOwn - bOwn;
    return b[1].length - a[1].length;
  });

  const brandsHtml = brandOrder.map(([brand, bOffers]) => {
    const isOwn = OWN_BRANDS.includes(brand);
    const rows = bOffers.map((p) => {
      const disc = Math.round((1 - p.price / p.listPrice) * 100);
      return `
        <div class="offer-row">
          <span class="offer-super-tag">${p.super}</span>
          <span class="offer-cat-tag">${p.category}</span>
          <span class="offer-name">${p.name}</span>
          <span class="offer-prices">
            <s class="offer-list-price">${fmt(p.listPrice)}</s>
            <strong class="offer-sale-price">${fmt(p.price)}</strong>
          </span>
          <span class="offer-badge">-${disc}%</span>
        </div>`;
    }).join('');

    return `
      <div class="offer-brand-block" style="margin-bottom:12px">
        <div class="offer-brand-head">
          <span class="brand-pill ${isOwn ? 'own' : 'comp'}">${brand}</span>
          <span class="muted">${bOffers.length} producto${bOffers.length > 1 ? 's' : ''} en oferta</span>
        </div>
        <div class="offer-rows">${rows}</div>
      </div>`;
  }).join('');

  main.innerHTML = `
    ${kpiHtml}
    <div style="padding:0 0 24px">
      ${brandsHtml}
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 4 — COMPARATIVA
// ══════════════════════════════════════════════════════════════════════════

function renderComparativa() {
  const main       = document.getElementById('appMain');
  const items      = filteredItems();
  const activeSupers = SUPERS.filter((s) => state.activeSupers.has(s));

  if (!items.length) {
    main.innerHTML = emptyStateHtml();
    document.getElementById('emptyRefreshBtn')?.addEventListener('click', doRefresh);
    return;
  }

  let html = '';

  for (const cat of CATEGORIES) {
    const meta     = CAT_META[cat];
    const catItems = items.filter((i) => i.category === cat);
    const catBrands = ALL_BRANDS.filter((b) => catItems.some((i) => i.brand === b));

    if (!catBrands.length) continue;

    // Chart entries: avg price per brand across all supers
    const chartEntries = catBrands
      .map((brand) => {
        const s = brandStatsFor(brand, catItems);
        return s.avgPrice != null ? { brand, avgPrice: s.avgPrice } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.avgPrice - b.avgPrice);

    const cheapest  = chartEntries[0];
    const mostExp   = chartEntries[chartEntries.length - 1];
    const chartH    = Math.max(160, catBrands.length * 44 + 40);
    const chartId   = `comp-chart-${meta.cls}`;

    // Table: rows = brands, columns = supers + general avg/min/max
    const superHeaders = activeSupers.map((s) => `<th style="text-align:right;color:${SUPER_COLORS[s]}">${s}</th>`).join('');
    const tableRows = catBrands.map((brand) => {
      const isOwn = OWN_BRANDS.includes(brand);
      const superCells = activeSupers.map((s) => {
        const superBrandItems = catItems.filter((i) => i.brand === brand && i.super === s);
        if (!superBrandItems.length) return '<td class="price-cell">—</td>';
        const a = avg(superBrandItems.map((i) => i.price).filter((p) => p != null));
        return `<td class="price-cell">${fmt(a)}</td>`;
      }).join('');
      const allBrandItems = catItems.filter((i) => i.brand === brand);
      const allPrices     = allBrandItems.map((i) => i.price).filter((p) => p != null);
      const gAvg = avg(allPrices);
      const gMin = allPrices.length ? Math.min(...allPrices) : null;
      const gMax = allPrices.length ? Math.max(...allPrices) : null;
      return `
        <tr>
          <td><span class="brand-pill ${isOwn ? 'own' : 'comp'}">${brand}</span></td>
          ${superCells}
          <td class="price-cell">${fmt(gAvg)}</td>
          <td class="price-cell" style="color:#2e7d32;font-size:.8rem">${fmt(gMin)}</td>
          <td class="price-cell" style="color:#c62828;font-size:.8rem">${fmt(gMax)}</td>
        </tr>`;
    }).join('');

    html += `
      <div class="section-card">
        <div class="section-card-head">
          <span style="font-size:1.2rem">${meta.emoji}</span>
          <span class="section-card-title">${cat}</span>
        </div>
        <div class="insight-bar">
          ${cheapest ? `<span class="insight insight-green">🏆 Más barato: ${cheapest.brand} (${fmt(cheapest.avgPrice)} prom.)</span>` : ''}
          ${mostExp && mostExp.brand !== cheapest?.brand ? `<span class="insight insight-red">💸 Más caro: ${mostExp.brand} (${fmt(mostExp.avgPrice)} prom.)</span>` : ''}
        </div>
        <div style="position:relative;height:${chartH}px;margin-bottom:20px">
          <canvas id="${chartId}"></canvas>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Marca</th>
                ${superHeaders}
                <th style="text-align:right">Prom. general</th>
                <th style="text-align:right">Mín.</th>
                <th style="text-align:right">Máx.</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  main.innerHTML = html || '<div class="tab-empty">Sin datos para los filtros seleccionados.</div>';

  requestAnimationFrame(() => {
    for (const cat of CATEGORIES) {
      const meta     = CAT_META[cat];
      const catItems = items.filter((i) => i.category === cat);
      const catBrands = ALL_BRANDS.filter((b) => catItems.some((i) => i.brand === b));
      const entries   = catBrands
        .map((brand) => {
          const s = brandStatsFor(brand, catItems);
          return s.avgPrice != null ? { brand, avgPrice: s.avgPrice } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.avgPrice - b.avgPrice);
      makeHBarChart(`comp-chart-${meta.cls}`, entries);
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 5 — COBERTURA
// ══════════════════════════════════════════════════════════════════════════

function renderCobertura() {
  const main         = document.getElementById('appMain');
  const items        = filteredItems();
  const activeSupers = SUPERS.filter((s) => state.activeSupers.has(s));

  if (!items.length) {
    main.innerHTML = emptyStateHtml();
    document.getElementById('emptyRefreshBtn')?.addEventListener('click', doRefresh);
    return;
  }

  const presentBrands = ALL_BRANDS.filter((b) => items.some((i) => i.brand === b));

  // Matrix table: rows = brands, cols = supers
  const superHeaders = activeSupers.map((s) => `<th class="num-cell" style="color:${SUPER_COLORS[s]}">${s}</th>`).join('');
  const matrixRows = presentBrands.map((brand) => {
    const isOwn = OWN_BRANDS.includes(brand);
    const cells = activeSupers.map((s) => {
      const count = items.filter((i) => i.brand === brand && i.super === s).length;
      const cls   = count === 0 ? 'cov-zero' : isOwn ? 'cov-own' : 'cov-comp';
      return `<td class="cov-cell ${cls}">${count > 0 ? count : '—'}</td>`;
    }).join('');
    const total = items.filter((i) => i.brand === brand).length;
    return `
      <tr>
        <td><span class="brand-pill ${isOwn ? 'own' : 'comp'}">${brand}</span></td>
        ${cells}
        <td class="cov-cell cov-total">${total}</td>
      </tr>`;
  }).join('');

  // Totals row
  const totalCells = activeSupers.map((s) => {
    const count = items.filter((i) => i.super === s).length;
    return `<td class="cov-cell cov-total">${count}</td>`;
  }).join('');
  const grandTotal = items.length;

  // Per-supermarket blocks
  const superBlocksHtml = activeSupers.map((s) => {
    const superItems = items.filter((i) => i.super === s);
    const ownItems   = superItems.filter((i) => OWN_BRANDS.includes(i.brand));
    const compItems  = superItems.filter((i) => COMP_BRANDS.includes(i.brand));
    const color      = SUPER_COLORS[s];
    const brandsPresent = presentBrands.filter((b) => superItems.some((i) => i.brand === b));
    const pillsHtml = brandsPresent.map((brand) => {
      const cnt   = superItems.filter((i) => i.brand === brand).length;
      const isOwn = OWN_BRANDS.includes(brand);
      return `<span class="brand-pill ${isOwn ? 'own' : 'comp'}">${brand} <span class="pill-count">${cnt}</span></span>`;
    }).join('');

    return `
      <div class="coverage-block" style="--super-color:${color}">
        <div class="coverage-block-head">
          <span class="coverage-super-name" style="color:${color}">${s}</span>
          <span class="coverage-meta">
            <span class="coverage-stat">${superItems.length} SKUs</span>
            <span class="brand-pill own">Propias ${ownItems.length}</span>
            <span class="brand-pill comp">Comp. ${compItems.length}</span>
          </span>
        </div>
        <div class="coverage-brands">
          ${pillsHtml || '<span class="muted">Sin productos</span>'}
        </div>
      </div>`;
  }).join('');

  main.innerHTML = `
    <div class="section-card">
      <div class="section-card-head">
        <span class="section-card-title">Matriz de cobertura: SKUs por marca × supermercado</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Marca</th>
              ${superHeaders}
              <th class="num-cell">Total</th>
            </tr>
          </thead>
          <tbody>
            ${matrixRows}
            <tr>
              <td style="font-weight:700;font-size:.8rem;color:#64748b">TOTAL</td>
              ${totalCells}
              <td class="cov-cell cov-total">${grandTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="section-card">
      <div class="section-card-head">
        <span class="section-card-title">Presencia por supermercado</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${superBlocksHtml}
      </div>
    </div>`;
}

// ── Main render ────────────────────────────────────────────────────────────

function render() {
  switch (state.currentView) {
    case 'resumen':     renderResumen();     break;
    case 'misMarcas':   renderMisMarcas();   break;
    case 'ofertas':     renderOfertas();     break;
    case 'comparativa': renderComparativa(); break;
    case 'cobertura':   renderCobertura();   break;
    default:            renderResumen();
  }
}

// ── Filter wiring ──────────────────────────────────────────────────────────

function initFilters() {
  document.querySelectorAll('#chipSupers .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const s = chip.dataset.super;
      if (state.activeSupers.has(s)) {
        state.activeSupers.delete(s);
        chip.classList.remove('active');
      } else {
        state.activeSupers.add(s);
        chip.classList.add('active');
      }
      destroyAllCharts();
      render();
    });
  });
}

// ── Nav wiring ─────────────────────────────────────────────────────────────

function initNav() {
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
}

// ── Refresh ────────────────────────────────────────────────────────────────

async function doRefresh() {
  const btn = document.getElementById('btnRefresh');
  if (!btn) return;
  btn.disabled = true;
  btn.classList.add('spinning');
  clearToasts();
  toast('Consultando supermercados… puede tardar ~30 segundos', 'info', 90000);

  try {
    const res = await fetch('/api/refresh', {
      method: 'POST',
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    state.raw = data;
    updateLastUpdate();
    clearToasts();

    const count   = data.items?.length ?? 0;
    const results = data.scrapeResults ?? [];
    const ok      = results.filter((r) => r.ok).length;
    const failed  = results.filter((r) => !r.ok);

    if (failed.length > 0) {
      toast(`✓ ${count} productos de ${ok}/${results.length} supermercados. Fallaron: ${failed.map((f) => f.name).join(', ')}`, 'info', 8000);
    } else {
      toast(`✓ ${count} productos actualizados (${results.length} supermercados)`, 'success');
    }
    destroyAllCharts();
    render();
  } catch (e) {
    clearToasts();
    if (e.name === 'TimeoutError' || e.message.includes('timeout')) {
      toast('Tiempo de espera agotado. El servidor puede estar detenido — corré npm start', 'error', 8000);
    } else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
      toast('No se pudo conectar al servidor. Asegurate de correr: npm start', 'error', 8000);
    } else {
      toast(`Error: ${e.message}`, 'error');
    }
  } finally {
    btn.disabled = false;
    btn.classList.remove('spinning');
  }
}

// ── Data loading ───────────────────────────────────────────────────────────

async function loadData() {
  const main = document.getElementById('appMain');
  main.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Cargando datos…</p>
    </div>`;
  try {
    const res  = await fetch('/api/data');
    const data = await res.json();
    state.raw  = data;
    updateLastUpdate();
    render();
  } catch (e) {
    state.raw = { generatedAt: null, items: [] };
    render();
    toast('No se pudo cargar datos: ' + e.message, 'error');
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  initFilters();
  initNav();
  document.getElementById('btnRefresh').addEventListener('click', doRefresh);
  document.getElementById('headerHome')?.addEventListener('click', () => setView('resumen'));
  await loadData();
});
