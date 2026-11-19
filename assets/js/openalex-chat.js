import { findSmartCatalogMatches, expandSearchTerms } from './journal-search.js';

const OPENALEX_WORKS = 'https://api.openalex.org/works';
const OPENALEX_SOURCES = 'https://api.openalex.org/sources';
const CROSSREF_WORKS = 'https://api.crossref.org/works';
const CROSSREF_JOURNALS = 'https://api.crossref.org/journals';
const STORAGE_KEY_API = 'rigoratlas_openalex_api_key';

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

const DIAMOND_NATIONAL_PUBLISHERS = [
  'scielo',
  'fapunifesp',
  'universidade federal',
  'embrapa',
  'universidade estadual',
  'ufrgs',
  'unicamp',
  'unesp',
  'usp',
  'capes',
  'cnpq'
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

function isNationalDiamondPublisher(publisherName) {
  const p = norm(publisherName);
  return Boolean(p && DIAMOND_NATIONAL_PUBLISHERS.some(k => p.includes(k)));
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
  if (isNationalDiamondPublisher(effectivePub)) {
    return {
      status: 'catalog',
      label: '★ Periódico institucional / rede nacional (SciELO / IES)',
      detail: 'Sem vínculo CAPES pago; muitas revistas universitárias brasileiras não cobram taxa de publicação',
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

async function queryOpenAlex(queryText) {
  const apiKey = getStoredKey();
  const baseParams = {
    search: queryText,
    'per-page': '6',
    sort: 'relevance_score:desc',
    mailto: 'mdqmichael@gmail.com'
  };
  if (apiKey) baseParams.api_key = apiKey;

  const worksParams = new URLSearchParams(baseParams);
  const sourcesParams = new URLSearchParams({ ...baseParams, 'per-page': '4' });

  const [worksResp, sourcesResp] = await Promise.all([
    fetch(`${OPENALEX_WORKS}?${worksParams.toString()}`),
    fetch(`${OPENALEX_SOURCES}?${sourcesParams.toString()}`)
  ]);

  if (worksResp.status === 429 || sourcesResp.status === 429) {
    openAlexUnavailableInSession = true;
    const err = new Error('FALLBACK');
    throw err;
  }
  if (!worksResp.ok) {
    throw new Error('FALLBACK');
  }

  const worksData = await worksResp.json();
  const sourcesData = sourcesResp.ok ? await sourcesResp.json() : { results: [] };

  const articles = (worksData.results || []).map(w => {
    const src = w.primary_location?.source || {};
    const issns = [...new Set([src.issn_l, ...(src.issn || [])].filter(Boolean).map(s => String(s).toUpperCase()))];
    return {
      title: w.display_name || w.title || 'Artigo científico',
      year: w.publication_year || null,
      doi: safeHref(w.doi || w.id),
      citedBy: Number(w.cited_by_count || 0),
      journalTitle: src.display_name || 'Periódico não informado',
      publisher: src.host_organization_name || '',
      issns,
      isOa: Boolean(w.open_access?.is_oa || src.is_oa),
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

async function queryFreeAcademicAPIs(rawQuery, expandedQuery) {
  const effectiveQuery = expandedQuery || rawQuery;
  const worksParams = new URLSearchParams({
    query: rawQuery,
    filter: 'type:journal-article',
    rows: '6',
    mailto: 'mdqmichael@gmail.com'
  });
  const journalParams = new URLSearchParams({
    query: effectiveQuery,
    rows: '4',
    mailto: 'mdqmichael@gmail.com'
  });

  const [worksResp, journalsResp] = await Promise.all([
    fetch(`${CROSSREF_WORKS}?${worksParams.toString()}`),
    fetch(`${CROSSREF_JOURNALS}?${journalParams.toString()}`).catch(() => null)
  ]);

  let items = [];
  if (worksResp.ok) {
    const data = await worksResp.json();
    items = data.message?.items || [];
    if (!items.length && expandedQuery && expandedQuery !== rawQuery) {
      const retry = await fetch(
        `${CROSSREF_WORKS}?${new URLSearchParams({ query: expandedQuery, filter: 'type:journal-article', rows: '6', mailto: 'mdqmichael@gmail.com' })}`
      );
      if (retry.ok) {
        items = (await retry.json()).message?.items || [];
      }
    }
  }

  const articles = items.map(it => {
    const jTitle = Array.isArray(it['container-title']) ? it['container-title'][0] : '';
    const title = Array.isArray(it.title) ? it.title[0] : 'Artigo científico';
    const issns = (it.ISSN || []).map(s => String(s).toUpperCase());
    const dateParts = it.published?.['date-parts']?.[0] || it.created?.['date-parts']?.[0] || [];
    const pubYear = dateParts[0] || null;
    const publisher = it.publisher || '';
    return {
      title,
      year: pubYear,
      doi: safeHref(it.URL || it.DOI),
      citedBy: Number(it['is-referenced-by-count'] || 0),
      journalTitle: jTitle || 'Periódico científico',
      publisher,
      issns,
      isOa: false,
      capes: evaluateCapesAndCatalog({
        title: jTitle,
        issns,
        publisher,
        isOa: false
      })
    };
  });

  let sources = [];
  if (journalsResp && journalsResp.ok) {
    const jData = await journalsResp.json();
    sources = (jData.message?.items || []).slice(0, 3).map(j => {
      const issns = (j.ISSN || []).map(s => String(s).toUpperCase());
      return {
        title: j.title || '',
        publisher: j.publisher || '',
        issns,
        homepage: issns.length ? `https://portal.issn.org/resource/ISSN/${encodeURIComponent(issns[0])}` : '',
        capes: evaluateCapesAndCatalog({
          title: j.title,
          issns,
          publisher: j.publisher,
          isOa: false
        })
      };
    });
  }

  return { articles, sources };
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

function renderBotReply({ query, searchResult, catalogMatches }) {
  const wrap = el('div', 'oa-msg oa-msg-bot');

  const meta = el('div', 'oa-msg-meta');
  meta.textContent = 'Assistente de Publicação · Revistas & CAPES';
  wrap.append(meta);

  if (catalogMatches.length) {
    const catHead = el('p', 'oa-subhead', `Revistas recomendadas na nossa base (${catalogMatches.length}):`);
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

  if (searchResult.articles.length) {
    const artHead = el(
      'p',
      'oa-subhead',
      `Artigos semelhantes publicados e situação CAPES das revistas (${searchResult.articles.length}):`
    );
    wrap.append(artHead);

    const list = el('div', 'oa-article-list');
    searchResult.articles.forEach(art => {
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
      card.append(titleEl, info, buildCapesBadge(art.capes));
      list.append(card);
    });
    wrap.append(list);
  } else {
    const none = el(
      'p',
      'oa-empty-note',
      `Não localizamos artigos exatamente com "${query}". Tente usar 2 ou 3 palavras-chave principais do tema (em português ou inglês) ou o nome exato de uma revista.`
    );
    wrap.append(none);
  }

  if (searchResult.sources && searchResult.sources.length) {
    const srcHead = el('p', 'oa-subhead', 'Outras revistas relacionadas ao tema:');
    wrap.append(srcHead);
    const sList = el('div', 'oa-article-list');
    searchResult.sources.slice(0, 3).forEach(src => {
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
    '<span class="oa-fab-dot" aria-hidden="true"></span><span class="oa-fab-label"><strong>Onde Publicar? (Chat IA)</strong><small>Artigos semelhantes &amp; CAPES</small></span>';

  const drawer = el('section', 'oa-chat-drawer');
  drawer.id = 'oa-chat-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'false');
  drawer.setAttribute('aria-labelledby', 'oa-chat-title');
  drawer.hidden = true;

  drawer.innerHTML = `
    <header class="oa-chat-head">
      <div>
        <span class="oa-chat-badge">GUIA DE PUBLICAÇÃO · REVISTAS &amp; CAPES</span>
        <h2 id="oa-chat-title">Descubra Onde Publicar seu Artigo</h2>
      </div>
      <div class="oa-chat-head-actions">
        <button type="button" id="oa-chat-close" class="oa-icon-btn" aria-label="Fechar conversa">✕</button>
      </div>
    </header>
    <div id="oa-chat-messages" class="oa-chat-messages" aria-live="polite">
      <div class="oa-msg oa-msg-bot">
        <div class="oa-msg-meta">Assistente de Publicação RigorAtlas</div>
        <p>Olá! Posso ajudar você a encontrar em quais revistas científicas artigos parecidos com a sua pesquisa já foram publicados — e conferir na hora se a revista tem gratuidade pelo <strong>Acordo CAPES</strong>.</p>
        <p>Digite o <strong>assunto do seu trabalho</strong>, o <strong>título de um artigo</strong>, um <strong>autor</strong> ou o <strong>nome da revista</strong>, ou toque em um exemplo:</p>
        <div class="oa-quick-prompts" aria-label="Exemplos de pesquisa">
          <button type="button" class="oa-prompt-chip" data-q="bioetanol biomassa cana">🔎 bioetanol e biomassa</button>
          <button type="button" class="oa-prompt-chip" data-q="glicose fermentação">🔎 glicose e fermentação</button>
          <button type="button" class="oa-prompt-chip" data-q="Biomass and Bioenergy">🔎 Biomass and Bioenergy</button>
          <button type="button" class="oa-prompt-chip" data-q="agricultura digital sensores">🔎 agricultura digital</button>
        </div>
      </div>
    </div>
    <form id="oa-chat-form" class="oa-chat-form">
      <label class="sr-only" for="oa-chat-input">Digite seu tema, título de artigo, autor ou revista</label>
      <input id="oa-chat-input" type="search" maxlength="240" required placeholder="Ex.: glicose, bioetanol, autor ou revista..." autocomplete="off">
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
    const loading = el('div', 'oa-msg oa-msg-bot oa-msg-loading', 'Procurando artigos semelhantes e verificando Acordos CAPES…');
    messages.append(userBubble, loading);
    messages.scrollTop = messages.scrollHeight;

    await ensureCatalog();
    const expanded = expandSearchTerms(query);
    const expandedQuery = expanded.crossrefQuery && query.length < 45 ? expanded.crossrefQuery : query;
    const smartCat = findSmartCatalogMatches(catalogRows, query, { limit: 4 });

    let searchResult = null;
    if (!openAlexUnavailableInSession) {
      try {
        searchResult = await queryOpenAlex(expandedQuery);
        if (!searchResult.articles.length && expandedQuery !== query) {
          searchResult = await queryOpenAlex(query);
        }
      } catch {
        searchResult = null;
      }
    }

    if (!searchResult) {
      try {
        searchResult = await queryFreeAcademicAPIs(query, expandedQuery);
      } catch {
        searchResult = { articles: [], sources: [] };
      }
    }

    loading.remove();
    const botBubble = renderBotReply({
      query,
      searchResult,
      catalogMatches: smartCat.matches || []
    });
    messages.append(botBubble);
    messages.scrollTop = messages.scrollHeight;
    sendBtn.disabled = false;
    sendBtn.textContent = 'Buscar';

    const capesHits = searchResult.articles.filter(a => a.capes.status === 'confirmed' || a.capes.status === 'publisher').length;
    window.dispatchEvent(
      new CustomEvent('rigoratlas:announce', {
        detail: {
          message: `Busca concluída para ${query}. ${searchResult.articles.length} artigos encontrados e ${capesHits} periódicos identificados nos acordos CAPES.`
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
