/**
 * Góndola Competencia — Frontend
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

const COMP_COLORS = {
  'Magno':        '#f57c00',
  'Bauducco':     '#c2185b',
  'Visconti':     '#0288d1',
  'Marbella':     '#388e3c',
  'Precio Líder': '#5d4037',
};

const OWN_BRANDS  = ['Bimbo', 'Los Sorchantes'];
const COMP_BRANDS = ['Magno', 'Bauducco', 'Visconti', 'Marbella', 'Precio Líder'];

const BADGE_IDS = {
  'Pan de Molde':   'badgeMolde',
  'Pan de Viena':   'badgeViena',
  'Pan de Tortuga': 'badgeTortuga',
};

// ── State ──────────────────────────────────────────────────────────────────

const state = {
  raw: { generatedAt: null, items: [] },
  view: 'home',          // 'home' | 'category' | 'brand'
  currentCat: null,
  currentBrand: null,
  activeSupers: new Set(['Disco', 'TaTa', 'Tienda Inglesa', 'El Dorado']),
  activeBrands: new Set(['Bimbo', 'Los Sorchantes', 'Magno', 'Bauducco', 'Visconti', 'Marbella', 'Precio Líder']),
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

function brandColor(brand) {
  if (OWN_BRANDS.includes(brand)) return '#1976d2';
  return COMP_COLORS[brand] || '#9e9e9e';
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

// ── Header / badges ────────────────────────────────────────────────────────

function updateLastUpdate() {
  const el = document.getElementById('lastUpdate');
  if (el) el.textContent = state.raw.generatedAt
    ? `Actualizado: ${formatDate(state.raw.generatedAt)}`
    : 'Sin datos';
}

function updateCategoryBadges() {
  for (const cat of CATEGORIES) {
    const el = document.getElementById(BADGE_IDS[cat]);
    if (!el) continue;
    const count = state.raw.items.filter((i) => i.category === cat).length;
    el.textContent = count > 0 ? `${count}` : '—';
  }
}

// ── Navigation ─────────────────────────────────────────────────────────────

function setView(view, cat, brand) {
  destroyAllCharts();
  state.view = view;
  state.currentCat = cat || null;
  state.currentBrand = brand || null;
  render();
}

function exportPDF() {
  window.print();
}

function exportCSV() {
  const items = state.raw.items;
  if (!items || !items.length) { toast('No hay datos para exportar.', 'error'); return; }

  const headers = ['Supermercado', 'Marca', 'Categoría', 'Producto', 'Precio', 'Precio Lista', 'En Oferta', 'Descuento %', 'SKU', 'URL'];
  const rows = items.map((i) => {
    const hasOffer = i.listPrice && i.listPrice > i.price;
    const disc = hasOffer ? ((1 - i.price / i.listPrice) * 100).toFixed(1) : '';
    return [
      i.super,
      i.brand,
      i.category,
      i.name,
      i.price ?? '',
      i.listPrice ?? '',
      hasOffer ? 'Sí' : 'No',
      disc,
      i.sku,
      i.url ?? '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const date = state.raw.generatedAt ? new Date(state.raw.generatedAt).toISOString().slice(0, 10) : 'datos';
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `gondola-competencia-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`CSV exportado: ${items.length} productos`, 'success');
}

// ── Home view ──────────────────────────────────────────────────────────────

function renderHome() {
  const main = document.getElementById('appMain');

  if (state.raw.items.length === 0) {
    main.innerHTML = `
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
    document.getElementById('emptyRefreshBtn')?.addEventListener('click', doRefresh);
    return;
  }

  const cardsHtml = CATEGORIES.map((cat) => {
    const meta      = CAT_META[cat];
    const items     = state.raw.items.filter((i) => i.category === cat && state.activeSupers.has(i.super));
    const brands    = [...OWN_BRANDS, ...COMP_BRANDS].filter((b) => items.some((i) => i.brand === b));
    const skuCount  = items.length;
    const chartH    = Math.max(200, brands.length * 44 + 40);

    return `
      <div class="home-card home-card-${meta.cls}" data-cat="${cat}">
        <div class="home-card-head">
          <span class="home-card-emoji">${meta.emoji}</span>
          <div>
            <div class="home-card-title">${cat}</div>
            <div class="home-card-meta">${brands.length} marcas · ${skuCount} SKUs</div>
          </div>
        </div>
        <div class="home-chart-wrap" style="height:${chartH}px">
          <canvas id="home-chart-${meta.cls}"></canvas>
        </div>
        <button class="home-card-cta" data-cat="${cat}">Ver detalle →</button>
      </div>`;
  }).join('');

  main.innerHTML = `
    <div class="home-grid">${cardsHtml}</div>
    <div class="csv-bar">
      <button class="btn-csv" id="btnExportCSV">⬇ Descargar CSV completo</button>
      <span class="csv-meta">${state.raw.items.length} productos · ${state.raw.generatedAt ? formatDate(state.raw.generatedAt) : '—'}</span>
    </div>`;

  document.getElementById('btnExportCSV')?.addEventListener('click', exportCSV);

  main.querySelectorAll('.home-card-cta').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setView('category', btn.dataset.cat);
    });
  });
  main.querySelectorAll('.home-card').forEach((card) => {
    card.addEventListener('click', () => setView('category', card.dataset.cat));
  });

  requestAnimationFrame(() => initHomeCharts());
}

function initHomeCharts() {
  for (const cat of CATEGORIES) {
    const meta   = CAT_META[cat];
    const items  = state.raw.items.filter((i) => i.category === cat && state.activeSupers.has(i.super));
    const entries = [...OWN_BRANDS, ...COMP_BRANDS]
      .map((brand) => {
        const stats = brandStatsFor(brand, items);
        if (!stats.total || stats.avgPrice == null) return null;
        return { brand, avgPrice: stats.avgPrice };
      })
      .filter(Boolean)
      .sort((a, b) => a.avgPrice - b.avgPrice);

    if (!entries.length) continue;

    const canvasId = `home-chart-${meta.cls}`;
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) continue;

    destroyChart(canvasId);

    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: entries.map((e) => e.brand),
        datasets: [{
          data:            entries.map((e) => Math.round(e.avgPrice)),
          backgroundColor: entries.map((e) => brandColor(e.brand)),
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
}

// ── Category detail view ───────────────────────────────────────────────────

function renderCategory(cat) {
  const main = document.getElementById('appMain');
  const meta = CAT_META[cat];

  const catItems = state.raw.items.filter(
    (i) => i.category === cat && state.activeSupers.has(i.super) && state.activeBrands.has(i.brand)
  );

  const brands   = [...new Set(catItems.map((i) => i.brand))];
  const skuCount = catItems.length;

  const superChipsHtml = SUPERS.map((s) => {
    const active  = state.activeSupers.has(s) ? 'active' : '';
    const clsKey  = { 'Disco': 'disco', 'TaTa': 'tata', 'Tienda Inglesa': 'ti', 'El Dorado': 'ed' }[s];
    return `<button class="chip chip-${clsKey} ${active}" data-super="${s}">${s}</button>`;
  }).join('');

  const TABS = [
    { id: 'precios',   label: 'Precios' },
    { id: 'ofertas',   label: 'Ofertas' },
    { id: 'cobertura', label: 'Cobertura' },
  ];

  const tabsHtml   = TABS.map((t, i) =>
    `<button class="detail-tab${i === 0 ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`
  ).join('');

  const panelsHtml = TABS.map((t, i) =>
    `<div class="detail-tab-panel${i === 0 ? ' active' : ''}" id="tab-panel-${t.id}"></div>`
  ).join('');

  main.innerHTML = `
    <div class="detail-back">
      <button class="btn-back" id="btnBack">← Volver</button>
    </div>
    <div class="detail-header detail-header-${meta.cls}">
      <span class="detail-header-emoji">${meta.emoji}</span>
      <div class="detail-header-info">
        <div class="detail-header-title">${cat}</div>
        <div class="detail-header-sub">${brands.length} marcas · ${skuCount} SKUs</div>
      </div>
    </div>
    <div class="detail-filter-row">
      <span class="filter-label">Supermercados:</span>
      <div class="chip-row" id="detailChipSupers">${superChipsHtml}</div>
    </div>
    <div class="detail-tabs-bar">${tabsHtml}</div>
    <div class="detail-tabs-content">${panelsHtml}</div>`;

  document.getElementById('btnBack').addEventListener('click', () => setView('home'));

  document.querySelectorAll('#detailChipSupers .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const s = chip.dataset.super;
      if (state.activeSupers.has(s)) {
        state.activeSupers.delete(s);
        chip.classList.remove('active');
        document.querySelector(`#chipSupers .chip[data-super="${s}"]`)?.classList.remove('active');
      } else {
        state.activeSupers.add(s);
        chip.classList.add('active');
        document.querySelector(`#chipSupers .chip[data-super="${s}"]`)?.classList.add('active');
      }
      destroyAllCharts();
      renderCategory(cat);
    });
  });

  document.querySelectorAll('.detail-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.detail-tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.detail-tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      document.getElementById(`tab-panel-${tabId}`)?.classList.add('active');
      renderTabContent(tabId, cat, catItems);
    });
  });

  renderTabContent('precios', cat, catItems);
}

function renderTabContent(tabId, cat, catItems) {
  const panel = document.getElementById(`tab-panel-${tabId}`);
  if (!panel) return;

  const canvasId = `chart-cat-${CAT_META[cat].cls}`;
  destroyChart(canvasId);

  switch (tabId) {
    case 'precios':
      panel.innerHTML = buildTabPrecios(cat, catItems, canvasId);
      requestAnimationFrame(() => buildCatChart(canvasId, catItems));
      panel.querySelectorAll('.brand-row-clickable').forEach((row) => {
        row.addEventListener('click', () => setView('brand', row.dataset.cat, row.dataset.brand));
      });
      break;
    case 'ofertas':
      panel.innerHTML = buildTabOfertas(catItems);
      panel.querySelector('.pdf-bar button')?.addEventListener('click', exportPDF);
      break;
    case 'cobertura':
      panel.innerHTML = buildTabCobertura(catItems);
      panel.querySelector('.pdf-bar button')?.addEventListener('click', exportPDF);
      break;
  }
}

// ── Tab: Precios ───────────────────────────────────────────────────────────

function buildTabPrecios(cat, catItems, canvasId) {
  const entries = [...OWN_BRANDS, ...COMP_BRANDS]
    .map((brand) => {
      const stats = brandStatsFor(brand, catItems);
      if (!stats.total) return null;
      return { brand, isOwn: OWN_BRANDS.includes(brand), ...stats };
    })
    .filter(Boolean)
    .sort((a, b) => (a.avgPrice ?? Infinity) - (b.avgPrice ?? Infinity));

  if (!entries.length) return '<div class="tab-empty">Sin datos para los filtros seleccionados.</div>';

  const chartH = Math.max(220, entries.length * 46);

  const rows = entries.map((e) => {
    const dot = e.isOwn ? '<span class="own-dot">●</span>' : '';
    const offerCell = e.offerCount > 0
      ? `<span class="offer-badge">-${Math.round(e.avgDiscount ?? 0)}% · ${e.offerCount} SKU</span>`
      : '<span class="muted">—</span>';
    return `
      <tr class="brand-row-clickable" data-brand="${e.brand}" data-cat="${cat}" title="Ver análisis de ${e.brand}">
        <td><span class="brand-name-cell">${dot}<span class="brand-pill ${e.isOwn ? 'own' : 'comp'}">${e.brand}</span> <span class="click-hint">Ver →</span></span></td>
        <td class="price-cell">${fmt(e.avgPrice)}</td>
        <td class="price-cell">${fmt(e.minPrice)}</td>
        <td class="price-cell">${fmt(e.maxPrice)}</td>
        <td class="num-cell">${e.total}</td>
        <td>${offerCell}</td>
      </tr>`;
  }).join('');

  return `
    <div class="tab-section">
      <div class="chart-card">
        <div class="chart-card-title">Precio promedio por marca — menor a mayor</div>
        <div class="chart-wrap" style="height:${chartH}px">
          <canvas id="${canvasId}"></canvas>
        </div>
      </div>
    </div>
    <div class="tab-section">
      <div class="table-card">
        <div class="table-card-hint">Hacé clic en una marca para ver su análisis completo</div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Marca</th>
                <th>Precio prom.</th>
                <th>Precio mín.</th>
                <th>Precio máx.</th>
                <th>SKUs</th>
                <th>En oferta</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="pdf-bar"><button class="btn-pdf" onclick="window.print()">📥 Exportar PDF</button></div>`;
}

function buildCatChart(canvasId, catItems) {
  const entries = [...OWN_BRANDS, ...COMP_BRANDS]
    .map((brand) => {
      const stats = brandStatsFor(brand, catItems);
      if (!stats.total || stats.avgPrice == null) return null;
      return { brand, avgPrice: stats.avgPrice };
    })
    .filter(Boolean)
    .sort((a, b) => a.avgPrice - b.avgPrice);

  if (!entries.length) return;
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: entries.map((e) => e.brand),
      datasets: [{
        data:            entries.map((e) => Math.round(e.avgPrice)),
        backgroundColor: entries.map((e) => brandColor(e.brand)),
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
          ticks: { callback: (v) => '$' + v, font: { size: 11 } },
          grid: { color: '#f0f0f0' },
          border: { display: false },
        },
        y: {
          ticks: { font: { size: 12 }, color: '#334155' },
          grid: { display: false },
          border: { display: false },
        },
      },
    },
  });
}

// ── Tab: Ofertas ───────────────────────────────────────────────────────────

function buildTabOfertas(catItems) {
  const offers = catItems.filter((i) => i.listPrice && i.listPrice > i.price);

  if (!offers.length) {
    return '<div class="tab-empty">No hay ofertas activas para los filtros seleccionados.</div>';
  }

  const sorted    = [...offers].sort((a, b) => (1 - b.price / b.listPrice) - (1 - a.price / a.listPrice));
  const totalDisc = avg(sorted.map((i) => (1 - i.price / i.listPrice) * 100));

  const summaryHtml = `
    <div class="offers-summary">
      <span><strong>${offers.length}</strong> productos en oferta</span>
      <span class="offer-badge offer-badge-lg">Descuento promedio ${totalDisc?.toFixed(1) ?? '—'}%</span>
    </div>`;

  const byBrand = groupBy(sorted, 'brand');
  const brandsHtml = [...byBrand.entries()].map(([brand, items]) => {
    const isOwn = OWN_BRANDS.includes(brand);
    const rows = items.map((p) => {
      const disc = Math.round((1 - p.price / p.listPrice) * 100);
      return `
        <div class="offer-row">
          <span class="offer-super-tag">${p.super}</span>
          <span class="offer-name">${p.name}</span>
          <span class="offer-prices">
            <s class="offer-list-price">${fmt(p.listPrice)}</s>
            <strong class="offer-sale-price">${fmt(p.price)}</strong>
          </span>
          <span class="offer-badge">-${disc}%</span>
        </div>`;
    }).join('');

    return `
      <div class="offer-brand-block">
        <div class="offer-brand-head">
          <span class="brand-pill ${isOwn ? 'own' : 'comp'}">${brand}</span>
          <span class="muted">${items.length} producto${items.length > 1 ? 's' : ''} en oferta</span>
        </div>
        <div class="offer-rows">${rows}</div>
      </div>`;
  }).join('');

  return `
    <div class="tab-section">
      ${summaryHtml}
      ${brandsHtml}
    </div>
    <div class="pdf-bar"><button class="btn-pdf" onclick="window.print()">📥 Exportar PDF</button></div>`;
}

// ── Tab: Cobertura ─────────────────────────────────────────────────────────

function buildTabCobertura(catItems) {
  const activeSupers = SUPERS.filter((s) => state.activeSupers.has(s));
  if (!activeSupers.length) return '<div class="tab-empty">Seleccioná al menos un supermercado.</div>';

  const allBrands = [...OWN_BRANDS, ...COMP_BRANDS].filter((b) => catItems.some((i) => i.brand === b));
  if (!allBrands.length) return '<div class="tab-empty">Sin datos para los filtros seleccionados.</div>';

  const blocksHtml = activeSupers.map((s) => {
    const superItems = catItems.filter((i) => i.super === s);
    const totalSkus  = superItems.length;
    const ownSkus    = superItems.filter((i) => i.isOwn).length;
    const compSkus   = totalSkus - ownSkus;
    const color      = SUPER_COLORS[s];

    const brandsHtml = allBrands
      .map((brand) => {
        const brandItems = superItems.filter((i) => i.brand === brand);
        if (!brandItems.length) return '';
        const isOwn = OWN_BRANDS.includes(brand);
        return `<span class="brand-pill ${isOwn ? 'own' : 'comp'}">${brand} <span class="pill-count">${brandItems.length}</span></span>`;
      })
      .filter(Boolean)
      .join('');

    return `
      <div class="coverage-block" style="--super-color:${color}">
        <div class="coverage-block-head">
          <span class="coverage-super-name" style="color:${color}">${s}</span>
          <span class="coverage-meta">
            <span class="coverage-stat">${totalSkus} SKUs</span>
            <span class="brand-pill own">Propias ${ownSkus}</span>
            <span class="brand-pill comp">Comp. ${compSkus}</span>
          </span>
        </div>
        <div class="coverage-brands">
          ${brandsHtml || '<span class="muted">Sin productos</span>'}
        </div>
      </div>`;
  }).join('');

  return `<div class="tab-section">${blocksHtml}</div>
    <div class="pdf-bar"><button class="btn-pdf" onclick="window.print()">📥 Exportar PDF</button></div>`;
}

// ── Brand detail view ──────────────────────────────────────────────────────

function renderBrand(cat, brand) {
  const main    = document.getElementById('appMain');
  const meta    = CAT_META[cat];
  const isOwn   = OWN_BRANDS.includes(brand);
  const color   = brandColor(brand);

  const allCatItems = state.raw.items.filter(
    (i) => i.category === cat && state.activeSupers.has(i.super)
  );
  const brandItems = allCatItems.filter((i) => i.brand === brand);
  const stats  = brandStatsFor(brand, allCatItems);

  // All brands for comparison chart
  const allBrandsInCat = [...OWN_BRANDS, ...COMP_BRANDS].filter((b) =>
    allCatItems.some((i) => i.brand === b)
  );

  // GAP vs competitors
  const compBrandsPresent = (isOwn ? COMP_BRANDS : OWN_BRANDS).filter((b) =>
    allCatItems.some((i) => i.brand === b)
  );

  const gapRows = compBrandsPresent.map((other) => {
    const otherStats = brandStatsFor(other, allCatItems);
    const gap = gapPct(stats.avgPrice, otherStats.avgPrice);
    if (gap === null) return '';
    const sign   = gap > 0 ? '+' : '';
    const cls    = gap <= 0 ? 'positive' : 'negative';
    const diffAbs = Math.abs(Math.round((stats.avgPrice ?? 0) - (otherStats.avgPrice ?? 0)));
    const label   = gap <= 0
      ? `$${diffAbs} más barato que ${other}`
      : `$${diffAbs} más caro que ${other}`;
    return `
      <tr>
        <td><span class="brand-pill ${OWN_BRANDS.includes(other) ? 'own' : 'comp'}">${other}</span></td>
        <td class="price-cell">${fmt(otherStats.avgPrice)}</td>
        <td class="price-cell">${fmt(stats.avgPrice)}</td>
        <td><span class="gap-pill ${cls}">${sign}${gap.toFixed(1)}%</span></td>
        <td class="muted" style="font-size:.8rem">${label}</td>
      </tr>`;
  }).join('');

  // Products by super
  const activeSupers = SUPERS.filter((s) => state.activeSupers.has(s));
  const bySuper = activeSupers.map((s) => {
    const superProds = brandItems.filter((i) => i.super === s);
    if (!superProds.length) return '';
    const rows = superProds.map((p) => {
      const hasOffer = p.listPrice && p.listPrice > p.price;
      const disc     = hasOffer ? Math.round((1 - p.price / p.listPrice) * 100) : null;
      return `
        <div class="brand-prod-row">
          <span class="brand-prod-name">${p.name}</span>
          <span class="brand-prod-prices">
            ${hasOffer ? `<s class="offer-list-price">${fmt(p.listPrice)}</s>` : ''}
            <strong>${fmt(p.price)}</strong>
            ${hasOffer ? `<span class="offer-badge">-${disc}%</span>` : ''}
          </span>
        </div>`;
    }).join('');
    return `
      <div class="brand-super-block" style="--super-color:${SUPER_COLORS[s]}">
        <div class="brand-super-name" style="color:${SUPER_COLORS[s]}">${s} · ${superProds.length} SKU${superProds.length > 1 ? 's' : ''}</div>
        ${rows}
      </div>`;
  }).join('');

  const heroClass = isOwn ? 'brand-hero own' : 'brand-hero comp';
  const heroBadge = isOwn
    ? `<span class="brand-hero-badge own-badge">⭐ NUESTRA MARCA</span>`
    : `<span class="brand-hero-badge comp-badge">COMPETENCIA</span>`;

  const canvasId = `chart-brand-${brand.replace(/\s+/g, '-').toLowerCase()}`;

  const offerSection = stats.offerItems.length ? `
    <div class="brand-section-card">
      <div class="brand-section-title">🏷 Ofertas activas (${stats.offerItems.length})</div>
      ${stats.offerItems.map((p) => {
        const disc = Math.round((1 - p.price / p.listPrice) * 100);
        return `
          <div class="brand-prod-row">
            <span class="offer-super-tag">${p.super}</span>
            <span class="brand-prod-name">${p.name}</span>
            <span class="brand-prod-prices">
              <s class="offer-list-price">${fmt(p.listPrice)}</s>
              <strong class="offer-sale-price">${fmt(p.price)}</strong>
              <span class="offer-badge">-${disc}%</span>
            </span>
          </div>`;
      }).join('')}
    </div>` : '';

  const gapSection = gapRows ? `
    <div class="brand-section-card">
      <div class="brand-section-title">📐 Posicionamiento vs ${isOwn ? 'competidores' : 'nuestras marcas'}</div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Marca</th>
            <th>Su precio prom.</th>
            <th>Precio prom. ${brand}</th>
            <th>GAP %</th>
            <th>Diferencia</th>
          </tr></thead>
          <tbody>${gapRows}</tbody>
        </table>
      </div>
    </div>` : '';

  main.innerHTML = `
    <div class="detail-back">
      <button class="btn-back" id="btnBack">← ${cat}</button>
    </div>
    <div class="${heroClass}" style="--brand-color:${color}">
      <div class="brand-hero-left">
        ${heroBadge}
        <div class="brand-hero-name">${brand}</div>
        <div class="brand-hero-meta">${cat} · ${stats.total} SKUs · ${activeSupers.filter((s) => brandItems.some((i) => i.super === s)).length} supermercados</div>
      </div>
      <div class="brand-hero-kpis">
        <div class="brand-kpi"><div class="brand-kpi-val">${fmt(stats.avgPrice)}</div><div class="brand-kpi-label">Precio prom.</div></div>
        <div class="brand-kpi"><div class="brand-kpi-val">${fmt(stats.minPrice)}</div><div class="brand-kpi-label">Precio mín.</div></div>
        <div class="brand-kpi"><div class="brand-kpi-val">${stats.offerCount || '—'}</div><div class="brand-kpi-label">En oferta</div></div>
      </div>
    </div>

    <div class="brand-section-card">
      <div class="brand-section-title">📊 Precio vs todas las marcas — ${cat}</div>
      <div class="chart-wrap" style="height:${Math.max(200, allBrandsInCat.length * 46)}px">
        <canvas id="${canvasId}"></canvas>
      </div>
    </div>

    <div class="brand-section-card">
      <div class="brand-section-title">🏪 Productos por supermercado</div>
      ${bySuper || '<div class="tab-empty">Sin productos en los supermercados seleccionados.</div>'}
    </div>

    ${offerSection}
    ${gapSection}

    <div class="pdf-bar"><button class="btn-pdf" onclick="window.print()">📥 Exportar PDF</button></div>
  `;

  document.getElementById('btnBack').addEventListener('click', () => setView('category', cat));

  requestAnimationFrame(() => {
    const entries = allBrandsInCat
      .map((b) => {
        const s = brandStatsFor(b, allCatItems);
        return s.avgPrice != null ? { brand: b, avgPrice: s.avgPrice } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.avgPrice - b.avgPrice);

    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !entries.length) return;

    const bgColors = entries.map((e) =>
      e.brand === brand ? brandColor(e.brand) : brandColor(e.brand) + '55'
    );
    const borderColors = entries.map((e) =>
      e.brand === brand ? brandColor(e.brand) : 'transparent'
    );

    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: entries.map((e) => e.brand),
        datasets: [{
          data: entries.map((e) => Math.round(e.avgPrice)),
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
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
            ticks: { callback: (v) => '$' + v, font: { size: 11 } },
            grid: { color: '#f0f0f0' },
            border: { display: false },
          },
          y: {
            ticks: {
              font: { size: 12, weight: (ctx) => ctx.tick.label === brand ? 'bold' : 'normal' },
              color: (ctx) => ctx.tick.label === brand ? brandColor(brand) : '#334155',
            },
            grid: { display: false },
            border: { display: false },
          },
        },
      },
    });
  });
}

// ── Main render ────────────────────────────────────────────────────────────

function render() {
  if (state.view === 'home') {
    renderHome();
  } else if (state.view === 'brand' && state.currentCat && state.currentBrand) {
    renderBrand(state.currentCat, state.currentBrand);
  } else if (state.view === 'category' && state.currentCat) {
    renderCategory(state.currentCat);
  }
}

// ── Filter wiring ──────────────────────────────────────────────────────────

function initFilters() {
  document.querySelectorAll('.cat-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.view === 'home') render();
    });
  });

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

  document.querySelectorAll('#chipMarcas .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const m = chip.dataset.marca;
      if (state.activeBrands.has(m)) {
        state.activeBrands.delete(m);
        chip.classList.remove('active');
      } else {
        state.activeBrands.add(m);
        chip.classList.add('active');
      }
      destroyAllCharts();
      render();
    });
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
    updateCategoryBadges();
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
    updateCategoryBadges();
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
  document.getElementById('btnRefresh').addEventListener('click', doRefresh);
  document.getElementById('headerHome')?.addEventListener('click', () => setView('home'));
  await loadData();
});
