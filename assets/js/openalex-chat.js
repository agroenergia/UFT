import { findSmartCatalogMatches, expandSearchTerms } from './journal-search.js';

const OPENALEX_WORKS = 'https://api.openalex.org/works';
const OPENALEX_SOURCES = 'https://api.openalex.org/sources';
const CROSSREF_WORKS = 'https://api.crossref.org/works';
const CROSSREF_JOURNALS = 'https://api.crossref.org/journals';
const ORCID_SEARCH = 'https://pub.orcid.org/v3.0/expanded-search/';
const ORCID_BASE = 'https://pub.orcid.org/v3.0/';
const PUBMED_ESEARCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const PUBMED_ESUMMARY = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
const STORAGE_KEY_API = 'rigoratlas_openalex_api_key';

const INITIAL_VISIBLE_ARTICLES = 10;

const CAPES_PUBLISHERS = [
  ['elsevier', 'Elsevier'],
  ['springer', 'Springer Nature'],
  ['biomed central', 'Springer Nature (BMC)'],
  ['bmc', 'Springer Nature (BMC)'],
  ['nature portfolio', 'Springer Nature'],
  ['wiley', 'Wiley'],
  ['american chemical society', 'American Chemical Society (ACS)'],
  ['acs', 'American Chemical Society (ACS)'],
  ['ieee', 'IEEE'],
  ['institute of electrical and electronics engineers', 'IEEE'],
  ['association for computing machinery', 'ACM'],
  ['acm', 'ACM'],
  ['royal society', 'Royal Society Publishing']
];

const DIAMOND_NATIONAL_HINTS = [
  'scielo',
  'fapunifesp',
  'universidade federal',
  'universidade estadual',
  'embrapa',
  'ifto',
  'ifgoiano',
  'ufrgs',
  'unicamp',
  'unesp',
  'usp',
  'ufv',
  'ufla',
  'capes',
  'cnpq',
  'desafios',
  'sitio novo',
  'capim dourado',
  'agri environmental sciences',
  'revista engenharia na agricultura',
  'agroenergy'
];

let catalogPromise = null;
let catalogRows = [];
let catalogByIssn = new Map();
let catalogByTitle = new Map();
let openAlexUnavailableInSession = false;

function norm(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractIssns(v) {
  const m = String(v || '').toUpperCase().match(/\d{4}-\d{3}[\dX]/g);
  return m ? [...new Set(m)] : [];
}

function extractDoiKey(urlOrDoi) {
  const s = String(urlOrDoi || '').trim().toLowerCase();
  const m = s.match(/10\.\d{4,9}\/[^\s?#]+/);
  return m ? m[0].replace(/\/+$/, '') : '';
}

function safeHref(url) {
  const s = String(url || '').trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('10.')) return 'https://doi.org/' + encodeURIComponent(s);
  return '';
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function ensureCatalog() {
  if (catalogRows.length) return catalogRows;
  if (!catalogPromise) {
    catalogPromise = fetch('./assets/data/revistas.json')
      .then(r => (r.ok ? r.json() : { revistas: [] }))
      .then(data => {
        catalogRows = Array.isArray(data.revistas) ? data.revistas : [];
        catalogByIssn = new Map();
        catalogByTitle = new Map();
        for (const r of catalogRows) {
          for (const issn of extractIssns(r.issn)) {
            if (!catalogByIssn.has(issn)) catalogByIssn.set(issn, r);
          }
          const t = norm(r.titulo);
          if (t && !catalogByTitle.has(t)) catalogByTitle.set(t, r);
        }
        return catalogRows;
      })
      .catch(() => []);
  }
  return catalogPromise;
}

function matchPublisherCapes(publisherName) {
  const p = norm(publisherName);
  if (!p) return null;
  for (const [needle, label] of CAPES_PUBLISHERS) {
    const rx = new RegExp(`\\b${needle.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (rx.test(p)) return label;
  }
  return null;
}

function isNationalDiamondVenue(title, publisherName) {
  const combined = `${norm(title)} ${norm(publisherName)}`;
  return Boolean(combined.trim() && DIAMOND_NATIONAL_HINTS.some(k => combined.includes(k)));
}

function evaluateCapesAndCatalog({ title, issns = [], publisher, isOa }) {
  let rec = null;
  for (const issn of issns) {
    if (catalogByIssn.has(issn)) {
      rec = catalogByIssn.get(issn);
      break;
    }
  }
  if (!rec && title) {
    rec = catalogByTitle.get(norm(title)) || null;
  }

  const effectivePub = (rec && rec.editora) || publisher || '';
  const capesPub =
    (rec && rec.painelCapesTrimestral && rec.painelCapesTrimestral.editoraConveniada) ||
    matchPublisherCapes(effectivePub);

  if (rec && rec.acordoCapes === true) {
    return {
      status: 'confirmed',
      label: '✓ Faz parte do Acordo CAPES (gratuidade para autor UFT)',
      detail: `${capesPub ? capesPub + ' · ' : ''}Sujeito a vínculo ativo e e-mail institucional (@uft.edu.br)`,
      rec
    };
  }
  if (capesPub) {
    return {
      status: 'publisher',
      label: `◐ Editora com Acordo CAPES (${capesPub})`,
      detail: rec
        ? 'Presente na base · Confirme a cobertura individual do título no Portal CAPES'
        : 'Confira se este periódico específico integra a lista vigente no Portal CAPES',
      rec
    };
  }
  if (rec) {
    return {
      status: 'catalog',
      label: '✓ Revista já avaliada no RigorAtlas',
      detail: rec.custo || 'Consulte custos ou opção gratuita de assinatura na ficha completa',
      rec
    };
  }
  if (isNationalDiamondVenue(title, effectivePub)) {
    return {
      status: 'catalog',
      label: '★ Periódico institucional / rede nacional (SciELO / IES)',
      detail: 'Sem vínculo CAPES pago; revistas universitárias e nacionais geralmente têm acesso aberto sem taxa',
      rec: null
    };
  }
  return {
    status: 'none',
    label: '○ Sem vínculo CAPES identificado',
    detail: isOa
      ? 'Revista de acesso aberto — verifique na página da revista se há taxa ou isenção'
      : 'Consulte no site da revista se oferece rota gratuita por assinatura',
    rec: null
  };
}

function getStoredKey() {
  try {
    const paramKey = new URLSearchParams(location.search).get('openalex_key');
    if (paramKey && paramKey.trim()) {
      localStorage.setItem(STORAGE_KEY_API, paramKey.trim());
    }
    return (localStorage.getItem(STORAGE_KEY_API) || '').trim();
  } catch {
    return '';
  }
}

function tokenizeQuery(q) {
  return norm(q)
    .split(/\s+/)
    .filter(t => t.length >= 2);
}

function authorMatchesTokens(authorsList, tokens) {
  if (!tokens.length || !Array.isArray(authorsList) || !authorsList.length) return false;
  return authorsList.some(name => {
    const n = norm(name);
    return tokens.every(t => n.includes(t));
  });
}

async function queryOrcidProfileAndWorks(rawQuery, tokens) {
  if (tokens.length < 2 || tokens.length > 5) return { profile: null, articles: [] };
  try {
    const resp = await fetch(`${ORCID_SEARCH}?q=${encodeURIComponent(rawQuery)}&rows=6`, {
      headers: { Accept: 'application/json' }
    });
    if (!resp.ok) return { profile: null, articles: [] };
    const data = await resp.json();
    const candidates = data['expanded-result'] || [];
    if (!candidates.length) return { profile: null, articles: [] };

    const scored = candidates
      .map(c => {
        const full = norm(
          [c['given-names'], c['family-names'], c['credit-name'], ...(c['other-name'] || [])].join(' ')
        );
        const hits = tokens.filter(t => full.includes(t)).length;
        const inst = norm((c['institution-name'] || []).join(' '));
        const brBonus = /(tocantins|uft|brasil|brazil|federal|agro)/.test(inst) ? 2 : 0;
        return { c, hits, allMatch: hits === tokens.length, score: hits * 10 + brBonus };
      })
      .filter(x => x.allMatch)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) return { profile: null, articles: [] };

    const best = scored[0].c;
    const orcidId = best['orcid-id'];
    if (!orcidId) return { profile: null, articles: [] };

    const worksResp = await fetch(`${ORCID_BASE}${encodeURIComponent(orcidId)}/works`, {
      headers: { Accept: 'application/json' }
    });
    if (!worksResp.ok) return { profile: null, articles: [] };
    const worksData = await worksResp.json();
    const groups = worksData.group || [];

    const articles = [];
    for (const g of groups) {
      const summaries = g['work-summary'] || [];
      if (!summaries.length) continue;
      // Prefer summary with DOI and journal title
      const ws =
        summaries.find(
          s =>
            (s['external-ids']?.['external-id'] || []).some(e => e['external-id-type'] === 'doi') &&
            s['journal-title']?.value
        ) || summaries[0];

      const title = ws.title?.title?.value || '';
      if (!title) continue;
      const journalTitle = ws['journal-title']?.value || 'Produção registrada no ORCID';
      const year = ws['publication-date']?.year?.value ? Number(ws['publication-date'].year.value) : null;
      const extIds = ws['external-ids']?.['external-id'] || [];
      const doiObj = extIds.find(e => String(e['external-id-type']).toLowerCase() === 'doi');
      const doiUrl = doiObj
        ? doiObj['external-id-url']?.value || safeHref(doiObj['external-id-value'])
        : safeHref(ws.url?.value);

      articles.push({
        title,
        year,
        doi: safeHref(doiUrl),
        citedBy: 0,
        journalTitle,
        publisher: '',
        issns: [],
        isOa: false,
        sourceTag: 'ORCID',
        capes: evaluateCapesAndCatalog({ title: journalTitle, issns: [], publisher: '', isOa: false })
      });
    }

    const fullName = [best['given-names'], best['family-names']].filter(Boolean).join(' ').trim();
    const institutions = (best['institution-name'] || []).filter(Boolean);
    return {
      profile: {
        orcid: orcidId,
        name: fullName || best['credit-name'] || rawQuery,
        institution: institutions[institutions.length - 1] || institutions[0] || '',
        totalWorks: articles.length
      },
      articles
    };
  } catch {
    return { profile: null, articles: [] };
  }
}

async function queryOpenAlex(queryText) {
  const apiKey = getStoredKey();
  const baseParams = {
    search: queryText,
    'per-page': '20',
    sort: 'relevance_score:desc',
    mailto: 'mdqmichael@gmail.com'
  };
  if (apiKey) baseParams.api_key = apiKey;

  const worksParams = new URLSearchParams(baseParams);
  const sourcesParams = new URLSearchParams({ ...baseParams, 'per-page': '6' });

  const [worksResp, sourcesResp] = await Promise.all([
    fetch(`${OPENALEX_WORKS}?${worksParams.toString()}`),
    fetch(`${OPENALEX_SOURCES}?${sourcesParams.toString()}`)
  ]);

  if (worksResp.status === 429 || sourcesResp.status === 429) {
    openAlexUnavailableInSession = true;
    throw new Error('FALLBACK');
  }
  if (!worksResp.ok) throw new Error('FALLBACK');

  const worksData = await worksResp.json();
  const sourcesData = sourcesResp.ok ? await sourcesResp.json() : { results: [] };

  const articles = (worksData.results || []).map(w => {
    const src = w.primary_location?.source || {};
    const issns = [...new Set([src.issn_l, ...(src.issn || [])].filter(Boolean).map(s => String(s).toUpperCase()))];
    const authors = (w.authorships || []).map(a => a.author?.display_name).filter(Boolean);
    return {
      title: w.display_name || w.title || 'Artigo científico',
      year: w.publication_year || null,
      doi: safeHref(w.doi || w.id),
      citedBy: Number(w.cited_by_count || 0),
      journalTitle: src.display_name || 'Periódico não informado',
      journalUrl: safeHref(src.homepage_url),
      publisher: src.host_organization_name || '',
      issns,
      authors,
      isOa: Boolean(w.open_access?.is_oa || src.is_oa),
      sourceTag: 'OpenAlex',
      capes: evaluateCapesAndCatalog({
        title: src.display_name,
        issns,
        publisher: src.host_organization_name,
        isOa: Boolean(w.open_access?.is_oa || src.is_oa)
      })
    };
  });

  const sources = (sourcesData.results || []).map(s => {
    const issns = [...new Set([s.issn_l, ...(s.issn || [])].filter(Boolean).map(i => String(i).toUpperCase()))];
    return {
      title: s.display_name || '',
      publisher: s.host_organization_name || '',
      issns,
      isOa: Boolean(s.is_oa),
      homepage: safeHref(s.homepage_url || s.id),
      capes: evaluateCapesAndCatalog({
        title: s.display_name,
        issns,
        publisher: s.host_organization_name,
        isOa: Boolean(s.is_oa)
      })
    };
  });

  return { articles, sources };
}

async function queryCrossrefCombined(rawQuery, expandedQuery, authorTokens, strictAuthor) {
  const effectiveQuery = expandedQuery || rawQuery;
  const reqs = [
    fetch(
      `${CROSSREF_WORKS}?${new URLSearchParams({
        query: rawQuery,
        filter: 'type:journal-article',
        rows: '20',
        mailto: 'mdqmichael@gmail.com'
      })}`
    ).catch(() => null),
    fetch(
      `${CROSSREF_JOURNALS}?${new URLSearchParams({
        query: effectiveQuery,
        rows: '6',
        mailto: 'mdqmichael@gmail.com'
      })}`
    ).catch(() => null)
  ];
  if (strictAuthor) {
    reqs.push(
      fetch(
        `${CROSSREF_WORKS}?${new URLSearchParams({
          'query.author': rawQuery,
          filter: 'type:journal-article',
          rows: '20',
          mailto: 'mdqmichael@gmail.com'
        })}`
      ).catch(() => null)
    );
  }

  const [worksResp, journalsResp, authorResp] = await Promise.all(reqs);
  const rawItems = [];
  for (const r of [authorResp, worksResp]) {
    if (r && r.ok) {
      const d = await r.json();
      rawItems.push(...(d.message?.items || []));
    }
  }

  // Filter out unrelated homonyms when user searched a confirmed researcher
  const filteredItems = strictAuthor
    ? rawItems.filter(it => {
        const names = (it.author || []).map(a => `${a.given || ''} ${a.family || ''}`.trim());
        const titleStr = Array.isArray(it.title) ? it.title[0] || '' : '';
        return authorMatchesTokens(names, authorTokens) || norm(titleStr).includes(norm(rawQuery));
      })
    : rawItems;

  const articles = filteredItems.map(it => {
    const jTitle = Array.isArray(it['container-title']) ? it['container-title'][0] : '';
    const title = Array.isArray(it.title) ? it.title[0] : 'Artigo científico';
    const issns = (it.ISSN || []).map(s => String(s).toUpperCase());
    const dateParts = it.published?.['date-parts']?.[0] || it.created?.['date-parts']?.[0] || [];
    const pubYear = dateParts[0] || null;
    const publisher = it.publisher || '';
    const authors = (it.author || []).map(a => `${a.given || ''} ${a.family || ''}`.trim()).filter(Boolean);
    return {
      title,
      year: pubYear,
      doi: safeHref(it.URL || it.DOI),
      citedBy: Number(it['is-referenced-by-count'] || 0),
      journalTitle: jTitle || 'Periódico científico',
      publisher,
      issns,
      authors,
      isOa: false,
      sourceTag: 'Crossref',
      capes: evaluateCapesAndCatalog({ title: jTitle, issns, publisher, isOa: false })
    };
  });

  let sources = [];
  if (journalsResp && journalsResp.ok) {
    const jData = await journalsResp.json();
    sources = (jData.message?.items || []).slice(0, 5).map(j => {
      const issns = (j.ISSN || []).map(s => String(s).toUpperCase());
      return {
        title: j.title || '',
        publisher: j.publisher || '',
        issns,
        homepage: issns.length ? `https://portal.issn.org/resource/ISSN/${encodeURIComponent(issns[0])}` : '',
        capes: evaluateCapesAndCatalog({ title: j.title, issns, publisher: j.publisher, isOa: false })
      };
    });
  }

  return { articles, sources };
}

async function queryPubMed(termQuery) {
  try {
    const esResp = await fetch(
      `${PUBMED_ESEARCH}?${new URLSearchParams({
        db: 'pubmed',
        term: termQuery,
        retmax: '15',
        retmode: 'json',
        tool: 'RigorAtlas-UFT',
        email: 'mdqmichael@gmail.com'
      })}`
    );
    if (!esResp.ok) return [];
    const esData = await esResp.json();
    const ids = esData.esearchresult?.idlist || [];
    if (!ids.length) return [];

    const sumResp = await fetch(
      `${PUBMED_ESUMMARY}?${new URLSearchParams({
        db: 'pubmed',
        id: ids.join(','),
        retmode: 'json',
        tool: 'RigorAtlas-UFT',
        email: 'mdqmichael@gmail.com'
      })}`
    );
    if (!sumResp.ok) return [];
    const sumData = await sumResp.json();
    const res = sumData.result || {};

    return ids
      .map(id => {
        const it = res[id];
        if (!it || !it.title) return null;
        const jTitle = it.fulljournalname || it.source || 'Periódico indexado no PubMed';
        const issns = [it.issn, it.essn].filter(Boolean).map(s => String(s).toUpperCase());
        const doiEntry = (it.articleids || []).find(a => a.idtype === 'doi');
        const link = doiEntry ? safeHref(doiEntry.value) : `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(id)}/`;
        const yMatch = String(it.pubdate || it.epubdate || '').match(/\b(19|20)\d{2}\b/);
        const year = yMatch ? Number(yMatch[0]) : null;
        return {
          title: String(it.title).replace(/\.$/, ''),
          year,
          doi: link,
          citedBy: 0,
          journalTitle: jTitle,
          publisher: '',
          issns,
          isOa: false,
          sourceTag: 'PubMed',
          capes: evaluateCapesAndCatalog({ title: jTitle, issns, publisher: '', isOa: false })
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function mergeAndDedupeArticles(groups, rawQuery) {
  const byKey = new Map();
  const list = [];

  for (const group of groups) {
    for (const art of group) {
      if (!art || !art.title) continue;
      const doiKey = extractDoiKey(art.doi);
      const tKey = norm(art.title).slice(0, 90);
      const key = doiKey || tKey;
      if (!key) continue;

      if (byKey.has(key)) {
        const existing = byKey.get(key);
        // Merge richer metadata (ISSNs, publisher, citations, CAPES rec)
        if (!existing.publisher && art.publisher) existing.publisher = art.publisher;
        if (!existing.journalUrl && art.journalUrl) existing.journalUrl = art.journalUrl;
        if (!existing.issns.length && art.issns.length) existing.issns = art.issns;
        if (art.citedBy > existing.citedBy) existing.citedBy = art.citedBy;
        if (!existing.year && art.year) existing.year = art.year;
        if (!existing.capes.rec && art.capes.rec) existing.capes = art.capes;
        if ((!existing.authors || !existing.authors.length) && art.authors?.length) existing.authors = art.authors;
        continue;
      }

      // Check near-duplicate title even if one lacked DOI
      const dupTitle = list.find(x => norm(x.title).slice(0, 85) === tKey);
      if (dupTitle) {
        if (!dupTitle.doi && art.doi) dupTitle.doi = art.doi;
        if (!dupTitle.publisher && art.publisher) dupTitle.publisher = art.publisher;
        if (!dupTitle.journalUrl && art.journalUrl) dupTitle.journalUrl = art.journalUrl;
        if (!dupTitle.issns.length && art.issns.length) dupTitle.issns = art.issns;
        if (art.citedBy > dupTitle.citedBy) dupTitle.citedBy = art.citedBy;
        if (!dupTitle.capes.rec && art.capes.rec) dupTitle.capes = art.capes;
        if ((!dupTitle.authors || !dupTitle.authors.length) && art.authors?.length) dupTitle.authors = art.authors;
        continue;
      }

      byKey.set(key, art);
      list.push(art);
    }
  }

  const qTokens = tokenizeQuery(rawQuery);
  return list.sort((a, b) => {
    const aCap = a.capes.status === 'confirmed' ? 2 : a.capes.status === 'publisher' ? 1 : 0;
    const bCap = b.capes.status === 'confirmed' ? 2 : b.capes.status === 'publisher' ? 1 : 0;
    const aTitleHits = qTokens.filter(t => norm(a.title).includes(t)).length;
    const bTitleHits = qTokens.filter(t => norm(b.title).includes(t)).length;
    return (
      bTitleHits - aTitleHits ||
      bCap - aCap ||
      (b.year || 0) - (a.year || 0) ||
      (b.citedBy || 0) - (a.citedBy || 0)
    );
  });
}

function buildCapesBadge(capesInfo) {
  const box = el('div', `oa-capes-badge oa-capes-${capesInfo.status}`);
  const strong = el('strong', '', capesInfo.label);
  const sub = el('small', '', capesInfo.detail);
  box.append(strong, sub);
  if (capesInfo.rec) {
    const link = el('a', 'oa-catalog-link', 'Ver detalhes completos da revista ↗');
    link.href = 'ficha-revista.html?id=' + encodeURIComponent(capesInfo.rec.id);
    link.target = '_blank';
    link.rel = 'noopener';
    box.append(link);
  }
  return box;
}

function resolveJournalAccessUrl(art) {
  const fromRec = safeHref(art.capes?.rec?.url);
  if (fromRec) return fromRec;
  const direct = safeHref(art.journalUrl);
  if (direct) return direct;
  if (art.issns && art.issns.length) {
    return `https://portal.issn.org/resource/ISSN/${encodeURIComponent(art.issns[0])}`;
  }
  return `https://portal.issn.org/search?q=${encodeURIComponent(art.journalTitle || '')}`;
}

function createArticleCard(art) {
  const card = el('article', 'oa-article-card');
  const titleEl = el('h4', 'oa-article-title');
  if (art.doi) {
    const a = el('a', '', art.title);
    a.href = art.doi;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    titleEl.append(a);
  } else {
    titleEl.textContent = art.title;
  }

  const info = el(
    'p',
    'oa-article-journal',
    `Onde foi publicado: ${art.journalTitle}${art.publisher ? ' · ' + art.publisher : ''}${art.year ? ' (' + art.year + ')' : ''}${art.citedBy ? ' · ' + art.citedBy + ' citações' : ''}${art.issns.length ? ' · ISSN ' + art.issns[0] : ''}`
  );

  const actions = el('div', 'oa-article-actions');
  const journalAccessUrl = resolveJournalAccessUrl(art);
  const jLink = el('a', 'oa-act-link oa-journal-link', 'Acessar periódico online ↗');
  jLink.href = journalAccessUrl;
  jLink.target = '_blank';
  jLink.rel = 'noopener noreferrer';
  actions.append(jLink);

  if (art.doi) {
    const dLink = el('a', 'oa-act-link', 'Ver estudo (DOI) ↗');
    dLink.href = art.doi;
    dLink.target = '_blank';
    dLink.rel = 'noopener noreferrer';
    actions.append(dLink);
  }

  card.append(titleEl, info, buildCapesBadge(art.capes), actions);
  return card;
}

function renderBotReply({ query, orcidProfile, articles, sources, catalogMatches }) {
  const wrap = el('div', 'oa-msg oa-msg-bot');

  const meta = el('div', 'oa-msg-meta');
  meta.textContent = 'Assistente de Artigos, Revistas & CAPES';
  wrap.append(meta);

  if (orcidProfile) {
    const profileCard = el('div', 'oa-orcid-card');
    const title = el('strong', '', `Pesquisador identificado no ORCID: ${orcidProfile.name}`);
    const details = el(
      'small',
      '',
      `${orcidProfile.institution ? orcidProfile.institution + ' · ' : ''}ORCID ${orcidProfile.orcid} · ${orcidProfile.totalWorks} publicações vinculadas`
    );
    profileCard.append(title, details);
    wrap.append(profileCard);
  }

  if (catalogMatches.length) {
    const catHead = el('p', 'oa-subhead', `Revistas da nossa base alinhadas à busca (${catalogMatches.length}):`);
    wrap.append(catHead);
    const chipList = el('div', 'oa-match-list');
    catalogMatches.slice(0, 4).forEach(r => {
      const card = el('div', 'oa-mini-journal');
      const a = el('a', 'oa-mini-title', r.titulo);
      a.href = 'ficha-revista.html?id=' + encodeURIComponent(r.id);
      a.target = '_blank';
      a.rel = 'noopener';
      const capTag =
        r.acordoCapes === true
          ? 'Acordo CAPES confirmado'
          : r.painelCapesTrimestral?.editoraConveniada
            ? `Editora conveniada (${r.painelCapesTrimestral.editoraConveniada})`
            : 'Sem acordo CAPES confirmado';
      const desc = el(
        'small',
        '',
        `${r.area || 'Área geral'} · CiteScore: ${r.citescore ?? '—'} · WoS JIF: ${r.fatorImpacto ?? '—'} · ${capTag}`
      );
      card.append(a, desc);
      chipList.append(card);
    });
    wrap.append(chipList);
  }

  if (articles.length) {
    const artHead = el(
      'p',
      'oa-subhead',
      `Artigos encontrados e onde foram publicados (${articles.length}):`
    );
    wrap.append(artHead);

    const list = el('div', 'oa-article-list');
    let shown = Math.min(INITIAL_VISIBLE_ARTICLES, articles.length);
    articles.slice(0, shown).forEach(art => list.append(createArticleCard(art)));
    wrap.append(list);

    if (articles.length > shown) {
      const moreBtn = el('button', 'oa-more-btn', `Mostrar mais artigos (${articles.length - shown} restantes)`);
      moreBtn.type = 'button';
      moreBtn.addEventListener('click', () => {
        const nextEnd = Math.min(shown + 12, articles.length);
        articles.slice(shown, nextEnd).forEach(art => list.append(createArticleCard(art)));
        shown = nextEnd;
        if (shown >= articles.length) {
          moreBtn.remove();
        } else {
          moreBtn.textContent = `Mostrar mais artigos (${articles.length - shown} restantes)`;
        }
      });
      wrap.append(moreBtn);
    }
  } else {
    const none = el(
      'p',
      'oa-empty-note',
      `Não localizamos artigos exatamente com "${query}". Tente usar o nome completo do autor ou 2 a 3 palavras-chave principais (em português ou inglês).`
    );
    wrap.append(none);
  }

  if (sources && sources.length && !orcidProfile) {
    const srcHead = el('p', 'oa-subhead', 'Outras revistas relacionadas ao tema:');
    wrap.append(srcHead);
    const sList = el('div', 'oa-article-list');
    sources.slice(0, 4).forEach(src => {
      const sc = el('div', 'oa-article-card');
      const st = el('p', 'oa-article-journal');
      if (src.homepage) {
        const a = el('a', 'oa-mini-title', src.title);
        a.href = src.homepage;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        st.append(a);
      } else {
        st.append(el('strong', '', src.title));
      }
      st.append(
        document.createTextNode(
          ` · ${src.publisher || 'Editora científica'}${src.issns.length ? ' · ISSN ' + src.issns[0] : ''}`
        )
      );
      sc.append(st, buildCapesBadge(src.capes));
      sList.append(sc);
    });
    wrap.append(sList);
  }

  return wrap;
}

function mountChatUI() {
  if (document.getElementById('oa-chat-fab')) return;

  const fab = el('button', 'oa-chat-fab');
  fab.id = 'oa-chat-fab';
  fab.type = 'button';
  fab.setAttribute('aria-expanded', 'false');
  fab.setAttribute('aria-controls', 'oa-chat-drawer');
  fab.innerHTML =
    '<span class="oa-fab-dot" aria-hidden="true"></span><span class="oa-fab-label"><strong>Artigos &amp; Onde Publicar</strong><small>Busque estudos e onde foram publicados</small></span>';

  const drawer = el('section', 'oa-chat-drawer');
  drawer.id = 'oa-chat-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'false');
  drawer.setAttribute('aria-labelledby', 'oa-chat-title');
  drawer.hidden = true;

  drawer.innerHTML = `
    <header class="oa-chat-head">
      <div>
        <span class="oa-chat-badge">ARTIGOS DE INTERESSE · ONDE FORAM PUBLICADOS · CAPES</span>
        <h2 id="oa-chat-title">Busque Artigos e Onde Publicar</h2>
      </div>
      <div class="oa-chat-head-actions">
        <button type="button" id="oa-chat-close" class="oa-icon-btn" aria-label="Fechar conversa">✕</button>
      </div>
    </header>
    <div id="oa-chat-messages" class="oa-chat-messages" aria-live="polite">
      <div class="oa-msg oa-msg-bot">
        <div class="oa-msg-meta">Assistente de Artigos &amp; Revistas RigorAtlas</div>
        <p>Olá! Aqui você pode <strong>consultar artigos de seu interesse online</strong> na literatura científica (integrando as APIs públicas abertas <strong>OpenAlex</strong>, <strong>Crossref</strong>, <strong>PubMed</strong> e <strong>ORCID</strong>), descobrir <strong>onde cada estudo foi publicado</strong> e conferir se a revista participa do <strong>Acordo CAPES</strong>.</p>
        <p>Digite um <strong>assunto de pesquisa</strong>, <strong>título de artigo</strong>, <strong>autor</strong> ou <strong>nome da revista</strong>, ou toque em um exemplo:</p>
        <div class="oa-quick-prompts" aria-label="Exemplos de pesquisa">
          <button type="button" class="oa-prompt-chip" data-q="bioetanol biomassa cana">🔎 bioetanol e biomassa</button>
          <button type="button" class="oa-prompt-chip" data-q="glicose fermentação">🔎 glicose e fermentação</button>
          <button type="button" class="oa-prompt-chip" data-q="Biomass and Bioenergy">🔎 Biomass and Bioenergy</button>
          <button type="button" class="oa-prompt-chip" data-q="agricultura digital sensores">🔎 agricultura digital</button>
        </div>
      </div>
    </div>
    <p class="oa-chat-legal">Regime somente consulta online (downloads desativados). Metadados públicos via OpenAlex (CC0), Crossref, PubMed e ORCID; sem envio a IA externa. Não insira dados sigilosos. <a href="privacidade.html">Política de Segurança e Direitos</a>.</p>
    <form id="oa-chat-form" class="oa-chat-form">
      <label class="sr-only" for="oa-chat-input">Busque artigos de interesse, autores, temas ou revistas</label>
      <input id="oa-chat-input" type="search" maxlength="240" required placeholder="Busque artigos, temas, autores ou revistas..." autocomplete="off">
      <button type="submit" id="oa-chat-send">Buscar</button>
    </form>
  `;

  document.body.append(fab, drawer);

  const input = drawer.querySelector('#oa-chat-input');
  const messages = drawer.querySelector('#oa-chat-messages');
  const form = drawer.querySelector('#oa-chat-form');
  const sendBtn = drawer.querySelector('#oa-chat-send');

  function openDrawer(prefill) {
    drawer.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    if (prefill) {
      input.value = prefill;
      handleQuery(prefill);
    }
    setTimeout(() => input.focus(), 40);
  }

  function closeDrawer() {
    drawer.hidden = true;
    fab.setAttribute('aria-expanded', 'false');
    fab.focus();
  }

  fab.addEventListener('click', () => {
    if (drawer.hidden) openDrawer();
    else closeDrawer();
  });
  drawer.querySelector('#oa-chat-close').addEventListener('click', closeDrawer);

  drawer.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && !drawer.hidden) closeDrawer();
  });

  drawer.addEventListener('click', ev => {
    const chip = ev.target.closest('.oa-prompt-chip');
    if (chip && chip.dataset.q) {
      input.value = chip.dataset.q;
      handleQuery(chip.dataset.q);
    }
  });

  document.addEventListener('click', ev => {
    const trigger = ev.target.closest('[data-open-oa-chat]');
    if (trigger) {
      ev.preventDefault();
      openDrawer(trigger.dataset.oaQuery || '');
    }
  });

  async function handleQuery(raw) {
    const query = String(raw || '').trim();
    if (!query) return;
    input.value = '';
    sendBtn.disabled = true;
    sendBtn.textContent = '...';

    const userBubble = el('div', 'oa-msg oa-msg-user', query);
    const loading = el('div', 'oa-msg oa-msg-bot oa-msg-loading', 'Consultando bases científicas e cruzando Acordos CAPES…');
    messages.append(userBubble, loading);
    messages.scrollTop = messages.scrollHeight;

    await ensureCatalog();
    const tokens = tokenizeQuery(query);
    const expanded = expandSearchTerms(query);
    const hasTopicCluster = expanded.matchedClusters && expanded.matchedClusters.length > 0;
    const expandedQuery = expanded.crossrefQuery && query.length < 45 ? expanded.crossrefQuery : query;
    const smartCat = findSmartCatalogMatches(catalogRows, query, { limit: 6 });

    // 1. Check ORCID first if query looks like a person/researcher name (2..5 tokens, not strictly topic clusters)
    const orcidData = !hasTopicCluster
      ? await queryOrcidProfileAndWorks(query, tokens)
      : { profile: null, articles: [] };
    const isConfirmedAuthor = Boolean(orcidData.profile);

    // 2. Fetch in parallel from Crossref + PubMed (if thematic) + OpenAlex (when available)
    const pmQuery = expanded.crossrefTerms?.length ? expanded.crossrefTerms.slice(0, 4).join(' ') : query;
    const [crossrefData, pubmedArticles, openAlexData] = await Promise.all([
      queryCrossrefCombined(query, expandedQuery, tokens, isConfirmedAuthor),
      !isConfirmedAuthor ? queryPubMed(pmQuery) : Promise.resolve([]),
      !openAlexUnavailableInSession
        ? queryOpenAlex(isConfirmedAuthor ? query : expandedQuery).catch(() => null)
        : Promise.resolve(null)
    ]);

    const oaArticles =
      openAlexData && openAlexData.articles
        ? isConfirmedAuthor
          ? openAlexData.articles.filter(a => authorMatchesTokens(a.authors || [], tokens))
          : openAlexData.articles
        : [];

    const mergedArticles = mergeAndDedupeArticles(
      [orcidData.articles, oaArticles, crossrefData.articles, pubmedArticles],
      query
    );

    const sources = (openAlexData?.sources?.length ? openAlexData.sources : crossrefData.sources) || [];

    loading.remove();
    const botBubble = renderBotReply({
      query,
      orcidProfile: orcidData.profile,
      articles: mergedArticles,
      sources,
      catalogMatches: isConfirmedAuthor ? [] : smartCat.matches || []
    });
    messages.append(botBubble);
    messages.scrollTop = messages.scrollHeight;
    sendBtn.disabled = false;
    sendBtn.textContent = 'Buscar';

    const capesHits = mergedArticles.filter(
      a => a.capes.status === 'confirmed' || a.capes.status === 'publisher'
    ).length;
    window.dispatchEvent(
      new CustomEvent('rigoratlas:announce', {
        detail: {
          message: `Busca concluída para ${query}. ${mergedArticles.length} artigos encontrados e ${capesHits} periódicos identificados nos acordos CAPES.`
        }
      })
    );
  }

  form.addEventListener('submit', ev => {
    ev.preventDefault();
    handleQuery(input.value);
  });

  window.openRigorAtlasChat = openDrawer;
  window.setRigorAtlasOpenAlexKey = key => {
    try {
      const k = String(key || '').trim();
      if (k) {
        localStorage.setItem(STORAGE_KEY_API, k);
        openAlexUnavailableInSession = false;
      }
    } catch {}
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountChatUI);
} else {
  mountChatUI();
}
