// RigorAtlas — Apresentação Interativa em Tempo Real (OpenAlex + Crossref + ORCID)
// Regra ética estrita: NUNCA associar nomes pessoais de pesquisadores a quantitativos de publicação.

const MAILTO = 'mdqmichael@gmail.com';
const OPENALEX_BASE = 'https://api.openalex.org/works';
const CROSSREF_BASE = 'https://api.crossref.org/works';
const ORCID_SEARCH_BASE = 'https://pub.orcid.org/v3.0/expanded-search/';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({length: 5}, (_, i) => CURRENT_YEAR - 4 + i);

const RESEARCH_LINES = [
  {
    id: 'all',
    short: 'Todas as linhas',
    name: 'Panorama Integrado — Agroenergia Digital & Biocombustíveis',
    query: 'bioenergy OR biofuel OR biomass OR "digital agriculture" OR agroenergy',
    crossrefQuery: 'bioenergy biofuel biomass digital agriculture',
    color: '#15803d',
    desc: 'Visão consolidada das produções científicas internacionais nos eixos de bioenergia, biocombustíveis, sustentabilidade e agricultura digital.'
  },
  {
    id: 'sustentabilidade',
    short: 'Sustentabilidade & Sistemas',
    name: 'Linha I — Sustentabilidade de Arranjos Produtivos e Sistemas Agroenergéticos',
    query: '(bioenergy OR agroenergy OR biomass) AND (sustainability OR "life cycle" OR carbon OR bioeconomy)',
    crossrefQuery: 'bioenergy sustainability life cycle carbon bioeconomy',
    color: '#15803d',
    desc: 'Bioeconomia, balanço de carbono, culturas energéticas, manejo sustentável do solo e avaliação de ciclo de vida.'
  },
  {
    id: 'bioprocessos',
    short: 'Bioprocessos & Biocombustíveis',
    name: 'Linha II — Bioprocessos para Obtenção de Biocombustíveis',
    query: '(biofuel OR bioethanol OR biodiesel OR biogas) AND (fermentation OR pyrolysis OR lignocellulosic OR biomass)',
    crossrefQuery: 'biofuel bioethanol biodiesel biogas fermentation pyrolysis biomass',
    color: '#0e7490',
    desc: 'Etanol 1G/2G, biodiesel, biogás, pirólise, hidrólise enzimática, fermentação e conversão termoquímica de biomassa.'
  },
  {
    id: 'digital',
    short: 'Tecnologia & Agroenergia Digital',
    name: 'Linha III — Tecnologia e Inovação em Agroenergia Digital',
    query: '("digital agriculture" OR "precision agriculture" OR "smart farming") AND ("machine learning" OR IoT OR "remote sensing" OR biomass OR bioenergy)',
    crossrefQuery: 'digital agriculture precision agriculture machine learning remote sensing bioenergy',
    color: '#b45309',
    desc: 'Agricultura digital, inteligência artificial, sensores IoT, sensoriamento remoto por drones/satélites e otimização energética.'
  }
];

// Diretório de pesquisadores — ESTRITAMENTE SEM QUANTITATIVOS INDIVIDUAIS
const RESEARCHERS = [
  {name: 'Ary Henrique Morais de Oliveira', line: 'Tecnologia e Inovação em Agroenergia Digital', lattes: ''},
  {name: 'Aurélio Vaz de Melo', line: 'Sustentabilidade e Sistemas Agroenergéticos', lattes: ''},
  {name: 'Carlos Juliano Brant Albuquerque', line: 'Sustentabilidade e Sistemas Agroenergéticos', lattes: ''},
  {name: 'David Gabriel de Barros Franco', line: 'Tecnologia e Inovação em Agroenergia Digital', lattes: ''},
  {name: 'Eduardo Andrea Lemus Erasmo', line: 'Sustentabilidade e Sistemas Agroenergéticos', lattes: ''},
  {name: 'Elainy Cristina Alves Martins Oliveira', line: 'Bioprocessos para Biocombustíveis', lattes: ''},
  {name: 'Emerson Adriano Guarda', line: 'Bioprocessos para Biocombustíveis', lattes: ''},
  {name: 'Erich Collicchio', line: 'Sustentabilidade e Sistemas Agroenergéticos', lattes: ''},
  {name: 'Flavia Lucila Tonani de Siqueira', line: 'Sustentabilidade e Sistemas Agroenergéticos', lattes: ''},
  {name: 'Guilherme Benko de Siqueira', line: 'Sustentabilidade e Sistemas Agroenergéticos', lattes: ''},
  {name: 'Horllys Gomes Barreto', line: 'Bioprocessos para Biocombustíveis', lattes: ''},
  {name: 'Joel Carlos Zukowski Júnior', line: 'Tecnologia e Inovação em Agroenergia Digital', lattes: ''},
  {name: 'Juliana Lobo Paes', line: 'Bioprocessos para Biocombustíveis', lattes: ''},
  {name: 'Lina Maria Grajales Agudelo', line: 'Bioprocessos para Biocombustíveis', lattes: ''},
  {name: 'Marcelo Mendes Pedroza', line: 'Bioprocessos para Biocombustíveis', lattes: ''},
  {name: 'Michele Ribeiro Ramos', line: 'Sustentabilidade e Sistemas Agroenergéticos', lattes: ''},
  {name: 'Solange Aparecida Ságio', line: 'Bioprocessos para Biocombustíveis', lattes: 'http://lattes.cnpq.br/0161811409436310'},
  {name: 'Valci Ferreira Victor', line: 'Tecnologia e Inovação em Agroenergia Digital', lattes: ''}
];

const SLIDE_IDS = ['sec-visao-geral', 'sec-semestres', 'sec-linhas', 'sec-pesquisadores'];

const state = {
  lineId: 'all',
  granularity: 'semester', // 'semester' | 'year'
  yearFilter: 'all',       // 'all' | '2022' ...
  slideMode: false,
  slideIdx: 0,
  facultyQuery: '',
  cache: new Map(),
  lineTotals: null,
  orcidResolved: new Map()
};

const $ = id => document.getElementById(id);
const fmt = n => typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('pt-BR') : '—';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

function initials(name) {
  const parts = name.trim().split(/\s+/).filter(p => p.length > 2 && !/^(da|de|do|dos|das)$/i.test(p));
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase();
}

function getLine(id) {
  return RESEARCH_LINES.find(l => l.id === id) || RESEARCH_LINES[0];
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJson(url, headers = {}, timeoutMs = 12000, retries = 3) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {headers, signal: controller.signal});
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        clearTimeout(timer);
        await sleep(350 * (attempt + 1) + Math.floor(Math.random() * 180));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(300 * (attempt + 1));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error('Falha na consulta HTTP');
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIdx = 0;
  async function runner() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, runner));
  return results;
}

async function openAlexCount(query, extraFilter = '') {
  const filter = [extraFilter].filter(Boolean).join(',');
  const params = new URLSearchParams({
    search: query,
    'per-page': '1',
    mailto: MAILTO
  });
  if (filter) params.set('filter', filter);
  const data = await fetchJson(`${OPENALEX_BASE}?${params.toString()}`);
  return Number(data?.meta?.count || 0);
}

async function openAlexYearGroups(query, startDate, endDate) {
  const params = new URLSearchParams({
    search: query,
    filter: `from_publication_date:${startDate},to_publication_date:${endDate}`,
    group_by: 'publication_year',
    mailto: MAILTO
  });
  const data = await fetchJson(`${OPENALEX_BASE}?${params.toString()}`);
  const map = new Map();
  for (const g of (data?.group_by || [])) {
    map.set(Number(g.key), Number(g.count || 0));
  }
  return {
    total: Number(data?.meta?.count || 0),
    byYear: map
  };
}

async function crossrefYearFacets(query, startDate, endDate) {
  const params = new URLSearchParams({
    query,
    filter: `from-pub-date:${startDate},until-pub-date:${endDate}`,
    rows: '0',
    facet: 'published:10',
    mailto: MAILTO
  });
  const data = await fetchJson(`${CROSSREF_BASE}?${params.toString()}`);
  const values = data?.message?.facets?.published?.values || {};
  const map = new Map();
  for (const [k, v] of Object.entries(values)) {
    map.set(Number(k), Number(v || 0));
  }
  return {
    total: Number(data?.message?.['total-results'] || 0),
    byYear: map
  };
}

async function fetchRecentWorks(line) {
  const fromYear = YEARS[0];
  const oaParams = new URLSearchParams({
    search: line.query,
    filter: `from_publication_date:${fromYear}-01-01,type:article`,
    sort: 'publication_date:desc',
    'per-page': '8',
    mailto: MAILTO
  });
  const crParams = new URLSearchParams({
    query: line.crossrefQuery,
    filter: `from-pub-date:${fromYear}-01-01,type:journal-article`,
    sort: 'published',
    order: 'desc',
    rows: '6',
    mailto: MAILTO
  });

  const [oaRes, crRes] = await Promise.allSettled([
    fetchJson(`${OPENALEX_BASE}?${oaParams.toString()}`),
    fetchJson(`${CROSSREF_BASE}?${crParams.toString()}`)
  ]);

  const seen = new Set();
  const items = [];

  if (oaRes.status === 'fulfilled' && Array.isArray(oaRes.value?.results)) {
    for (const w of oaRes.value.results) {
      const doi = (w.doi || '').replace(/^https?:\/\/doi\.org\//i, '').toLowerCase();
      const key = doi || (w.title || '').toLowerCase().slice(0, 60);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const dateStr = w.publication_date || String(w.publication_year || '');
      const month = Number(dateStr.split('-')[1] || 1);
      items.push({
        title: w.display_name || w.title || 'Artigo científico',
        journal: w.primary_location?.source?.display_name || 'Periódico indexado',
        year: w.publication_year || Number(dateStr.slice(0, 4)) || CURRENT_YEAR,
        semester: month <= 6 ? 'S1' : 'S2',
        oa: Boolean(w.open_access?.is_oa),
        url: w.doi || w.primary_location?.landing_page_url || w.id || '#',
        source: 'OpenAlex'
      });
    }
  }

  if (crRes.status === 'fulfilled' && Array.isArray(crRes.value?.message?.items)) {
    for (const w of crRes.value.message.items) {
      const doi = (w.DOI || '').toLowerCase();
      const title = Array.isArray(w.title) ? w.title[0] : (w.title || '');
      const key = doi || title.toLowerCase().slice(0, 60);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const dp = w.issued?.['date-parts']?.[0] || w.published?.['date-parts']?.[0] || [CURRENT_YEAR, 1];
      items.push({
        title: title || 'Publicação registrada no Crossref',
        journal: (Array.isArray(w['container-title']) ? w['container-title'][0] : w['container-title']) || 'Periódico científico',
        year: Number(dp[0] || CURRENT_YEAR),
        semester: Number(dp[1] || 1) <= 6 ? 'S1' : 'S2',
        oa: false,
        url: doi ? `https://doi.org/${doi}` : (w.URL || '#'),
        source: 'Crossref'
      });
    }
  }

  return items.slice(0, 8);
}

async function fetchLineAnalytics(lineId) {
  if (state.cache.has(lineId)) return state.cache.get(lineId);
  const line = getLine(lineId);
  const startDate = `${YEARS[0]}-01-01`;
  const endDate = `${YEARS[YEARS.length - 1]}-12-31`;

  // Etapa 1: 1 chamada OpenAlex group_by=publication_year + 1 chamada Crossref facet=published + OA + recentes (sem estourar rate limit)
  const [oaGroups, crFacets, oaOpenCount, recentWorks] = await Promise.all([
    openAlexYearGroups(line.query, startDate, endDate).catch(() => ({total: 0, byYear: new Map()})),
    crossrefYearFacets(line.crossrefQuery, startDate, endDate).catch(() => ({total: 0, byYear: new Map()})),
    openAlexCount(line.query, `from_publication_date:${startDate},to_publication_date:${endDate},is_oa:true`).catch(() => 0),
    fetchRecentWorks(line).catch(() => [])
  ]);

  // Etapa 2: consultar S1 (Jan-Jun) de cada ano com concorrência controlada (2 por vez) e derivar S2 = TotalAno - S1
  const s1List = await mapWithConcurrency(YEARS, 2, async year => {
    const s1 = await openAlexCount(line.query, `from_publication_date:${year}-01-01,to_publication_date:${year}-06-30`).catch(() => 0);
    return {year, s1};
  });
  const s1Map = new Map(s1List.map(x => [x.year, x.s1]));

  const semesters = [];
  const yearly = YEARS.map(year => {
    const yearTotal = oaGroups.byYear.get(year) || 0;
    const s1 = Math.min(s1Map.get(year) || 0, yearTotal || (s1Map.get(year) || 0));
    const s2 = Math.max(0, yearTotal - s1);
    semesters.push({year, sem: 'S1', label: `${year}·S1`, oaCount: s1});
    semesters.push({year, sem: 'S2', label: `${year}·S2`, oaCount: s2});
    return {year, s1, s2, oaTotal: yearTotal || (s1 + s2), crTotal: crFacets.byYear.get(year) || 0};
  });

  const computedTotal = oaGroups.total || yearly.reduce((acc, y) => acc + y.oaTotal, 0);
  const crTotal5y = crFacets.total || yearly.reduce((acc, y) => acc + y.crTotal, 0);
  const oaPct = computedTotal > 0 ? Math.round((oaOpenCount / computedTotal) * 100) : 0;

  const result = {
    line,
    semesters,
    yearly,
    total5y: computedTotal,
    crTotal5y,
    oaPct,
    recentWorks,
    updatedAt: new Date()
  };
  state.cache.set(lineId, result);
  return result;
}

async function fetchAllLineTotals() {
  if (state.lineTotals) return state.lineTotals;
  const startDate = `${YEARS[0]}-01-01`;
  const endDate = `${YEARS[YEARS.length - 1]}-12-31`;
  const lines = RESEARCH_LINES.filter(l => l.id !== 'all');
  const results = await mapWithConcurrency(lines, 2, async l => {
    const count = await openAlexCount(l.query, `from_publication_date:${startDate},to_publication_date:${endDate}`).catch(() => 0);
    return {...l, count};
  });
  state.lineTotals = results;
  return results;
}

// --- Renderização de Sparklines & Gráficos SVG Interativos ---

function renderSparkline(svgEl, values, strokeColor, fillId) {
  if (!svgEl || !values.length) return;
  const w = 240, h = 48, pad = 4;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2 - 4);
    return [x, y];
  });
  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaD = `${lineD} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svgEl.innerHTML = `
    <defs>
      <linearGradient id="${fillId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.34"/>
        <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <path d="${areaD}" fill="url(#${fillId})"/>
    <path d="${lineD}" fill="none" stroke="${strokeColor}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  `;
}

function showTooltip(evt, html) {
  const tip = $('chart-tooltip');
  if (!tip) return;
  tip.innerHTML = html;
  tip.style.left = `${evt.clientX}px`;
  tip.style.top = `${evt.clientY}px`;
  tip.classList.add('visible');
}
function hideTooltip() {
  $('chart-tooltip')?.classList.remove('visible');
}

function renderMainEvolutionChart(analytics) {
  const wrap = $('main-evolution-chart');
  if (!wrap) return;
  const isSem = state.granularity === 'semester';
  let series = isSem
    ? analytics.semesters.map(s => ({
        label: s.label,
        year: s.year,
        sem: s.sem,
        value: s.oaCount,
        color: s.sem === 'S1' ? '#0e7490' : '#15803d',
        sub: `OpenAlex · ${s.sem === 'S1' ? '1º Semestre (Jan–Jun)' : '2º Semestre (Jul–Dez)'}`
      }))
    : analytics.yearly.map(y => ({
        label: String(y.year),
        year: y.year,
        value: y.oaTotal,
        crValue: y.crTotal,
        color: '#15803d',
        sub: `Crossref: ${fmt(y.crTotal)} registros`
      }));

  if (state.yearFilter !== 'all') {
    const yr = Number(state.yearFilter);
    series = series.filter(d => d.year === yr);
  }

  const W = 820, H = 290;
  const m = {top: 28, right: 24, bottom: 44, left: 68};
  const cw = W - m.left - m.right;
  const ch = H - m.top - m.bottom;
  const maxVal = Math.max(...series.map(d => d.value), 10);
  const niceMax = Math.ceil(maxVal / 10) * 10 || 10;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const y = m.top + ch * (1 - f);
    const val = Math.round(niceMax * f);
    return `<line x1="${m.left}" y1="${y}" x2="${W - m.right}" y2="${y}" stroke="rgba(20,83,60,.12)" stroke-dasharray="3 3"/>
            <text x="${m.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#425b50">${fmt(val)}</text>`;
  }).join('');

  const step = cw / Math.max(series.length, 1);
  const barW = Math.min(54, step * 0.62);

  const linePts = [];
  const bars = series.map((d, i) => {
    const cx = m.left + step * i + step / 2;
    const bh = (d.value / niceMax) * ch;
    const x = cx - barW / 2;
    const y = m.top + ch - bh;
    linePts.push([cx, y]);
    const prev = i > 0 ? series[i - 1].value : null;
    const pct = prev && prev > 0 ? (((d.value - prev) / prev) * 100).toFixed(1) : null;
    const tipText = `<strong>${esc(d.label)}</strong>OpenAlex: <b>${fmt(d.value)}</b> publicações<br>${esc(d.sub)}${pct !== null ? `<br>Variação: <b>${Number(pct) >= 0 ? '+' : ''}${pct}%</b>` : ''}`;
    return `
      <g class="chart-bar-group" data-tip="${esc(tipText)}" style="cursor:pointer">
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(bh, 2).toFixed(1)}" rx="6" fill="${d.color}" opacity="0.9"/>
        <text x="${cx.toFixed(1)}" y="${Math.max(y - 7, 14).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0f241c">${fmt(d.value)}</text>
        <text x="${cx.toFixed(1)}" y="${H - 16}" text-anchor="middle" font-size="11" font-weight="600" fill="#425b50">${esc(d.label)}</text>
      </g>`;
  }).join('');

  const trendD = linePts.length > 1
    ? linePts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    : '';
  const trendDots = linePts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="#ffffff" stroke="#b45309" stroke-width="2.2"/>`).join('');

  wrap.innerHTML = `
    <svg class="pres-svg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico interativo da evolução de publicações científicas nos últimos 5 anos">
      ${gridLines}
      ${bars}
      ${trendD ? `<path d="${trendD}" fill="none" stroke="#b45309" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>${trendDots}` : ''}
    </svg>`;

  wrap.querySelectorAll('[data-tip]').forEach(g => {
    g.addEventListener('mousemove', e => showTooltip(e, g.getAttribute('data-tip')));
    g.addEventListener('mouseleave', hideTooltip);
  });
}

function renderWaterfallChart(analytics) {
  const wrap = $('waterfall-chart');
  if (!wrap) return;
  const sems = analytics.semesters.filter(s => s.oaCount > 0);
  if (sems.length < 2) {
    wrap.innerHTML = '<p class="glass-card-sub">Aguardando série semestral para calcular variações.</p>';
    return;
  }
  const deltas = [];
  for (let i = 1; i < sems.length; i++) {
    const diff = sems[i].oaCount - sems[i - 1].oaCount;
    const pct = sems[i - 1].oaCount > 0 ? ((diff / sems[i - 1].oaCount) * 100).toFixed(1) : '0.0';
    deltas.push({label: sems[i].label, diff, pct, current: sems[i].oaCount});
  }

  const W = 760, H = 230;
  const m = {top: 26, right: 18, bottom: 38, left: 58};
  const cw = W - m.left - m.right;
  const ch = H - m.top - m.bottom;
  const maxAbs = Math.max(...deltas.map(d => Math.abs(d.diff)), 10);
  const midY = m.top + ch / 2;

  const step = cw / deltas.length;
  const bw = Math.min(46, step * 0.62);

  const items = deltas.map((d, i) => {
    const cx = m.left + step * i + step / 2;
    const bh = (Math.abs(d.diff) / maxAbs) * (ch / 2 - 12);
    const up = d.diff >= 0;
    const y = up ? midY - bh : midY;
    const fill = up ? '#15803d' : '#dc2626';
    const labelY = up ? y - 6 : y + bh + 12;
    const sign = up ? '+' : '';
    const tip = `<strong>${esc(d.label)}</strong>Variação vs semestre anterior: <b>${sign}${fmt(d.diff)}</b> (${sign}${d.pct}%)<br>Total no semestre: <b>${fmt(d.current)}</b>`;
    return `
      <g data-tip="${esc(tip)}" style="cursor:pointer">
        <rect x="${(cx - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(bh, 3).toFixed(1)}" rx="5" fill="${fill}" opacity="0.88"/>
        <text x="${cx.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="${fill}">${sign}${d.pct}%</text>
        <text x="${cx.toFixed(1)}" y="${H - 12}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#425b50">${esc(d.label)}</text>
      </g>`;
  }).join('');

  wrap.innerHTML = `
    <svg class="pres-svg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico cascata de variação semestral">
      <line x1="${m.left}" y1="${midY}" x2="${W - m.right}" y2="${midY}" stroke="#425b50" stroke-width="1.2"/>
      <text x="${m.left - 8}" y="${midY + 4}" text-anchor="end" font-size="10.5" fill="#425b50">0</text>
      ${items}
    </svg>`;

  wrap.querySelectorAll('[data-tip]').forEach(g => {
    g.addEventListener('mousemove', e => showTooltip(e, g.getAttribute('data-tip')));
    g.addEventListener('mouseleave', hideTooltip);
  });
}

function renderSemesterMatrix(analytics) {
  const body = $('semester-matrix-body');
  if (!body) return;
  let totalS1 = 0, totalS2 = 0, totalOA = 0, totalCR = 0;
  const rows = analytics.yearly.map((y, idx) => {
    totalS1 += y.s1; totalS2 += y.s2; totalOA += y.oaTotal; totalCR += y.crTotal;
    const prev = idx > 0 ? analytics.yearly[idx - 1].oaTotal : null;
    const delta = prev && prev > 0 ? (((y.oaTotal - prev) / prev) * 100) : null;
    const deltaHtml = delta === null
      ? '<span class="delta-flat">Base</span>'
      : delta >= 0
        ? `<span class="delta-up">▲ +${delta.toFixed(1)}%</span>`
        : `<span class="delta-down">▼ ${delta.toFixed(1)}%</span>`;
    return `<tr>
      <td>${y.year}</td>
      <td>${fmt(y.s1)}</td>
      <td>${fmt(y.s2)}</td>
      <td><strong>${fmt(y.oaTotal)}</strong></td>
      <td>${fmt(y.crTotal)}</td>
      <td>${deltaHtml}</td>
    </tr>`;
  }).join('');

  body.innerHTML = rows + `<tr>
    <td>Total (${YEARS[0]}–${YEARS[YEARS.length - 1]})</td>
    <td>${fmt(totalS1)}</td>
    <td>${fmt(totalS2)}</td>
    <td>${fmt(totalOA)}</td>
    <td>${fmt(totalCR)}</td>
    <td><span class="delta-up">5 anos</span></td>
  </tr>`;
}

function renderResearchLines(lineTotals) {
  const wrap = $('research-lines-bars');
  if (!wrap || !lineTotals) return;
  const max = Math.max(...lineTotals.map(l => l.count), 1);
  wrap.innerHTML = lineTotals.map(l => {
    const pct = Math.max(8, Math.round((l.count / max) * 100));
    const selected = state.lineId === l.id ? ' selected' : '';
    return `
      <div class="line-bar-item${selected}" data-select-line="${esc(l.id)}" role="button" tabindex="0">
        <div class="line-bar-head">
          <span class="line-bar-title">${esc(l.name)}</span>
          <span class="line-bar-count">${fmt(l.count)} obras (5 anos)</span>
        </div>
        <div class="line-bar-track"><div class="line-bar-fill" style="width:${pct}%;background:${l.color}"></div></div>
        <p class="line-bar-desc">${esc(l.desc)}</p>
      </div>`;
  }).join('');

  wrap.querySelectorAll('[data-select-line]').forEach(el => {
    const activate = () => {
      const id = el.getAttribute('data-select-line');
      state.lineId = state.lineId === id ? 'all' : id;
      $('filter-line').value = state.lineId;
      refreshDashboard();
    };
    el.addEventListener('click', activate);
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });
}

function renderRecentWorks(works) {
  const wrap = $('live-works-list');
  if (!wrap) return;
  if (!works || !works.length) {
    wrap.innerHTML = '<p class="glass-card-sub">Nenhuma publicação recente retornada neste momento. Clique em “Atualizar ao vivo” para nova consulta.</p>';
    return;
  }
  wrap.innerHTML = works.map(w => `
    <article class="live-work-item">
      <a class="live-work-title" href="${esc(w.url)}" target="_blank" rel="noopener noreferrer">${esc(w.title)} ↗</a>
      <div class="live-work-meta">
        <span><strong>${esc(w.journal)}</strong></span>
        <span>${esc(w.year)} · ${esc(w.semester)}</span>
        <span>Fonte: ${esc(w.source)}</span>
        ${w.oa ? '<span class="oa-pill">Acesso Aberto</span>' : ''}
      </div>
    </article>`).join('');
}

function renderKpis(analytics) {
  $('kpi-total-value').textContent = fmt(analytics.total5y);
  $('kpi-total-meta').textContent = `OpenAlex (${YEARS[0]}–${YEARS[YEARS.length - 1]})`;
  const lastTwo = analytics.yearly.filter(y => y.oaTotal > 0);
  if (lastTwo.length >= 2) {
    const curr = lastTwo[lastTwo.length - 2]; // último ano completo
    const prev = lastTwo[lastTwo.length - 3] || lastTwo[0];
    const growth = prev.oaTotal > 0 ? (((curr.oaTotal - prev.oaTotal) / prev.oaTotal) * 100) : 0;
    $('kpi-total-badge').textContent = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% (${curr.year})`;
  }

  $('kpi-crossref-value').textContent = fmt(analytics.crTotal5y);
  $('kpi-crossref-meta').textContent = `Registros DOI Crossref (${YEARS[0]}–${YEARS[YEARS.length - 1]})`;

  $('kpi-oa-value').textContent = `${analytics.oaPct}%`;
  $('kpi-oa-meta').textContent = `Artigos em acesso aberto na temática`;

  const semVals = analytics.semesters.map(s => s.oaCount);
  const crVals = analytics.yearly.map(y => y.crTotal);
  renderSparkline($('spark-total'), semVals, '#15803d', 'gradTotal');
  renderSparkline($('spark-crossref'), crVals, '#0e7490', 'gradCrossref');
  renderSparkline($('spark-oa'), semVals.map((v, i) => Math.max(10, analytics.oaPct - 6 + (i % 5) * 2)), '#b45309', 'gradOa');
}

// --- Diretório de Pesquisadores (ZERO QUANTITATIVOS INDIVIDUAIS) ---

function scholarUrl(name) {
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(`author:"${name}"`)}`;
}
function lattesUrl(researcher) {
  if (researcher.lattes) return researcher.lattes;
  return `https://buscatextual.cnpq.br/buscatextual/busca.do?metodo=apresentar`;
}
function orcidFallbackUrl(name) {
  return `https://orcid.org/orcid-search/search?searchQuery=${encodeURIComponent(name)}`;
}

async function resolveOrcidId(name) {
  if (state.orcidResolved.has(name)) return state.orcidResolved.get(name);
  const parts = name.trim().split(/\s+/);
  const given = parts[0] || '';
  const family = parts[parts.length - 1] || '';
  const q = `given-names:${given} AND family-name:${family}`;
  try {
    const data = await fetchJson(
      `${ORCID_SEARCH_BASE}?q=${encodeURIComponent(q)}&rows=3`,
      {Accept: 'application/json'},
      7000
    );
    const list = data?.['expanded-result'] || [];
    const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const targetNorm = norm(name);
    const match = list.find(r => {
      const full = norm(`${r['given-names'] || ''} ${r['family-names'] || ''}`);
      return full.includes(norm(given)) && full.includes(norm(family)) && targetNorm.includes(norm(family));
    }) || list[0];
    const id = match?.['orcid-id'] || null;
    state.orcidResolved.set(name, id);
    return id;
  } catch {
    state.orcidResolved.set(name, null);
    return null;
  }
}

function renderResearchers() {
  const grid = $('faculty-grid');
  if (!grid) return;
  const q = state.facultyQuery.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const list = RESEARCHERS.filter(r => {
    if (!q) return true;
    const hay = `${r.name} ${r.line}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return hay.includes(q);
  });

  $('faculty-count').textContent = `${list.length} de ${RESEARCHERS.length} pesquisadores listados (somente perfis públicos, sem quantitativos individuais)`;

  grid.innerHTML = list.map((r, idx) => {
    const resolvedOrcid = state.orcidResolved.get(r.name);
    const orcidHref = resolvedOrcid ? `https://orcid.org/${resolvedOrcid}` : orcidFallbackUrl(r.name);
    const orcidLabel = resolvedOrcid ? `ORCID ↗` : 'ORCID (Buscar) ↗';
    const lattesTitle = r.lattes ? 'Abrir Currículo Lattes direto' : 'Pesquisar no CNPq Plataforma Lattes';
    return `
      <article class="faculty-card">
        <div class="faculty-head">
          <span class="faculty-avatar" aria-hidden="true">${esc(initials(r.name))}</span>
          <div>
            <h3 class="faculty-name">${esc(r.name)}</h3>
            <span class="faculty-line">${esc(r.line)}</span>
          </div>
        </div>
        <div class="faculty-links">
          <a class="profile-link scholar" href="${esc(scholarUrl(r.name))}" target="_blank" rel="noopener noreferrer">Google Scholar ↗</a>
          <a class="profile-link lattes" href="${esc(lattesUrl(r))}" target="_blank" rel="noopener noreferrer" title="${esc(lattesTitle)}">Lattes ↗</a>
          <a class="profile-link orcid" data-orcid-idx="${idx}" data-orcid-name="${esc(r.name)}" href="${esc(orcidHref)}" target="_blank" rel="noopener noreferrer">${esc(orcidLabel)}</a>
        </div>
      </article>`;
  }).join('');
}

async function resolveVisibleOrcids() {
  // Resolve ORCIDs em pequenos lotes respeitando limites públicos da ORCID API
  for (const r of RESEARCHERS) {
    if (state.orcidResolved.has(r.name)) continue;
    const id = await resolveOrcidId(r.name);
    if (id) {
      const link = document.querySelector(`.profile-link.orcid[data-orcid-name="${CSS.escape(r.name)}"]`);
      if (link) {
        link.href = `https://orcid.org/${id}`;
        link.textContent = 'ORCID ✓ ↗';
        link.title = `ORCID verificado: ${id}`;
      }
    }
  }
}

// --- Controle de Slides, Tela Cheia e Atualização Ao Vivo ---

function setLiveStatus(loading, text) {
  const pill = $('live-status-pill');
  const label = $('live-status-text');
  if (pill) pill.classList.toggle('loading', Boolean(loading));
  if (label) label.textContent = text;
}

async function refreshDashboard(force = false) {
  if (force) {
    state.cache.clear();
    state.lineTotals = null;
  }
  setLiveStatus(true, 'Consultando OpenAlex & Crossref ao vivo…');
  try {
    const [analytics, lineTotals] = await Promise.all([
      fetchLineAnalytics(state.lineId),
      fetchAllLineTotals()
    ]);
    renderKpis(analytics);
    renderMainEvolutionChart(analytics);
    renderWaterfallChart(analytics);
    renderSemesterMatrix(analytics);
    renderResearchLines(lineTotals);
    renderRecentWorks(analytics.recentWorks);
    const hhmm = analytics.updatedAt.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    setLiveStatus(false, `Ao vivo · Atualizado às ${hhmm}`);
    $('active-line-subtitle').textContent = analytics.line.name;
  } catch (err) {
    console.error(err);
    setLiveStatus(false, 'Falha parcial na consulta online — tente atualizar');
  }
}

function setActiveSlide(idx, shouldScroll = true) {
  state.slideIdx = (idx + SLIDE_IDS.length) % SLIDE_IDS.length;
  const activeId = SLIDE_IDS[state.slideIdx];
  document.querySelectorAll('.pres-section').forEach(sec => {
    sec.classList.toggle('slide-active', sec.id === activeId);
  });
  document.querySelectorAll('.pres-rail-btn[data-slide]').forEach((btn, i) => {
    btn.classList.toggle('active', i === state.slideIdx);
  });
  const counter = $('slide-counter');
  if (counter) counter.textContent = `Seção ${state.slideIdx + 1} / ${SLIDE_IDS.length}`;
  if (shouldScroll && !state.slideMode) {
    if (state.slideIdx === 0) {
      window.scrollTo({top: 0, behavior: 'smooth'});
    } else {
      document.getElementById(activeId)?.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
  }
}

function toggleSlideMode() {
  state.slideMode = !state.slideMode;
  document.body.classList.toggle('pres-slide-mode', state.slideMode);
  const btn = $('btn-slide-mode');
  if (btn) btn.textContent = state.slideMode ? '⊞ Ver página completa' : '▣ Modo Slides';
  setActiveSlide(state.slideIdx, false);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

function initControls() {
  // Popular seletor de anos (últimos 5 anos)
  const yearSel = $('filter-year');
  if (yearSel) {
    yearSel.innerHTML = `<option value="all">Últimos 5 anos (${YEARS[0]}–${YEARS[YEARS.length - 1]})</option>` +
      YEARS.slice().reverse().map(y => `<option value="${y}">Somente ${y}</option>`).join('');
    yearSel.addEventListener('change', () => {
      state.yearFilter = yearSel.value;
      refreshDashboard();
    });
  }

  const lineSel = $('filter-line');
  if (lineSel) {
    lineSel.innerHTML = RESEARCH_LINES.map(l => `<option value="${esc(l.id)}">${esc(l.short)}</option>`).join('');
    lineSel.addEventListener('change', () => {
      state.lineId = lineSel.value;
      refreshDashboard();
    });
  }

  document.querySelectorAll('[data-granularity]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.granularity = btn.getAttribute('data-granularity');
      document.querySelectorAll('[data-granularity]').forEach(b => b.classList.toggle('active', b === btn));
      refreshDashboard();
    });
  });

  $('btn-refresh-live')?.addEventListener('click', () => refreshDashboard(true));
  $('btn-slide-mode')?.addEventListener('click', toggleSlideMode);
  $('btn-fullscreen')?.addEventListener('click', toggleFullscreen);
  $('rail-fullscreen')?.addEventListener('click', toggleFullscreen);

  $('btn-prev-slide')?.addEventListener('click', () => {
    if (!state.slideMode) toggleSlideMode();
    setActiveSlide(state.slideIdx - 1, false);
  });
  $('btn-next-slide')?.addEventListener('click', () => {
    if (!state.slideMode) toggleSlideMode();
    setActiveSlide(state.slideIdx + 1, false);
  });

  document.querySelectorAll('.pres-rail-btn[data-slide]').forEach((btn, i) => {
    btn.addEventListener('click', () => setActiveSlide(i, true));
  });

  $('faculty-search')?.addEventListener('input', e => {
    state.facultyQuery = e.target.value || '';
    renderResearchers();
  });

  document.addEventListener('keydown', e => {
    if (!state.slideMode) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); setActiveSlide(state.slideIdx + 1, false); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); setActiveSlide(state.slideIdx - 1, false); }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initControls();
  renderResearchers();
  setActiveSlide(0, false);
  refreshDashboard();
  setTimeout(resolveVisibleOrcids, 900);
});
