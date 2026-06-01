/**
 * Góndola Competencia — Frontend Application
 * Vanilla JS, ES modules. Chart.js from CDN.
 */

// ── Constants ─────────────────────────────────────────────────────────────

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

// ── State ─────────────────────────────────────────────────────────────────

const state = {
  raw: { generatedAt: null, items: [] },
  view: 'home',
  currentCat: null,
  activeSupers: new Set(['Disco', 'TaTa', 'Tienda Inglesa', 'El Dorado']),
  activeBrands: new Set(['Bimbo', 'Los Sorchantes', 'Magno', 'Bauducco', 'Visconti', 'Marbella', 'Precio Líder']),
};

const charts = {};

// ── Utilities ─────────────────────────────────────────────────────────────

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

// ── Toast ─────────────────────────────────────────────────────────────────

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

// ── Header / badges ───────────────────────────────────────────────────────

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

// ── Navigation ────────────────────────────────────────────────────────────

function setView(view, cat) {
  destroyAllCharts();
  state.view = view;
  state.currentCat = cat || null;
  render();
}

// ── Home view ─────────────────────────────────────────────────────────────

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
    const meta  = CAT_META[cat];
    const items = state.raw.items.filter((i) => i.category === cat && state.activeSupers.has(i.super));

    const brands = [...OWN_BRANDS, ...COMP_BRANDS].filter((b) => items.some((i) => i.brand === b));
    const skuCount = items.length;

    const chartHeight = Math.max(200, brands.length * 40 + 40);

    return `
      <div class="home-card home-card-${meta.cls}" data-cat="${cat}">
        <div class="home-card-head">
          <span class="home-card-emoji">${meta.emoji}</span>
          <div>
            <div class="home-card-title">${cat}</div>
            <div class="home-card-meta">${brands.length} marcas · ${skuCount} SKUs</div>
          </div>
        </div>
        <div class="home-chart-wrap" style="height:${chartHeight}px">
          <canvas id="home-chart-${meta.cls}"></canvas>
        </div>
        <button class="home-card-cta" data-cat="${cat}">Ver detalle →</button>
      </div>`;
  }).join('');

  main.innerHTML = `<div class="home-grid">${cardsHtml}</div>`;

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
    const meta  = CAT_META[cat];
    const items = state.raw.items.filter((i) => i.category === cat && state.activeSupers.has(i.super));

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

    const labels = entries.map((e) => e.brand);
    const data   = entries.map((e) => Math.round(e.avgPrice));
    const colors = entries.map((e) => brandColor(e.brand));

    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderRadius: 5,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` $${ctx.parsed.x}`,
            },
          },
          datalabels: false,
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

// ── Category detail view ──────────────────────────────────────────────────

function renderCategory(cat) {
  const main = document.getElementById('appMain');
  const meta = CAT_META[cat];

  const catItems = state.raw.items
    .filter((i) => i.category === cat && state.activeSupers.has(i.super) && state.activeBrands.has(i.brand));

  const brands    = [...new Set(catItems.map((i) => i.brand))];
  const skuCount  = catItems.length;

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

  const tabsHtml = TABS.map((t, i) =>
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

  let activeTabId = 'precios';
  document.querySelectorAll('.detail-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.detail-tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.detail-tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      document.getElementById(`tab-panel-${tabId}`)?.classList.add('active');
      renderTabContent(tabId, cat, catItems);
      activeTabId = tabId;
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
      break;
    case 'ofertas':
      panel.innerHTML = buildTabOfertas(catItems);
      break;
    case 'cobertura':
      panel.innerHTML = buildTabCobertura(catItems);
      break;
  }
}

// ── Tab: Precios ──────────────────────────────────────────────────────────

function buildTabPrecios(cat, catItems, canvasId) {
  const allBrands = [...OWN_BRANDS, ...COMP_BRANDS];
  const entries = allBrands
    .map((brand) => {
      const stats = brandStatsFor(brand, catItems);
      if (!stats.total) return null;
      return { brand, isOwn: OWN_BRANDS.includes(brand), ...stats };
    })
    .filter(Boolean)
    .sort((a, b) => (a.avgPrice ?? Infinity) - (b.avgPrice ?? Infinity));

  if (!entries.length) return '<div class="tab-empty">Sin datos para los filtros seleccionados.</div>';

  const chartHeight = Math.max(220, entries.length * 46);

  const rows = entries.map((e) => {
    const dot = e.isOwn ? '<span class="own-dot">●</span> ' : '';
    return `
      <tr>
        <td>${dot}<span class="brand-pill ${e.isOwn ? 'own' : 'comp'}">${e.brand}</span></td>
        <td class="price-cell">${fmt(e.avgPrice)}</td>
        <td class="price-cell">${fmt(e.minPrice)}</td>
        <td class="price-cell">${fmt(e.maxPrice)}</td>
        <td>${e.total}</td>
        <td>${e.offerCount > 0 ? `<span class="offer-badge">-${Math.round(e.avgDiscount ?? 0)}% · ${e.offerCount}</span>` : '<span class="muted">—</span>'}</td>
      </tr>`;
  }).join('');

  return `
    <div class="tab-section">
      <div class="chart-card">
        <div class="chart-card-title">Precio promedio por marca (menor → mayor)</div>
        <div class="chart-wrap" style="height:${chartHeight}px">
          <canvas id="${canvasId}"></canvas>
        </div>
      </div>
    </div>
    <div class="tab-section">
      <div class="table-card">
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
    </div>`;
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
        data: entries.map((e) => Math.round(e.avgPrice)),
        backgroundColor: entries.map((e) => brandColor(e.brand)),
        borderRadius: 5,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` $${ctx.parsed.x}` } },
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

// ── Tab: Ofertas ──────────────────────────────────────────────────────────

function buildTabOfertas(catItems) {
  const offers = catItems.filter((i) => i.listPrice && i.listPrice > i.price);

  if (!offers.length) {
    return '<div class="tab-empty">No hay ofertas activas para los filtros seleccionados.</div>';
  }

  const sorted     = [...offers].sort((a, b) => (1 - b.price / b.listPrice) - (1 - a.price / a.listPrice));
  const totalDisc  = avg(sorted.map((i) => (1 - i.price / i.listPrice) * 100));

  const summaryHtml = `
    <div class="offers-summary">
      <span><strong>${offers.length}</strong> productos en oferta</span>
      <span class="offer-badge">Descuento promedio ${totalDisc?.toFixed(1) ?? '—'}%</span>
    </div>`;

  const byBrand = groupBy(sorted, 'brand');
  const brandsHtml = [...byBrand.entries()].map(([brand, items]) => {
    const isOwn = OWN_BRANDS.includes(brand);
    const rows = items.map((p) => {
      const disc    = Math.round((1 - p.price / p.listPrice) * 100);
      return `
        <div class="offer-row">
          <span class="offer-super">${p.super}</span>
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
    </div>`;
}

// ── Tab: Cobertura ────────────────────────────────────────────────────────

function buildTabCobertura(catItems) {
  const activeSupers = SUPERS.filter((s) => state.activeSupers.has(s));
  if (!activeSupers.length) return '<div class="tab-empty">Seleccioná al menos un supermercado.</div>';

  const allBrands = [...OWN_BRANDS, ...COMP_BRANDS].filter((b) => catItems.some((i) => i.brand === b));
  if (!allBrands.length) return '<div class="tab-empty">Sin datos para los filtros seleccionados.</div>';

  const blocksHtml = activeSupers.map((s) => {
    const superItems  = catItems.filter((i) => i.super === s);
    const totalSkus   = superItems.length;
    const ownSkus     = superItems.filter((i) => i.isOwn).length;
    const compSkus    = totalSkus - ownSkus;
    const color       = SUPER_COLORS[s];

    const brandsHtml = allBrands.map((brand) => {
      const brandItems = superItems.filter((i) => i.brand === brand);
      if (!brandItems.length) return '';
      const isOwn = OWN_BRANDS.includes(brand);
      return `<span class="brand-pill ${isOwn ? 'own' : 'comp'}">${brand} <span class="pill-count">${brandItems.length}</span></span>`;
    }).filter(Boolean).join('');

    return `
      <div class="coverage-block" style="--super-color:${color}">
        <div class="coverage-block-head">
          <span class="coverage-super-name">${s}</span>
          <span class="coverage-meta">
            <span>${totalSkus} SKUs total</span>
            <span class="brand-pill own">Propias ${ownSkus}</span>
            <span class="brand-pill comp">Comp. ${compSkus}</span>
          </span>
        </div>
        <div class="coverage-brands">
          ${brandsHtml || '<span class="muted">Sin productos</span>'}
        </div>
      </div>`;
  }).join('');

  return `<div class="tab-section">${blocksHtml}</div>`;
}

// ── Main render ───────────────────────────────────────────────────────────

function render() {
  if (state.view === 'home') {
    renderHome();
  } else if (state.view === 'category' && state.currentCat) {
    renderCategory(state.currentCat);
  }
}

// ── Filter wiring ─────────────────────────────────────────────────────────

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

// ── Refresh ───────────────────────────────────────────────────────────────

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

// ── Data loading ──────────────────────────────────────────────────────────

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

// ── Bootstrap ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  initFilters();
  document.getElementById('btnRefresh').addEventListener('click', doRefresh);
  await loadData();
});
