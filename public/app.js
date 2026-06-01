/**
 * Góndola Competencia — Frontend Application
 * Single-page competitive price monitoring dashboard.
 * Pure vanilla JS, ES modules. Chart.js loaded from CDN.
 */

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const CATEGORIES = ['Pan de Molde', 'Pan de Viena', 'Pan de Tortuga'];

const CAT_META = {
  'Pan de Molde':    { emoji: '🍞', cls: 'molde',   color: '#1976d2' },
  'Pan de Viena':    { emoji: '🥖', cls: 'viena',   color: '#7b1fa2' },
  'Pan de Tortuga':  { emoji: '🐢', cls: 'tortuga', color: '#e65100' },
};

const SUPERS = ['Disco', 'TaTa', 'Tienda Inglesa', 'El Dorado'];

const SUPER_COLORS = {
  'Disco':          '#00897b',
  'TaTa':           '#6a1b9a',
  'Tienda Inglesa': '#2e7d32',
  'El Dorado':      '#e65100',
};

const BADGE_IDS = {
  'Pan de Molde':   'badgeMolde',
  'Pan de Viena':   'badgeViena',
  'Pan de Tortuga': 'badgeTortuga',
};

// ═══════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════

const state = {
  raw: { generatedAt: null, items: [] },
  // Active filter sets
  activeCats:   new Set(CATEGORIES),
  activeSupers: new Set(SUPERS),
  showOwn:  true,
  showComp: true,
};

// Chart.js instances registry — destroyed before each re-render
const charts = {};

// ═══════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/** Format a price number as "$NNN" */
const fmt = (n) => (n != null && !isNaN(n)) ? `$${Number(n).toFixed(0)}` : '—';

/** Average of a numeric array, or null if empty */
const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

/** Percent difference: (a - b) / b * 100 */
const gapPct = (a, b) =>
  (a != null && b != null && b !== 0) ? ((a - b) / b * 100) : null;

/** Group array by a string key, returning a Map<key, item[]> */
function groupBy(arr, key) {
  const m = new Map();
  for (const item of arr) {
    const k = item[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

/** Format an ISO date string as "DD/MM HH:MM" */
function formatDate(iso) {
  if (!iso) return 'Sin datos';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Return items filtered by all active state filters */
function filteredItems() {
  return state.raw.items.filter((i) => {
    if (!state.activeCats.has(i.category))   return false;
    if (!state.activeSupers.has(i.super))    return false;
    if (i.isOwn  && !state.showOwn)          return false;
    if (!i.isOwn && !state.showComp)         return false;
    return true;
  });
}

/** Destroy a Chart.js instance by canvas id */
function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

/** Destroy ALL tracked Chart.js instances */
function destroyAllCharts() {
  Object.keys(charts).forEach(destroyChart);
}

// ═══════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
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
// CATEGORY BADGE COUNTS
// ═══════════════════════════════════════════════════════════════════════

function updateCategoryBadges() {
  const all = state.raw.items;
  for (const cat of CATEGORIES) {
    const el = document.getElementById(BADGE_IDS[cat]);
    if (!el) continue;
    const count = all.filter((i) => i.category === cat).length;
    el.textContent = count > 0 ? `${count} productos` : '—';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// HEADER TIMESTAMP
// ═══════════════════════════════════════════════════════════════════════

function updateLastUpdate() {
  const el = document.getElementById('lastUpdate');
  if (!el) return;
  el.textContent = state.raw.generatedAt
    ? `Actualizado: ${formatDate(state.raw.generatedAt)}`
    : 'Sin datos';
}

// ═══════════════════════════════════════════════════════════════════════
// HTML BUILDING BLOCKS
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

/** Build the 5 KPI mini-cards for a given category's item set */
function buildKpiRow(catItems, catColor) {
  const ownItems  = catItems.filter((i) => i.isOwn);
  const compItems = catItems.filter((i) => !i.isOwn);

  const ownPrices  = ownItems.map((i) => i.price).filter((p) => p != null);
  const compPrices = compItems.map((i) => i.price).filter((p) => p != null);
  const allPrices  = catItems.map((i) => i.price).filter((p) => p != null);

  const minPrice = allPrices.length ? Math.min(...allPrices) : null;
  const avgOwn   = avg(ownPrices);
  const avgComp  = avg(compPrices);
  const gap      = gapPct(avgOwn, avgComp);

  let gapClass = '';
  let gapLabel = '—';
  if (gap !== null) {
    const sign = gap > 0 ? '+' : '';
    gapLabel = `${sign}${gap.toFixed(1)}%`;
    gapClass = gap <= 0 ? 'gap-green' : 'gap-red';
  }

  const kpis = [
    {
      label: 'Total productos',
      value: catItems.length,
      sub: `${ownItems.length} RGM · ${compItems.length} comp.`,
      color: catColor,
    },
    {
      label: 'Precio mín',
      value: fmt(minPrice),
      sub: 'menor precio encontrado',
      color: '#00897b',
    },
    {
      label: 'Precio prom. RGM',
      value: fmt(avgOwn),
      sub: 'marcas propias',
      color: '#1976d2',
    },
    {
      label: 'Precio prom. competencia',
      value: fmt(avgComp),
      sub: 'marcas competidoras',
      color: '#6a1b9a',
    },
    {
      label: 'GAP RGM vs comp.',
      value: gapLabel,
      sub: gap !== null ? (gap <= 0 ? '✓ RGM más económico' : '⚠ Competencia más económica') : 'sin datos',
      color: gap !== null ? (gap <= 0 ? '#388e3c' : '#c62828') : '#94a3b8',
      extraClass: gapClass,
    },
  ];

  const cards = kpis.map((k) => `
    <div class="kpi-card ${k.extraClass || ''}" style="--kpi-color: ${k.color}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>
  `).join('');

  return `<div class="kpi-row">${cards}</div>`;
}

/** Build horizontal bar chart "Precio promedio por marca" for a category */
function buildBarChart(canvasId, catItems, catColor) {
  const byBrand = groupBy(catItems, 'brand');
  const entries = [...byBrand.entries()]
    .map(([brand, items]) => {
      const prices = items.map((i) => i.price).filter((p) => p != null);
      return {
        brand,
        isOwn: items[0]?.isOwn ?? false,
        avgPrice: avg(prices),
      };
    })
    .filter((e) => e.avgPrice != null)
    .sort((a, b) => a.avgPrice - b.avgPrice);

  const labels = entries.map((e) => e.brand);
  const data   = entries.map((e) => Math.round(e.avgPrice));
  const colors = entries.map((e) => e.isOwn ? catColor : '#9e9e9e');

  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Precio promedio ($)',
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
      },
      scales: {
        x: {
          beginAtZero: false,
          ticks: { callback: (v) => '$' + v, font: { size: 11 } },
          grid: { color: '#f0f0f0' },
        },
        y: {
          ticks: { font: { size: 11 } },
          grid: { display: false },
        },
      },
    },
  });
}

/** Build donut chart "Presencia por supermercado" for a category */
function buildDonutChart(canvasId, catItems) {
  const bySuper = groupBy(catItems, 'super');
  const labels  = [...bySuper.keys()];
  const data    = labels.map((s) => bySuper.get(s).length);
  const colors  = labels.map((s) => SUPER_COLORS[s] || '#bbb');

  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { font: { size: 11 }, padding: 14, usePointStyle: true },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed} productos`,
          },
        },
      },
    },
  });
}

/** Build the price comparison table for one category */
function buildPriceTable(catItems) {
  // Gather brands → one row per brand
  const byBrand = groupBy(catItems, 'brand');

  // For each brand: avg price per super, overall avg
  const rows = [...byBrand.entries()].map(([brand, items]) => {
    const isOwn = items[0]?.isOwn ?? false;
    const superPrices = {};
    for (const s of SUPERS) {
      const prices = items
        .filter((i) => i.super === s && i.price != null)
        .map((i) => i.price);
      superPrices[s] = prices.length ? avg(prices) : null;
    }
    const validPrices = Object.values(superPrices).filter((p) => p != null);
    const avgAll  = avg(validPrices);

    // URL: pick first available
    const withUrl = items.find((i) => i.url);
    return { brand, isOwn, superPrices, avgAll, url: withUrl?.url ?? null };
  }).sort((a, b) => (a.avgAll ?? 9999) - (b.avgAll ?? 9999));

  // Cheapest competitor avg for GAP reference
  const compRows  = rows.filter((r) => !r.isOwn && r.avgAll != null);
  const leaderAvg = compRows.length ? Math.min(...compRows.map((r) => r.avgAll)) : null;

  // Table rows HTML
  const rowsHtml = rows.map((r) => {
    const superCells = SUPERS.map((s) => {
      const p = r.superPrices[s];
      return p != null
        ? `<td class="price-cell">${fmt(p)}</td>`
        : `<td class="price-dash">—</td>`;
    }).join('');

    const promCell = r.avgAll != null
      ? `<td class="price-cell">${fmt(r.avgAll)}</td>`
      : `<td class="price-dash">—</td>`;

    let gapCell = '<td>—</td>';
    if (r.isOwn) {
      // GAP vs cheapest competitor
      const gap = gapPct(r.avgAll, leaderAvg);
      if (gap !== null) {
        const sign = gap > 0 ? '+' : '';
        const cls  = gap <= 0 ? 'positive' : 'negative';
        gapCell = `<td><span class="gap-pill ${cls}">${sign}${gap.toFixed(1)}%</span></td>`;
      }
    } else {
      gapCell = '<td><span class="gap-pill neutral">—</span></td>';
    }

    const brandPill = `<span class="brand-pill ${r.isOwn ? 'own' : 'comp'}">${r.brand}</span>`;
    const ownBadge  = r.isOwn
      ? '<span style="font-size:.7rem;font-weight:700;color:var(--own-text)">✓</span>'
      : '<span style="color:var(--text-light)">—</span>';

    const urlCell = r.url
      ? `<td><a href="${r.url}" target="_blank" rel="noopener" class="link-icon" title="Ver en tienda">↗</a></td>`
      : '<td></td>';

    return `
      <tr class="${r.isOwn ? 'row-own' : ''}">
        <td>${brandPill}</td>
        <td style="text-align:center">${ownBadge}</td>
        ${superCells}
        ${promCell}
        ${gapCell}
        ${urlCell}
      </tr>`;
  }).join('');

  const superHeaders = SUPERS.map((s) => `<th>${s}</th>`).join('');

  return `
    <div class="table-card">
      <div class="table-card-header">📋 Comparación de precios por marca y supermercado</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Marca</th>
              <th>¿Nuestra?</th>
              ${superHeaders}
              <th>Prom.</th>
              <th>GAP vs líder %</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted)">Sin datos para los filtros seleccionados</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════
// RENDER — ONE CATEGORY SECTION
// ═══════════════════════════════════════════════════════════════════════

function buildCategorySection(cat, catItems) {
  const meta    = CAT_META[cat];
  const count   = catItems.length;
  const allPrices = catItems.map((i) => i.price).filter((p) => p != null);
  const avgAll  = avg(allPrices);

  const barCanvasId   = `chart-bar-${meta.cls}`;
  const donutCanvasId = `chart-donut-${meta.cls}`;

  return `
    <section class="cat-section" id="section-${meta.cls}">

      <!-- Section header -->
      <div class="cat-section-header ${meta.cls}">
        <div class="cat-section-emoji">${meta.emoji}</div>
        <div class="cat-section-info">
          <div class="cat-section-name">${cat}</div>
          <div class="cat-section-meta">${count} productos monitoreados en esta categoría</div>
        </div>
        <div class="cat-avg-badge">
          <span class="cat-avg-badge-label">Precio prom.</span>
          <span class="cat-avg-badge-value">${fmt(avgAll)}</span>
        </div>
      </div>

      <!-- KPI row -->
      ${buildKpiRow(catItems, meta.color)}

      <!-- Charts row -->
      <div class="charts-row">
        <div class="chart-card">
          <div class="chart-card-title">
            <div class="chart-icon" style="background:color-mix(in srgb,${meta.color} 15%,white)">📊</div>
            Precio promedio por marca
          </div>
          <div class="chart-wrap"><canvas id="${barCanvasId}"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-title">
            <div class="chart-icon" style="background:#e8f5e9">🏪</div>
            Presencia por supermercado
          </div>
          <div class="chart-wrap"><canvas id="${donutCanvasId}"></canvas></div>
        </div>
      </div>

      <!-- Price comparison table -->
      ${buildPriceTable(catItems)}

    </section>`;
}

// ═══════════════════════════════════════════════════════════════════════
// RENDER — GAP ANALYSIS CARD (final summary)
// ═══════════════════════════════════════════════════════════════════════

function buildGapAnalysisCard(allFilteredItems) {
  const rows = CATEGORIES
    .filter((cat) => state.activeCats.has(cat))
    .map((cat) => {
      const catItems   = allFilteredItems.filter((i) => i.category === cat);
      const ownItems   = catItems.filter((i) => i.isOwn);
      const compItems  = catItems.filter((i) => !i.isOwn);

      const ownPrices  = ownItems.map((i) => i.price).filter((p) => p != null);
      const compPrices = compItems.map((i) => i.price).filter((p) => p != null);

      const bestOwn  = ownPrices.length  ? Math.min(...ownPrices)  : null;
      const bestComp = compPrices.length ? Math.min(...compPrices) : null;

      // Cheapest competitor brand
      const byBrand = groupBy(compItems, 'brand');
      let cheapestCompBrand = '—';
      let cheapestCompPrice = null;
      for (const [brand, items] of byBrand) {
        const prices = items.map((i) => i.price).filter((p) => p != null);
        const m = avg(prices);
        if (m != null && (cheapestCompPrice === null || m < cheapestCompPrice)) {
          cheapestCompPrice = m;
          cheapestCompBrand = brand;
        }
      }

      const gap = gapPct(bestOwn, bestComp);
      const meta = CAT_META[cat];

      let interpHtml = '<span style="color:var(--text-light)">Sin datos</span>';
      if (gap !== null) {
        if (gap <= 0) {
          interpHtml = `<span class="interp-better">✓ Somos más baratos (${gap.toFixed(1)}%)</span>`;
        } else {
          interpHtml = `<span class="interp-worse">⚠ Competencia más barata por ${gap.toFixed(1)}%</span>`;
        }
      }

      return `
        <tr>
          <td>
            <span style="font-size:1.1rem;margin-right:6px">${meta.emoji}</span>
            <strong>${cat}</strong>
          </td>
          <td>${cheapestCompBrand !== '—' ? `<span class="brand-pill comp">${cheapestCompBrand}</span>` : '—'}</td>
          <td class="price-cell">${fmt(cheapestCompPrice)}</td>
          <td class="price-cell">${fmt(bestOwn)}</td>
          <td>${gap !== null ? `<span class="gap-pill ${gap <= 0 ? 'positive' : 'negative'}">${gap > 0 ? '+' : ''}${gap.toFixed(1)}%</span>` : '—'}</td>
          <td>${interpHtml}</td>
        </tr>`;
    }).join('');

  return `
    <div class="gap-analysis-card">
      <div class="gap-analysis-header">
        <h2>📈 Análisis de Gaps por Categoría</h2>
        <p>Comparación del mejor precio RGM vs. el competidor más barato en cada categoría</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Marca más barata (comp.)</th>
              <th>Su precio mín.</th>
              <th>Nuestro mejor precio</th>
              <th>GAP %</th>
              <th>Interpretación</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN RENDER FUNCTION
// ═══════════════════════════════════════════════════════════════════════

function render() {
  destroyAllCharts();

  const main = document.getElementById('appMain');
  const items = filteredItems();

  // Empty state
  if (state.raw.items.length === 0) {
    main.innerHTML = buildEmptyState();
    document.getElementById('emptyRefreshBtn')?.addEventListener('click', doRefresh);
    return;
  }

  // Build sections for each active category
  const sectionsHtml = CATEGORIES
    .filter((cat) => state.activeCats.has(cat))
    .map((cat) => {
      const catItems = items.filter((i) => i.category === cat);
      if (!catItems.length) return '';
      return buildCategorySection(cat, catItems);
    })
    .join('');

  const gapHtml = items.length > 0 ? buildGapAnalysisCard(items) : '';

  main.innerHTML = sectionsHtml + gapHtml;

  // Instantiate charts after DOM is ready
  for (const cat of CATEGORIES) {
    if (!state.activeCats.has(cat)) continue;
    const meta     = CAT_META[cat];
    const catItems = items.filter((i) => i.category === cat);
    if (!catItems.length) continue;
    buildBarChart(`chart-bar-${meta.cls}`, catItems, meta.color);
    buildDonutChart(`chart-donut-${meta.cls}`, catItems);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// FILTER WIRING
// ═══════════════════════════════════════════════════════════════════════

function initFilters() {
  // Category pills
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
      render();
    });
  });

  // Super chips
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
      render();
    });
  });

  // Brand chips
  document.querySelectorAll('#chipMarcas .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const m = chip.dataset.marca;
      if (m === 'own') {
        state.showOwn = !state.showOwn;
        chip.classList.toggle('active', state.showOwn);
      } else if (m === 'comp') {
        state.showComp = !state.showComp;
        chip.classList.toggle('active', state.showComp);
      }
      render();
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════
// REFRESH BUTTON
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
        'info',
        8000
      );
    } else {
      toast(`✓ ${count} productos actualizados (${results.length} supermercados)`, 'success');
    }

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
  // Show loading spinner
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
