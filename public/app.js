/**
 * Góndola Competencia — Frontend Application
 * Two-view SPA: home (category cards) → category detail.
 * Pure vanilla JS, ES modules. Chart.js loaded from CDN.
 */

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

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

const BADGE_IDS = {
  'Pan de Molde':   'badgeMolde',
  'Pan de Viena':   'badgeViena',
  'Pan de Tortuga': 'badgeTortuga',
};

const OWN_BRANDS  = ['Bimbo', 'Los Sorchantes'];
const COMP_BRANDS = ['Magno', 'Bauducco', 'Visconti', 'Marbella', 'Precio Líder'];

// ═══════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════

const state = {
  raw: { generatedAt: null, items: [] },
  view: 'home',        // 'home' | 'category'
  currentCat: null,    // 'Pan de Molde' | 'Pan de Viena' | 'Pan de Tortuga'
  activeSupers: new Set(['Disco', 'TaTa', 'Tienda Inglesa', 'El Dorado']),
  activeCats: new Set(['Pan de Molde', 'Pan de Viena', 'Pan de Tortuga']),
  activeBrands: new Set(['Bimbo', 'Los Sorchantes', 'Magno', 'Bauducco', 'Visconti', 'Marbella', 'Precio Líder']),
};

// Chart.js instances registry
const charts = {};

// ═══════════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════════

const fmt = (n) => (n != null && !isNaN(n)) ? `$${Number(n).toFixed(0)}` : '—';
const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
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

function filteredItems(catOverride) {
  return state.raw.items.filter((i) => {
    const cat = catOverride || null;
    if (cat && i.category !== cat) return false;
    if (!cat && !state.activeCats.has(i.category)) return false;
    if (!state.activeSupers.has(i.super)) return false;
    if (!state.activeBrands.has(i.brand)) return false;
    return true;
  });
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function destroyAllCharts() {
  Object.keys(charts).forEach(destroyChart);
}

function gapPill(gap, suffix = '') {
  if (gap === null) return '<span class="gap-pill neutral">—</span>';
  const sign = gap > 0 ? '+' : '';
  const cls  = gap <= 0 ? 'positive' : 'negative';
  return `<span class="gap-pill ${cls}">${sign}${gap.toFixed(1)}%${suffix ? ' ' + suffix : ''}</span>`;
}

// ═══════════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════
// BADGES + HEADER
// ═══════════════════════════════════════════════════════════════════════

function updateCategoryBadges() {
  for (const cat of CATEGORIES) {
    const el = document.getElementById(BADGE_IDS[cat]);
    if (!el) continue;
    const count = state.raw.items.filter((i) => i.category === cat).length;
    el.textContent = count > 0 ? `${count} productos` : '—';
  }
}

function updateLastUpdate() {
  const el = document.getElementById('lastUpdate');
  if (el) el.textContent = state.raw.generatedAt
    ? `Actualizado: ${formatDate(state.raw.generatedAt)}`
    : 'Sin datos';
}

// ═══════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════

function setView(view, cat) {
  destroyAllCharts();
  state.view = view;
  state.currentCat = cat || null;
  render();
}

// ═══════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════

function buildEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-state-emoji">📦</div>
      <h3>Sin datos cargados</h3>
      <p>Todavía no se han obtenido precios de los supermercados. Hacé clic en "Actualizar" para iniciar el relevamiento.</p>
      <button class="btn-refresh" id="emptyRefreshBtn">
        <svg class="refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Actualizar Precios
      </button>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════
// HOME VIEW
// ═══════════════════════════════════════════════════════════════════════

function buildHomeCard(cat) {
  const meta     = CAT_META[cat];
  const allItems = state.raw.items.filter((i) => i.category === cat);
  const items    = allItems.filter((i) => state.activeSupers.has(i.super));

  const ownItems  = items.filter((i) => i.isOwn);
  const compItems = items.filter((i) => !i.isOwn);

  const ownPrices  = ownItems.map((i) => i.price).filter((p) => p != null);
  const compPrices = compItems.map((i) => i.price).filter((p) => p != null);

  const avgOwn  = avg(ownPrices);
  const avgComp = avg(compPrices);
  const gap     = gapPct(avgOwn, avgComp);

  let gapHtml = '<span class="gap-pill neutral">Sin datos</span>';
  if (gap !== null) {
    const sign = gap > 0 ? '+' : '';
    const cls  = gap <= 0 ? 'positive' : 'negative';
    gapHtml = `<span class="gap-pill ${cls}">${sign}${gap.toFixed(1)}% nuestras vs comp.</span>`;
  }

  // Mini bar: relative position (own vs comp)
  let barHtml = '';
  if (avgOwn != null && avgComp != null) {
    const minP = Math.min(avgOwn, avgComp) * 0.95;
    const maxP = Math.max(avgOwn, avgComp) * 1.05;
    const range = maxP - minP;
    const ownPct  = range > 0 ? ((avgOwn  - minP) / range * 100).toFixed(1) : 50;
    const compPct = range > 0 ? ((avgComp - minP) / range * 100).toFixed(1) : 50;
    barHtml = `
      <div class="home-card-bar-wrap">
        <div class="home-card-bar-label">
          <span style="color:#1976d2">Nuestras ${fmt(avgOwn)}</span>
          <span style="color:#9e9e9e">Comp. ${fmt(avgComp)}</span>
        </div>
        <div class="home-card-bar-track">
          <div class="home-card-bar-marker rgm" style="left:${ownPct}%" title="Nuestras marcas promedio"></div>
          <div class="home-card-bar-marker comp" style="left:${compPct}%" title="Competencia promedio"></div>
        </div>
      </div>`;
  }

  return `
    <div class="home-card home-card-${meta.cls}" data-cat="${cat}">
      <div class="home-card-header">
        <span class="home-card-emoji">${meta.emoji}</span>
        <div>
          <div class="home-card-title">${cat}</div>
          <div class="home-card-subtitle">${meta.label}</div>
        </div>
      </div>
      <div class="home-card-stats">
        <div class="home-card-stat">
          <span class="home-card-stat-label">Nuestras</span>
          <span class="home-card-stat-value own">${ownItems.length} prods.</span>
        </div>
        <div class="home-card-stat">
          <span class="home-card-stat-label">Competencia</span>
          <span class="home-card-stat-value comp">${compItems.length} prods.</span>
        </div>
        <div class="home-card-stat">
          <span class="home-card-stat-label">Prom. nuestras</span>
          <span class="home-card-stat-value">${fmt(avgOwn)}</span>
        </div>
        <div class="home-card-stat">
          <span class="home-card-stat-label">Prom. comp.</span>
          <span class="home-card-stat-value">${fmt(avgComp)}</span>
        </div>
      </div>
      <div class="home-card-gap">${gapHtml}</div>
      ${barHtml}
      <button class="home-card-cta" data-cat="${cat}">Ver análisis →</button>
    </div>`;
}

function buildGapSummaryTable() {
  const rows = CATEGORIES.map((cat) => {
    const items     = state.raw.items.filter((i) => i.category === cat && state.activeSupers.has(i.super));
    const ownItems  = items.filter((i) => i.isOwn);
    const compItems = items.filter((i) => !i.isOwn);

    const ownPrices  = ownItems.map((i) => i.price).filter((p) => p != null);
    const compPrices = compItems.map((i) => i.price).filter((p) => p != null);

    const bestOwn  = ownPrices.length  ? Math.min(...ownPrices)  : null;
    const bestComp = compPrices.length ? Math.min(...compPrices) : null;

    // Cheapest competitor brand
    const byBrand = groupBy(compItems, 'brand');
    let cheapBrand = '—';
    let cheapPrice = null;
    for (const [brand, bitems] of byBrand) {
      const prices = bitems.map((i) => i.price).filter((p) => p != null);
      const m = avg(prices);
      if (m != null && (cheapPrice === null || m < cheapPrice)) {
        cheapPrice = m;
        cheapBrand = brand;
      }
    }

    const gap = gapPct(bestOwn, bestComp);
    const meta = CAT_META[cat];

    return `
      <tr>
        <td><span style="margin-right:6px">${meta.emoji}</span><strong>${cat}</strong></td>
        <td>${cheapBrand !== '—' ? `<span class="brand-pill comp">${cheapBrand}</span>` : '—'}</td>
        <td class="price-cell">${fmt(bestOwn)}</td>
        <td class="price-cell">${fmt(cheapPrice)}</td>
        <td>${gapPill(gap)}</td>
      </tr>`;
  }).join('');

  return `
    <div class="gap-summary-card">
      <div class="gap-summary-header">📈 Resumen de gaps por categoría</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Comp. más barata</th>
              <th>Nuestro mejor precio (Bimbo/Los Sorchantes)</th>
              <th>Precio comp. min.</th>
              <th>GAP %</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function renderHome() {
  const main = document.getElementById('appMain');

  if (state.raw.items.length === 0) {
    main.innerHTML = buildEmptyState();
    document.getElementById('emptyRefreshBtn')?.addEventListener('click', doRefresh);
    return;
  }

  const cardsHtml = CATEGORIES.map(buildHomeCard).join('');
  const gapHtml   = buildGapSummaryTable();

  main.innerHTML = `
    <div class="home-grid">${cardsHtml}</div>
    ${gapHtml}`;

  // Wire CTA buttons — only on the button to avoid double-fire
  main.querySelectorAll('.home-card-cta').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setView('category', btn.dataset.cat);
    });
  });
  // Also wire the card itself (excluding the button, which already stops propagation)
  main.querySelectorAll('.home-card').forEach((card) => {
    card.addEventListener('click', () => setView('category', card.dataset.cat));
  });
}

// ═══════════════════════════════════════════════════════════════════════
// CATEGORY DETAIL VIEW
// ═══════════════════════════════════════════════════════════════════════

// ── helpers ────────────────────────────────────────────────────────────

function brandStatsFor(brand, items) {
  const brandItems = items.filter((i) => i.brand === brand);
  const prices     = brandItems.map((i) => i.price).filter((p) => p != null);
  const offers     = brandItems.filter((i) => i.listPrice && i.listPrice > i.price);
  const discounts  = offers.map((i) => (1 - i.price / i.listPrice) * 100);
  return {
    total:    brandItems.length,
    avgPrice: avg(prices),
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    offerCount:  offers.length,
    offerRate:   brandItems.length ? Math.round(offers.length / brandItems.length * 100) : 0,
    avgDiscount: avg(discounts),
    cheapestSku: [...brandItems].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0] ?? null,
  };
}

// ── A. Posicionamiento de precios (chart + tabla) ─────────────────────

function buildChartPricePositioning(canvasId, catItems) {
  const allBrands = [...OWN_BRANDS, ...COMP_BRANDS];
  const entries = allBrands
    .map((brand) => {
      const stats = brandStatsFor(brand, catItems);
      if (!stats.total || stats.avgPrice == null) return null;
      const isOwn = OWN_BRANDS.includes(brand);
      return { brand, isOwn, ...stats };
    })
    .filter(Boolean)
    .sort((a, b) => a.avgPrice - b.avgPrice);

  if (!entries.length) return;

  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  const labels = entries.map((e) => e.brand);
  const avgData = entries.map((e) => Math.round(e.avgPrice));
  const minData = entries.map((e) => Math.round(e.minPrice ?? e.avgPrice));
  const maxData = entries.map((e) => Math.round(e.maxPrice ?? e.avgPrice));

  // Floating bars for range (min→max), then avg as overlay
  const rangeData = entries.map((e) => [Math.round(e.minPrice ?? e.avgPrice), Math.round(e.maxPrice ?? e.avgPrice)]);
  const rangeColors = entries.map((e) => {
    const base = e.isOwn ? '#1976d2' : (COMP_COLORS[e.brand] || '#9e9e9e');
    return base + '40'; // transparent fill for range
  });
  const avgColors = entries.map((e) => e.isOwn ? '#1976d2' : (COMP_COLORS[e.brand] || '#9e9e9e'));

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Rango de precios (min–max)',
          data: rangeData,
          backgroundColor: rangeColors,
          borderColor: avgColors.map((c) => c + '80'),
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Precio promedio',
          data: avgData,
          backgroundColor: avgColors,
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.35,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 14 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.datasetIndex === 0) {
                const [mn, mx] = ctx.raw;
                return ` Rango: $${mn} – $${mx}`;
              }
              return ` Promedio: $${ctx.parsed.x}`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: false,
          ticks: { callback: (v) => '$' + v, font: { size: 11 } },
          grid: { color: '#f0f0f0' },
        },
        y: { ticks: { font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
}

function buildSectionPriceChart(cat, catItems, canvasId) {
  const allBrands = [...OWN_BRANDS, ...COMP_BRANDS];
  const rows = allBrands.map((brand) => {
    const stats = brandStatsFor(brand, catItems);
    if (!stats.total) return null;
    const isOwn = OWN_BRANDS.includes(brand);
    const cls   = isOwn ? 'own' : 'comp';
    const rankLabel = stats.avgPrice != null
      ? `<span class="price-bold">${fmt(stats.avgPrice)}</span> <small style="color:var(--text-muted)">(${fmt(stats.minPrice)}–${fmt(stats.maxPrice)})</small>`
      : '—';
    return `
      <tr>
        <td><span class="brand-pill ${cls}">${brand}</span></td>
        <td>${stats.total} SKU${stats.total > 1 ? 's' : ''}</td>
        <td>${rankLabel}</td>
        <td class="price-cell">${fmt(stats.minPrice)}</td>
        <td class="price-cell">${fmt(stats.maxPrice)}</td>
        <td>${stats.offerCount > 0 ? `<span class="offer-badge">${stats.offerCount} oferta${stats.offerCount > 1 ? 's' : ''}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
      </tr>`;
  }).filter(Boolean).join('');

  if (!rows) return '';

  return `
    <div class="detail-section">
      <div class="detail-section-title">
        <span class="detail-section-icon">📊</span>
        Posicionamiento de Precios — ${cat}
      </div>
      <div class="chart-card">
        <div class="chart-card-title">Precio por marca (barra = promedio · franja = rango min/max)</div>
        <div class="chart-wrap" style="height:${Math.max(220, ([...OWN_BRANDS, ...COMP_BRANDS].filter((b) => brandStatsFor(b, catItems).total > 0).length) * 46)}px">
          <canvas id="${canvasId}"></canvas>
        </div>
      </div>
      <div class="table-card" style="margin-top:12px">
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Marca</th><th>SKUs</th><th>Precio promedio (rango)</th><th>Mínimo</th><th>Máximo</th><th>Ofertas</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// ── B. Matriz SKUs por supermercado × marca ───────────────────────────

function buildSectionSkuMatrix(catItems) {
  const activeSupers = SUPERS.filter((s) => state.activeSupers.has(s));
  const allBrands    = [...OWN_BRANDS, ...COMP_BRANDS].filter((b) =>
    catItems.some((i) => i.brand === b)
  );
  if (!allBrands.length) return '';

  const headerCols = allBrands.map((b) => {
    const isOwn = OWN_BRANDS.includes(b);
    return `<th><span class="brand-pill ${isOwn ? 'own' : 'comp'}" style="font-size:.7rem">${b}</span></th>`;
  }).join('');

  const rowsHtml = activeSupers.map((s) => {
    const superItems = catItems.filter((i) => i.super === s);
    const cells = allBrands.map((brand) => {
      const brandProds = superItems.filter((i) => i.brand === brand);
      if (!brandProds.length) return `<td class="price-dash">—</td>`;
      const names = brandProds.map((p) => {
        const hasOffer = p.listPrice && p.listPrice > p.price;
        return `<li>${p.name} <strong>${fmt(p.price)}</strong>${hasOffer ? ` <span class="offer-badge">-${Math.round((1 - p.price / p.listPrice) * 100)}%</span>` : ''}</li>`;
      }).join('');
      return `<td>
        <details>
          <summary style="cursor:pointer;font-weight:600;color:var(--blue)">${brandProds.length} SKU${brandProds.length > 1 ? 's' : ''}</summary>
          <ul class="sku-list">${names}</ul>
        </details>
      </td>`;
    }).join('');
    return `<tr><td style="font-weight:600;white-space:nowrap">${s}</td>${cells}</tr>`;
  }).join('');

  return `
    <div class="detail-section">
      <div class="detail-section-title">
        <span class="detail-section-icon">🏪</span>
        Cobertura de SKUs por Supermercado y Marca
      </div>
      <div class="table-card">
        <div class="table-card-header">Expandí cada celda para ver los productos y precios</div>
        <div class="table-wrap">
          <table class="sku-matrix">
            <thead><tr><th>Super</th>${headerCols}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// ── C. Análisis de ofertas por marca ─────────────────────────────────

function buildSectionOfferAnalysis(catItems) {
  const allBrands = [...OWN_BRANDS, ...COMP_BRANDS].filter((b) =>
    catItems.some((i) => i.brand === b)
  );

  const rows = allBrands.map((brand) => {
    const stats = brandStatsFor(brand, catItems);
    if (!stats.total) return null;
    const isOwn = OWN_BRANDS.includes(brand);
    const cls   = isOwn ? 'own' : 'comp';
    const rateBar = `<div class="offer-rate-bar"><div class="offer-rate-fill" style="width:${stats.offerRate}%;background:${isOwn ? '#1976d2' : '#e65100'}"></div></div>`;
    return `
      <tr>
        <td><span class="brand-pill ${cls}">${brand}</span></td>
        <td style="text-align:center">${stats.total}</td>
        <td style="text-align:center">${stats.offerCount || '—'}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            ${rateBar}
            <span style="font-size:.8rem;font-weight:600">${stats.offerRate}%</span>
          </div>
        </td>
        <td style="text-align:center">${stats.avgDiscount != null ? `${stats.avgDiscount.toFixed(1)}%` : '—'}</td>
        <td class="price-cell">${fmt(stats.minPrice)}</td>
        <td class="product-name-cell" style="font-size:.78rem;color:var(--text-muted)">${stats.cheapestSku?.name ?? '—'}</td>
      </tr>`;
  }).filter(Boolean).join('');

  if (!rows) return '';

  return `
    <div class="detail-section">
      <div class="detail-section-title">
        <span class="detail-section-icon">🏷</span>
        Análisis de Ofertas por Marca
      </div>
      <div class="table-card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Marca</th>
                <th>Total SKUs</th>
                <th>En oferta</th>
                <th>% en oferta</th>
                <th>Desc. promedio</th>
                <th>Precio mín.</th>
                <th>SKU más barato</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// ── D. GAP table (our brands vs each competitor) ──────────────────────

function buildSectionGap(catItems) {
  const ownItems  = catItems.filter((i) => i.isOwn);
  const compItems = catItems.filter((i) => !i.isOwn);
  const ownBrands  = [...new Set(ownItems.map((i) => i.brand))].filter((b) => OWN_BRANDS.includes(b));
  const compBrands = [...new Set(compItems.map((i) => i.brand))].filter((b) => COMP_BRANDS.includes(b));
  if (!ownBrands.length || !compBrands.length) return '';

  const statsFor = (brand) => brandStatsFor(brand, catItems);

  const colHeaders = compBrands.map((b) => `<th style="font-size:.75rem">${b}</th>`).join('') + '<th>vs. + barato</th>';

  const rowsHtml = ownBrands.map((ownBrand) => {
    const os = statsFor(ownBrand);
    const compCells = compBrands.map((compBrand) => {
      const cs  = statsFor(compBrand);
      const gap = gapPct(os.avgPrice, cs.avgPrice);
      if (gap === null) return '<td><span class="gap-pill neutral">—</span></td>';
      const sign = gap > 0 ? '+' : '';
      const cls  = gap <= 0 ? 'positive' : 'negative';
      const diff = os.avgPrice != null && cs.avgPrice != null ? Math.abs(Math.round(os.avgPrice - cs.avgPrice)) : null;
      const note = diff != null ? `<br><small style="color:var(--text-muted);font-size:.67rem">${gap <= 0 ? `$${diff} + barato` : `$${diff} + caro`}</small>` : '';
      return `<td><span class="gap-pill ${cls}">${sign}${gap.toFixed(1)}%</span>${note}</td>`;
    }).join('');

    const compAvgs = compBrands.map((b) => statsFor(b).avgPrice).filter((p) => p != null);
    const minComp  = compAvgs.length ? Math.min(...compAvgs) : null;
    const gapMin   = gapPct(os.avgPrice, minComp);

    return `
      <tr>
        <td>
          <span class="brand-pill own">${ownBrand}</span><br>
          <small style="color:var(--text-muted);font-size:.72rem">prom. ${fmt(os.avgPrice)} · mín. ${fmt(os.minPrice)}</small>
        </td>
        ${compCells}
        <td>${gapPill(gapMin)}</td>
      </tr>`;
  }).join('');

  return `
    <div class="detail-section">
      <div class="detail-section-title">
        <span class="detail-section-icon">📐</span>
        GAP de Precios — Nuestras Marcas vs. Competencia
      </div>
      <div class="table-card">
        <div class="table-card-header">Precio promedio · positivo = somos más baratos · negativo = somos más caros</div>
        <div class="table-wrap">
          <table class="gap-table">
            <thead><tr><th>Nuestra marca</th>${colHeaders}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// ── E. Active offers list ─────────────────────────────────────────────

function buildSectionActiveOffers(catItems) {
  const offers = catItems.filter((i) => i.listPrice && i.listPrice > i.price);
  if (!offers.length) return '';

  const sorted = [...offers].sort((a, b) => (1 - b.price / b.listPrice) - (1 - a.price / a.listPrice));

  const rowsHtml = sorted.map((p) => {
    const disc    = Math.round((1 - p.price / p.listPrice) * 100);
    const savings = Math.round(p.listPrice - p.price);
    const cls     = p.isOwn ? 'own' : 'comp';
    return `
      <tr>
        <td><span class="brand-pill ${cls}">${p.brand}</span></td>
        <td class="product-name-cell">${p.name}</td>
        <td>${p.super}</td>
        <td class="price-cell"><s style="color:var(--text-light)">${fmt(p.listPrice)}</s></td>
        <td class="price-cell" style="color:var(--green)">${fmt(p.price)}</td>
        <td class="price-cell">$${savings}</td>
        <td><span class="offer-badge">-${disc}%</span></td>
      </tr>`;
  }).join('');

  return `
    <div class="detail-section">
      <div class="detail-section-title">
        <span class="detail-section-icon">🔖</span>
        Ofertas activas <span class="offer-count-badge">${offers.length}</span>
      </div>
      <div class="table-card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Marca</th><th>Producto</th><th>Super</th><th>Precio lista</th><th>Precio oferta</th><th>Ahorro</th><th>Desc.</th></tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// ── F. Product detail tables (own + comp) ────────────────────────────

function buildBrandProductsTable(brandItems) {
  const activeSupers = SUPERS.filter((s) => state.activeSupers.has(s));
  const byName = groupBy(brandItems, 'name');

  const rowsHtml = [...byName.entries()].map(([name, prods]) => {
    const superCells = activeSupers.map((s) => {
      const prod = prods.find((p) => p.super === s);
      if (!prod) return `<td class="price-dash">—</td>`;
      const hasOffer = prod.listPrice && prod.listPrice > prod.price;
      let cell = `<span class="price-bold">${fmt(prod.price)}</span>`;
      if (hasOffer) {
        const disc = Math.round((1 - prod.price / prod.listPrice) * 100);
        cell += ` <span class="offer-badge">🏷 -${disc}%</span>`;
      }
      return `<td>${cell}</td>`;
    }).join('');
    const hasAnyOffer = prods.some((p) => p.listPrice && p.listPrice > p.price);
    return `
      <tr>
        <td class="product-name-cell">${name}</td>
        ${superCells}
        <td>${hasAnyOffer ? '<span class="offer-badge">Sí</span>' : '<span style="color:var(--text-light)">—</span>'}</td>
      </tr>`;
  }).join('');

  const superHeaders = activeSupers.map((s) => `<th>${s}</th>`).join('');
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nombre</th>${superHeaders}<th>¿Oferta?</th></tr></thead>
        <tbody>${rowsHtml || '<tr><td colspan="99" style="text-align:center;padding:20px;color:var(--text-muted)">Sin productos</td></tr>'}</tbody>
      </table>
    </div>`;
}

function buildBrandSection(brand, items, isOwn) {
  const cls = isOwn ? 'own' : 'comp';
  return `
    <div class="brand-section">
      <div class="brand-section-header">
        <span class="brand-pill ${cls}">${brand}</span>
        <span class="brand-count">${items.length} producto${items.length !== 1 ? 's' : ''}</span>
      </div>
      ${buildBrandProductsTable(items)}
    </div>`;
}

function buildSectionProductDetail(catItems) {
  const ownItems  = catItems.filter((i) => i.isOwn);
  const compItems = catItems.filter((i) => !i.isOwn);

  const ownHtml = ownItems.length
    ? `<div class="detail-section">
        <div class="detail-section-title"><span class="detail-section-icon">🏷</span> Nuestras Marcas — detalle de productos</div>
        ${[...groupBy(ownItems, 'brand').entries()].map(([b, it]) => buildBrandSection(b, it, true)).join('')}
       </div>`
    : '';

  const compHtml = compItems.length
    ? `<div class="detail-section">
        <div class="detail-section-title"><span class="detail-section-icon">🔵</span> Competencia — detalle de productos</div>
        ${[...groupBy(compItems, 'brand').entries()].map(([b, it]) => buildBrandSection(b, it, false)).join('')}
       </div>`
    : '';

  return ownHtml + compHtml;
}

// ── Tab rendering ─────────────────────────────────────────────────────

const DETAIL_TABS = [
  { id: 'precios',   label: '📊 Precios',    icon: '📊' },
  { id: 'skus',      label: '📦 SKUs',       icon: '📦' },
  { id: 'ofertas',   label: '🏷 Ofertas',    icon: '🏷' },
  { id: 'gap',       label: '📐 GAP',        icon: '📐' },
];

function renderTabContent(tabId, cat, catItems, canvasId) {
  const panel = document.getElementById(`tab-panel-${tabId}`);
  if (!panel) return;

  destroyChart(canvasId);

  switch (tabId) {
    case 'precios':
      panel.innerHTML = buildSectionPriceChart(cat, catItems, canvasId) + buildSectionProductDetail(catItems);
      requestAnimationFrame(() => buildChartPricePositioning(canvasId, catItems));
      break;
    case 'skus':
      panel.innerHTML = buildSectionSkuMatrix(catItems);
      break;
    case 'ofertas':
      panel.innerHTML = buildSectionOfferAnalysis(catItems) + buildSectionActiveOffers(catItems);
      break;
    case 'gap':
      panel.innerHTML = buildSectionGap(catItems);
      break;
  }
}

function renderCategory(cat) {
  const main = document.getElementById('appMain');
  const meta = CAT_META[cat];

  const catItems = state.raw.items
    .filter((i) => i.category === cat && state.activeSupers.has(i.super))
    .filter((i) => state.activeBrands.has(i.brand));

  const canvasId = `chart-detail-${meta.cls}`;

  const superChipsHtml = SUPERS.map((s) => {
    const active = state.activeSupers.has(s) ? 'active' : '';
    const clsKey = s === 'Disco' ? 'disco' : s === 'TaTa' ? 'tata' : s === 'Tienda Inglesa' ? 'ti' : 'ed';
    return `<button class="chip chip-${clsKey} ${active}" data-super="${s}">${s}</button>`;
  }).join('');

  const tabsHtml = DETAIL_TABS.map((t, i) =>
    `<button class="detail-tab${i === 0 ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`
  ).join('');

  const panelsHtml = DETAIL_TABS.map((t, i) =>
    `<div class="detail-tab-panel${i === 0 ? ' active' : ''}" id="tab-panel-${t.id}"></div>`
  ).join('');

  main.innerHTML = `
    <div class="detail-back">
      <button class="btn-back" id="btnBack">← Volver</button>
    </div>
    <div class="detail-header detail-header-${meta.cls}">
      <div class="detail-header-emoji">${meta.emoji}</div>
      <div class="detail-header-info">
        <div class="detail-header-title">${cat}</div>
        <div class="detail-header-sub">${catItems.length} productos · ${[...new Set(catItems.map(i => i.brand))].length} marcas</div>
      </div>
    </div>
    <div class="detail-filter-row">
      <span class="filter-label">Supermercados:</span>
      <div class="chip-row" id="detailChipSupers">${superChipsHtml}</div>
    </div>
    <div class="detail-tabs-bar">${tabsHtml}</div>
    <div class="detail-tabs-content">${panelsHtml}</div>
  `;

  // Wire back button
  document.getElementById('btnBack').addEventListener('click', () => setView('home'));

  // Wire super chips
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

  // Wire tabs
  let activeTab = 'precios';
  document.querySelectorAll('.detail-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.detail-tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.detail-tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      document.getElementById(`tab-panel-${tabId}`)?.classList.add('active');
      renderTabContent(tabId, cat, catItems, canvasId);
      activeTab = tabId;
    });
  });

  // Render first tab
  renderTabContent('precios', cat, catItems, canvasId);
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════════════════

function render() {
  if (state.view === 'home') {
    renderHome();
  } else if (state.view === 'category' && state.currentCat) {
    renderCategory(state.currentCat);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// FILTER WIRING
// ═══════════════════════════════════════════════════════════════════════

function initFilters() {
  // Category pills (header bar)
  document.querySelectorAll('.cat-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      if (state.activeCats.has(cat)) {
        state.activeCats.delete(cat);
        btn.classList.remove('active');
      } else {
        state.activeCats.add(cat);
        btn.classList.add('active');
      }
      if (state.view === 'home') render();
    });
  });

  // Super chips (main filter bar)
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

  // Brand chips
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

// ═══════════════════════════════════════════════════════════════════════
// REFRESH
// ═══════════════════════════════════════════════════════════════════════

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
      toast(
        `✓ ${count} productos de ${ok}/${results.length} supermercados. Fallaron: ${failed.map((f) => f.name).join(', ')}`,
        'info', 8000
      );
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

// ═══════════════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  initFilters();
  document.getElementById('btnRefresh').addEventListener('click', doRefresh);
  await loadData();
});
