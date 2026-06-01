/**
 * Góndola Competencia — Frontend Application
 * All 5 views: Resumen, Por Categoría, Por Supermercado, GAP de Precios, Ofertas
 */

// ── State ──────────────────────────────────────────────────────────────
let state = {
  raw: { generatedAt: null, items: [], scrapeResults: [] },
  currentView: 'resumen',
  filters: {
    categorias: new Set(['Pan de Molde', 'Pan de Tortuga', 'Pan de Viena']),
    supers: new Set(['Disco', 'TaTa', 'Tienda Inglesa', 'El Dorado']),
  },
};

// Chart.js instances to destroy before re-render
const charts = {};

// ── Helpers ────────────────────────────────────────────────────────────
const fmt = (n) => n != null ? `$${Number(n).toFixed(0)}` : '—';
const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
const pct = (a, b) => (b && a != null && b != null) ? ((a - b) / b * 100).toFixed(1) : null;

function filteredItems() {
  return state.raw.items.filter(
    (i) => state.filters.categorias.has(i.category) && state.filters.supers.has(i.super)
  );
}

function groupBy(arr, key) {
  const m = new Map();
  for (const item of arr) {
    const k = item[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

function superClass(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '');
}

function catDotClass(cat) {
  if (!cat) return '';
  if (/molde/i.test(cat)) return 'molde';
  if (/tortuga/i.test(cat)) return 'tortuga';
  if (/viena/i.test(cat)) return 'viena';
  return '';
}

function formatDate(iso) {
  if (!iso) return 'Sin datos';
  const d = new Date(iso);
  return d.toLocaleString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Toast ──────────────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 4000) {
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Update filter button labels ────────────────────────────────────────
function updateFilterLabels() {
  const allCats = ['Pan de Molde', 'Pan de Tortuga', 'Pan de Viena'];
  const allSupers = ['Disco', 'TaTa', 'Tienda Inglesa', 'El Dorado'];
  const bCat = document.getElementById('btnCategorias');
  const bSup = document.getElementById('btnSupers');
  if (bCat) {
    const sel = [...state.filters.categorias];
    bCat.childNodes[0].textContent = sel.length === allCats.length
      ? 'Todas las categorías '
      : sel.length === 0 ? 'Ninguna categoría ' : `${sel.length} categorías `;
  }
  if (bSup) {
    const sel = [...state.filters.supers];
    bSup.childNodes[0].textContent = sel.length === allSupers.length
      ? 'Todos los supermercados '
      : sel.length === 0 ? 'Ningún super ' : `${sel.length} supermercados `;
  }
}

// ── Destroy old charts ─────────────────────────────────────────────────
function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ── Render dispatcher ──────────────────────────────────────────────────
function render() {
  // Destroy all charts
  Object.keys(charts).forEach((k) => { charts[k].destroy(); delete charts[k]; });
  const content = document.getElementById('content');
  document.getElementById('loadingState')?.remove();

  const views = {
    resumen: renderResumen,
    categorias: renderCategorias,
    supermercados: renderSupermercados,
    gap: renderGap,
    ofertas: renderOfertas,
  };
  const fn = views[state.currentView] || renderResumen;
  content.innerHTML = '';
  fn(content);
}

// ═══════════════════════════════════════════════════════════════════════
// VIEW 1 — RESUMEN
// ═══════════════════════════════════════════════════════════════════════
function renderResumen(container) {
  const items = filteredItems();
  const ownItems = items.filter((i) => i.isOwn);
  const compItems = items.filter((i) => !i.isOwn);
  const ownPrices = ownItems.map((i) => i.price).filter((p) => p != null);
  const compPrices = compItems.map((i) => i.price).filter((p) => p != null);
  const avgOwn = avg(ownPrices);
  const avgComp = avg(compPrices);
  const gapVal = avgOwn != null && avgComp != null
    ? ((avgOwn - avgComp) / avgComp * 100).toFixed(1)
    : null;

  // KPI cards
  const kpiHtml = `
    <div class="kpi-grid">
      <div class="kpi-card teal">
        <div class="kpi-label">Productos monitoreados</div>
        <div class="kpi-value">${items.length}</div>
        <div class="kpi-sub">${ownItems.length} propios · ${compItems.length} competencia</div>
        <svg class="kpi-icon" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-label">Precio prom. RGM</div>
        <div class="kpi-value">${avgOwn != null ? fmt(avgOwn) : '—'}</div>
        <div class="kpi-sub">Bimbo + Los Sorchantes</div>
        <svg class="kpi-icon" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      </div>
      <div class="kpi-card purple">
        <div class="kpi-label">Precio prom. competencia</div>
        <div class="kpi-value">${avgComp != null ? fmt(avgComp) : '—'}</div>
        <div class="kpi-sub">${[...new Set(compItems.map(i => i.brand))].length} marcas competidoras</div>
        <svg class="kpi-icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      </div>
      <div class="kpi-card orange">
        <div class="kpi-label">GAP promedio vs competencia</div>
        <div class="kpi-value" style="color:${gapVal != null ? (parseFloat(gapVal) <= 0 ? 'var(--green)' : 'var(--red)') : 'inherit'}">${gapVal != null ? (parseFloat(gapVal) > 0 ? '+' : '') + gapVal + '%' : '—'}</div>
        <div class="kpi-sub">${gapVal != null ? (parseFloat(gapVal) <= 0 ? '✓ RGM más económico' : '⚠ Competencia más económica') : 'Sin datos suficientes'}</div>
        <svg class="kpi-icon" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
      </div>
    </div>`;

  // Scrape status
  let statusHtml = '';
  if (state.raw.scrapeResults?.length) {
    statusHtml = `<div class="scrape-status">` +
      state.raw.scrapeResults.map(r => `
        <div class="scrape-badge">
          <div class="dot ${r.ok ? 'ok' : 'err'}"></div>
          ${r.name}: ${r.ok ? r.count + ' productos' : 'Error'}
        </div>`).join('') +
      `</div>`;
  }

  // Chart: avg price by brand per category
  const categories = [...state.filters.categorias].filter(c =>
    items.some(i => i.category === c)
  );
  const brands = [...new Set(items.map(i => i.brand))].sort((a, b) => {
    // own brands first
    const aOwn = items.find(i => i.brand === a)?.isOwn;
    const bOwn = items.find(i => i.brand === b)?.isOwn;
    if (aOwn && !bOwn) return -1;
    if (!aOwn && bOwn) return 1;
    return a.localeCompare(b);
  });

  // Summary table: brand × category avg price
  const brandStats = brands.map(brand => {
    const bi = items.filter(i => i.brand === brand);
    const isOwn = bi[0]?.isOwn ?? false;
    const bycat = {};
    for (const cat of categories) {
      const prices = bi.filter(i => i.category === cat && i.price != null).map(i => i.price);
      bycat[cat] = prices.length ? avg(prices) : null;
    }
    const allPrices = bi.filter(i => i.price != null).map(i => i.price);
    return { brand, isOwn, bycat, avgAll: avg(allPrices), count: bi.length };
  }).filter(b => b.count > 0)
    .sort((a, b) => (a.avgAll ?? 9999) - (b.avgAll ?? 9999));

  const summaryRows = brandStats.map(bs => {
    const catCells = categories.map(cat =>
      `<td class="price-cell">${bs.bycat[cat] != null ? fmt(bs.bycat[cat]) : '—'}</td>`
    ).join('');
    return `<tr class="${bs.isOwn ? 'gap-row-own' : ''}">
      <td><span class="brand-pill ${bs.isOwn ? 'own' : 'comp'}">${bs.brand}</span></td>
      ${catCells}
      <td class="price-cell">${bs.avgAll != null ? fmt(bs.avgAll) : '—'}</td>
      <td>${bs.count}</td>
    </tr>`;
  }).join('');

  const catHeaders = categories.map(c => `<th>${c}</th>`).join('');

  container.innerHTML = `
    ${kpiHtml}
    ${statusHtml}
    <div class="two-col">
      <div class="card">
        <div class="card-title">
          <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Precio promedio por marca y categoría
        </div>
        <div class="chart-wrap"><canvas id="chartBrandCat"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">
          <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Distribución por supermercado
        </div>
        <div class="chart-wrap"><canvas id="chartBySuper"></canvas></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">
        <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/></svg>
        Resumen por marca
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Marca</th>
            ${catHeaders}
            <th>Prom. Global</th>
            <th>Productos</th>
          </tr></thead>
          <tbody>${summaryRows || '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:24px">Sin datos. Haga clic en "Actualizar Precios" para obtener datos de los supermercados.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;

  // Chart 1: grouped bar by brand/category
  if (items.length > 0) {
    const topBrands = brandStats.slice(0, 8);
    const colors = topBrands.map(b =>
      b.isOwn ? 'rgba(33,150,243,0.8)' : 'rgba(239,83,80,0.8)'
    );
    const ctx1 = document.getElementById('chartBrandCat')?.getContext('2d');
    if (ctx1) {
      charts['brandCat'] = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: topBrands.map(b => b.brand),
          datasets: categories.map((cat, ci) => ({
            label: cat,
            data: topBrands.map(b => b.bycat[cat] != null ? Math.round(b.bycat[cat]) : null),
            backgroundColor: ['rgba(33,150,243,0.7)', 'rgba(255,152,0,0.7)', 'rgba(156,39,176,0.7)'][ci] || 'rgba(100,100,100,0.7)',
            borderRadius: 4,
            skipNull: true,
          })),
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
          scales: {
            y: { beginAtZero: false, ticks: { callback: v => '$' + v } },
            x: { ticks: { font: { size: 10 } } },
          },
        },
      });
    }

    // Chart 2: donut by supermarket
    const superGroups = groupBy(items, 'super');
    const ctx2 = document.getElementById('chartBySuper')?.getContext('2d');
    if (ctx2) {
      charts['bySuper'] = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: [...superGroups.keys()],
          datasets: [{
            data: [...superGroups.values()].map(v => v.length),
            backgroundColor: ['#2196f3', '#9c27b0', '#4caf50', '#ff9800'],
            borderWidth: 2, borderColor: '#fff',
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { font: { size: 11 }, padding: 12 } },
          },
        },
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// VIEW 2 — POR CATEGORÍA
// ═══════════════════════════════════════════════════════════════════════
function renderCategorias(container) {
  const items = filteredItems();
  const categories = ['Pan de Molde', 'Pan de Tortuga', 'Pan de Viena']
    .filter(c => state.filters.categorias.has(c));

  if (items.length === 0) {
    container.innerHTML = emptyStateHtml('Sin datos', 'No hay productos con los filtros seleccionados. Actualice los precios o amplíe los filtros.');
    return;
  }

  let html = '';
  for (const cat of categories) {
    const catItems = items.filter(i => i.category === cat);
    if (!catItems.length) continue;

    // Group by brand → compute stats
    const byBrand = groupBy(catItems, 'brand');
    const brandStats = [...byBrand.entries()].map(([brand, bi]) => {
      const isOwn = bi[0].isOwn;
      const prices = bi.filter(i => i.price != null).map(i => i.price);
      const minP = prices.length ? Math.min(...prices) : null;
      const maxP = prices.length ? Math.max(...prices) : null;
      const avgP = prices.length ? avg(prices) : null;
      const supers = [...new Set(bi.map(i => i.super))].join(', ');
      const products = bi.map(i => i.name).join(' / ');
      return { brand, isOwn, minP, maxP, avgP, count: bi.length, supers, products };
    }).sort((a, b) => (a.avgP ?? 9999) - (b.avgP ?? 9999));

    // Reference price: avg of own brands in this cat
    const ownAvg = avg(brandStats.filter(b => b.isOwn && b.avgP != null).map(b => b.avgP));

    const rows = brandStats.map(bs => {
      const gapRaw = ownAvg != null && bs.avgP != null && !bs.isOwn
        ? ((bs.avgP - ownAvg) / ownAvg * 100)
        : null;
      const gapLabel = gapRaw != null
        ? `<span class="gap-pill ${gapRaw > 0 ? 'positive' : 'negative'}">${gapRaw > 0 ? '+' : ''}${gapRaw.toFixed(1)}%</span>`
        : (bs.isOwn ? '<span class="gap-pill neutral">REF</span>' : '—');

      // Truncate product names
      const desc = bs.products.length > 80 ? bs.products.slice(0, 77) + '…' : bs.products;
      return `<tr class="${bs.isOwn ? 'gap-row-own' : ''}">
        <td><span class="brand-pill ${bs.isOwn ? 'own' : 'comp'}">${bs.brand}</span></td>
        <td style="font-size:.8rem;color:var(--text-muted);max-width:220px;white-space:normal">${desc}</td>
        <td class="price-cell">${fmt(bs.minP)}</td>
        <td class="price-cell">${fmt(bs.maxP)}</td>
        <td class="price-cell">${fmt(bs.avgP)}</td>
        <td>${gapLabel}</td>
        <td style="font-size:.78rem;color:var(--text-muted)">${bs.supers}</td>
      </tr>`;
    }).join('');

    const dotClass = catDotClass(cat);
    html += `
      <div class="cat-section">
        <div class="cat-header">
          <div class="cat-dot ${dotClass}"></div>
          <div class="cat-title">${cat}</div>
          <div class="cat-count">${catItems.length} productos · ${byBrand.size} marcas</div>
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Marca</th>
                <th>Descripción</th>
                <th>Precio Mín</th>
                <th>Precio Máx</th>
                <th>Precio Prom</th>
                <th>GAP vs RGM</th>
                <th>Supermercados</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  container.innerHTML = html || emptyStateHtml('Sin categorías', 'Selecciona al menos una categoría.');
}

// ═══════════════════════════════════════════════════════════════════════
// VIEW 3 — POR SUPERMERCADO
// ═══════════════════════════════════════════════════════════════════════
function renderSupermercados(container) {
  const items = filteredItems();
  if (items.length === 0) {
    container.innerHTML = emptyStateHtml('Sin datos', 'No hay productos. Actualice los precios o amplíe los filtros.');
    return;
  }

  const bySuper = groupBy(items, 'super');
  let html = '';

  for (const [superName, superItems] of bySuper) {
    const bycat = groupBy(superItems, 'category');
    let catSections = '';

    for (const [cat, catItems] of bycat) {
      if (!state.filters.categorias.has(cat)) continue;
      const sorted = [...catItems].sort((a, b) => (a.price ?? 9999) - (b.price ?? 9999));
      const rows = sorted.map(item => {
        const disc = item.listPrice && item.listPrice > item.price
          ? `<span class="gap-pill positive">-${Math.round((1 - item.price / item.listPrice) * 100)}%</span>`
          : '';
        return `<tr>
          <td><span class="brand-pill ${item.isOwn ? 'own' : 'comp'}">${item.brand}</span></td>
          <td style="max-width:240px;white-space:normal;font-size:.82rem">${item.name}</td>
          <td class="price-cell">${fmt(item.price)}</td>
          <td><span class="price-list">${item.listPrice && item.listPrice !== item.price ? fmt(item.listPrice) : ''}</span> ${disc}</td>
          <td><a href="${item.url || '#'}" target="_blank" rel="noopener" style="color:var(--accent1);font-size:.78rem">${item.url ? '↗ Ver' : ''}</a></td>
        </tr>`;
      }).join('');

      const dotClass = catDotClass(cat);
      catSections += `
        <div style="margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-weight:600;font-size:.85rem">
            <div class="cat-dot ${dotClass}"></div>${cat}
            <span style="margin-left:auto;font-weight:400;font-size:.78rem;color:var(--text-muted)">${catItems.length} productos</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Marca</th><th>Producto</th><th>Precio</th><th>Precio lista</th><th></th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    }

    html += `
      <div class="card" style="margin-bottom:24px">
        <div class="card-title">
          <span class="super-badge ${superClass(superName)}">${superName}</span>
          ${superItems.length} productos
        </div>
        ${catSections}
      </div>`;
  }

  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════════
// VIEW 4 — GAP DE PRECIOS
// ═══════════════════════════════════════════════════════════════════════
function renderGap(container) {
  const items = filteredItems();
  if (items.length === 0) {
    container.innerHTML = emptyStateHtml('Sin datos', 'No hay productos. Actualice los precios o amplíe los filtros.');
    return;
  }

  const categories = ['Pan de Molde', 'Pan de Tortuga', 'Pan de Viena']
    .filter(c => state.filters.categorias.has(c) && items.some(i => i.category === c));

  let html = `
    <div class="card" style="margin-bottom:20px">
      <div class="card-title">Análisis de GAP de Precios</div>
      <p style="font-size:.85rem;color:var(--text-muted);margin-top:-8px">
        GAP positivo (verde) = competidor más caro que RGM. GAP negativo (rojo) = competidor más económico.
        El precio de referencia RGM es el promedio de todos los productos propios en esa categoría.
      </p>
    </div>`;

  for (const cat of categories) {
    const catItems = items.filter(i => i.category === cat);
    const ownItems = catItems.filter(i => i.isOwn);
    const ownPrices = ownItems.map(i => i.price).filter(p => p != null);
    const refPrice = avg(ownPrices);

    // Group all by brand
    const byBrand = groupBy(catItems, 'brand');
    const rows = [...byBrand.entries()].map(([brand, bi]) => {
      const isOwn = bi[0].isOwn;
      const prices = bi.filter(i => i.price != null).map(i => i.price);
      const avgP = avg(prices);
      const minP = prices.length ? Math.min(...prices) : null;
      const maxP = prices.length ? Math.max(...prices) : null;

      let gapCell = '—';
      if (isOwn) {
        gapCell = `<span class="gap-pill neutral">REFERENCIA RGM: ${fmt(avgP)}</span>`;
      } else if (refPrice != null && avgP != null) {
        const g = ((avgP - refPrice) / refPrice * 100);
        const label = (g > 0 ? '+' : '') + g.toFixed(1) + '%';
        gapCell = `<span class="gap-pill ${g > 0 ? 'positive' : 'negative'}">${label}</span>`;
      }

      // Per-super prices
      const superCells = ['Disco', 'TaTa', 'Tienda Inglesa', 'El Dorado'].map(s => {
        const si = bi.filter(i => i.super === s && i.price != null);
        const sp = si.length ? avg(si.map(i => i.price)) : null;
        return `<td class="price-cell" style="font-size:.82rem">${sp != null ? fmt(sp) : '—'}</td>`;
      }).join('');

      return `<tr class="${isOwn ? 'gap-row-own' : ''}">
        <td><span class="brand-pill ${isOwn ? 'own' : 'comp'}">${brand}</span></td>
        <td class="price-cell">${fmt(minP)}</td>
        <td class="price-cell">${fmt(maxP)}</td>
        <td class="price-cell">${fmt(avgP)}</td>
        ${superCells}
        <td>${gapCell}</td>
      </tr>`;
    }).sort((a, b) => {
      // Own rows first
      const aOwn = a.includes('gap-row-own');
      const bOwn = b.includes('gap-row-own');
      return aOwn === bOwn ? 0 : aOwn ? -1 : 1;
    }).join('');

    const dotClass = catDotClass(cat);
    html += `
      <div class="cat-section">
        <div class="cat-header">
          <div class="cat-dot ${dotClass}"></div>
          <div class="cat-title">${cat}</div>
          <div class="cat-count">${refPrice != null ? 'Precio ref. RGM: ' + fmt(refPrice) : 'Sin precio propio'}</div>
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Marca</th>
                <th>Precio Mín</th>
                <th>Precio Máx</th>
                <th>Prom</th>
                <th>Disco</th>
                <th>TaTa</th>
                <th>T. Inglesa</th>
                <th>El Dorado</th>
                <th>GAP vs RGM</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════════
// VIEW 5 — OFERTAS
// ═══════════════════════════════════════════════════════════════════════
function renderOfertas(container) {
  const items = filteredItems();
  const discounted = items
    .filter(i => i.listPrice != null && i.price != null && i.listPrice > i.price)
    .map(i => ({
      ...i,
      discountPct: Math.round((1 - i.price / i.listPrice) * 100),
      saving: i.listPrice - i.price,
    }))
    .sort((a, b) => b.discountPct - a.discountPct);

  const totalSaving = avg(discounted.map(d => d.discountPct));

  const kpiHtml = `
    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi-card teal">
        <div class="kpi-label">Productos en oferta</div>
        <div class="kpi-value">${discounted.length}</div>
        <div class="kpi-sub">de ${items.length} monitoreados</div>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-label">Descuento promedio</div>
        <div class="kpi-value">${totalSaving != null ? totalSaving.toFixed(1) + '%' : '—'}</div>
        <div class="kpi-sub">sobre precio de lista</div>
      </div>
      <div class="kpi-card orange">
        <div class="kpi-label">Mayor descuento</div>
        <div class="kpi-value">${discounted.length ? discounted[0].discountPct + '%' : '—'}</div>
        <div class="kpi-sub">${discounted.length ? discounted[0].name.slice(0, 30) + '…' : ''}</div>
      </div>
    </div>`;

  if (!discounted.length) {
    container.innerHTML = kpiHtml + emptyStateHtml(
      'Sin ofertas detectadas',
      'No se detectaron productos con precio de lista mayor al precio actual. Actualice los datos para obtener los últimos precios.'
    );
    return;
  }

  const rows = discounted.map(item => {
    const barW = Math.min(item.discountPct, 100);
    return `<tr>
      <td><span class="brand-pill ${item.isOwn ? 'own' : 'comp'}">${item.brand}</span></td>
      <td style="max-width:240px;white-space:normal;font-size:.82rem">${item.name}</td>
      <td><span class="super-badge ${superClass(item.super)}">${item.super}</span></td>
      <td style="font-size:.78rem;color:var(--text-muted)">${item.category}</td>
      <td class="price-cell">${fmt(item.price)}</td>
      <td><span class="price-list">${fmt(item.listPrice)}</span></td>
      <td><span class="gap-pill positive">-${item.discountPct}%</span></td>
      <td>
        <div class="discount-bar-wrap">
          <div class="discount-bar"><div class="discount-bar-fill" style="width:${barW}%"></div></div>
        </div>
      </td>
      <td><a href="${item.url || '#'}" target="_blank" rel="noopener" style="color:var(--accent1);font-size:.78rem">${item.url ? '↗ Ver' : ''}</a></td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    ${kpiHtml}
    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border)">
        <div class="card-title" style="margin-bottom:0">
          <svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          Productos en oferta (precio < lista)
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Marca</th><th>Producto</th><th>Supermercado</th><th>Categoría</th>
            <th>Precio</th><th>Lista</th><th>Dcto.</th><th>%</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Helper: empty state HTML ───────────────────────────────────────────
function emptyStateHtml(title, msg) {
  return `<div class="empty-state">
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <h3>${title}</h3>
    <p>${msg}</p>
    <button class="btn-refresh" onclick="document.getElementById('btnRefresh').click()">
      <svg class="refresh-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
      Actualizar Precios
    </button>
  </div>`;
}

// ── Navigation ─────────────────────────────────────────────────────────
const VIEW_TITLES = {
  resumen: 'Resumen',
  categorias: 'Por Categoría',
  supermercados: 'Por Supermercado',
  gap: 'GAP de Precios',
  ofertas: 'Ofertas',
};

function setView(view) {
  state.currentView = view;
  document.getElementById('viewTitle').textContent = VIEW_TITLES[view] || view;
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.view === view);
  });
  render();
}

// ── Filter dropdowns ───────────────────────────────────────────────────
function initFilters() {
  // Toggle menus
  ['btnCategorias', 'btnSupers'].forEach(btnId => {
    const btn = document.getElementById(btnId);
    const menuId = btnId === 'btnCategorias' ? 'menuCategorias' : 'menuSupers';
    const menu = document.getElementById(menuId);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('open');
    });
  });

  // Close on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.filter-menu.open').forEach(m => m.classList.remove('open'));
  });

  // Category checkboxes
  document.querySelectorAll('#menuCategorias input').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.filters.categorias.add(cb.value);
      else state.filters.categorias.delete(cb.value);
      updateFilterLabels();
      render();
    });
  });

  // Super checkboxes
  document.querySelectorAll('#menuSupers input').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.filters.supers.add(cb.value);
      else state.filters.supers.delete(cb.value);
      updateFilterLabels();
      render();
    });
  });
}

// ── Sidebar toggle (mobile) ────────────────────────────────────────────
function initSidebar() {
  const toggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  toggle?.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.querySelector('.main-wrapper')?.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) sidebar.classList.remove('open');
  });
}

// ── Refresh button ─────────────────────────────────────────────────────
async function doRefresh() {
  const btn = document.getElementById('btnRefresh');
  btn.disabled = true;
  btn.classList.add('spinning');
  toast('Actualizando precios en los 4 supermercados…', 'info', 60000);

  try {
    const res = await fetch('/api/refresh', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    state.raw = data;
    updateLastUpdate();
    // Remove old toasts
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const count = data.items?.length ?? 0;
    toast(`✓ ${count} productos actualizados`, 'success');
    render();
  } catch (e) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    toast(`Error: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('spinning');
  }
}

function updateLastUpdate() {
  const el = document.getElementById('lastUpdate');
  if (el) el.textContent = state.raw.generatedAt
    ? 'Actualizado: ' + formatDate(state.raw.generatedAt)
    : 'Sin datos';
}

// ── Load data on startup ───────────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch('/api/data');
    const data = await res.json();
    state.raw = data;
    updateLastUpdate();
    render();
  } catch (e) {
    state.raw = { generatedAt: null, items: [], scrapeResults: [] };
    render();
    toast('No se pudo cargar datos: ' + e.message, 'error');
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initFilters();
  initSidebar();

  // Nav links
  document.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      setView(a.dataset.view);
      // close mobile sidebar
      document.getElementById('sidebar').classList.remove('open');
    });
  });

  // Refresh button
  document.getElementById('btnRefresh').addEventListener('click', doRefresh);

  // Load data
  await loadData();
});
