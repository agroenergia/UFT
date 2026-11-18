const normalize = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const SEARCH_STOPWORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos',
  'e', 'em', 'encontrar', 'essa', 'esse', 'esta', 'este', 'faz', 'fazer',
  'mais', 'melhor', 'meu', 'meus', 'minha', 'minhas', 'na', 'nas', 'no',
  'nos', 'o', 'os', 'opcao', 'opcoes', 'para', 'periodico', 'periodicos',
  'pesquisa', 'pesquisas', 'por', 'publicacao', 'publicar', 'qual', 'quais',
  'que', 'revista', 'revistas', 'sao', 'sem', 'site', 'sobre', 'tema',
  'tem', 'um', 'uma', 'umas', 'uns', 'artigo', 'artigos', 'catalogo'
]);

const TOPIC_CLUSTERS = [
  {
    label: 'Carboidratos, glicose, fermentação e bioquímica',
    triggers: [
      'glicose', 'glucose', 'dextrose', 'acucar', 'acucares', 'sugar', 'sugars',
      'sacarose', 'sucrose', 'frutose', 'fructose', 'amido', 'starch',
      'carboidrato', 'carboidratos', 'carbohydrate', 'carbohydrates',
      'celulose', 'cellulose', 'lignocelulos', 'hidrolis', 'hydrolys',
      'ferment', 'bioquim', 'biochem', 'enzim', 'enzym', 'biocatal',
      'metabol', 'glicemia', 'insulina', 'biossensor', 'biosensor',
      'cana', 'sugarcane', 'etanol', 'ethanol'
    ],
    primary: [
      'glucos', 'sugar', 'acucar', 'sacarose', 'sucros', 'carbohydr', 'carboidrat',
      'starch', 'amido', 'ferment', 'enzym', 'enzim', 'biochem', 'bioquim',
      'biocatal', 'biosensor', 'biossensor', 'hidrolis', 'hydrolys',
      'lignocelul', 'celulos', 'cellulos', 'metabol'
    ],
    related: [
      'biotech', 'biotecnol', 'bioprocess', 'biorefin', 'biorrefin',
      'food', 'alimento', 'chemi', 'quimic', 'analyt', 'analitic',
      'bioenerg', 'ethanol', 'etanol', 'biomass'
    ],
    crossref: ['glucose', 'sugar', 'fermentation', 'biochemistry', 'enzymatic']
  },
  {
    label: 'Bioenergia, biomassa e biocombustíveis',
    triggers: [
      'bioenerg', 'biomass', 'biocombust', 'biofuel', 'biodiesel',
      'biogas', 'biometan', 'biomethan', 'agroenerg', 'etanol', 'ethanol',
      'alga', 'microalga', 'pirolis', 'pyrolys', 'gaseific', 'gasific',
      'biorrefin', 'biorefin', 'pellet'
    ],
    primary: [
      'bioenerg', 'biomass', 'biofuel', 'biocombust', 'biodiesel', 'biogas',
      'biomethan', 'agroenerg', 'ethanol', 'etanol', 'algal', 'microalga',
      'pyrolys', 'pirolis', 'gasific', 'biorefin', 'biorrefin'
    ],
    related: ['renewab', 'renovavel', 'energy', 'energia', 'biochem', 'biotech', 'waste', 'residuo'],
    crossref: ['bioenergy', 'biomass', 'biofuel']
  },
  {
    label: 'Energia renovável e sistemas energéticos',
    triggers: [
      'energia', 'energy', 'renovavel', 'renovaveis', 'renewable', 'solar',
      'fotovolta', 'photovolta', 'eolica', 'wind', 'hidrogenio', 'hydrogen',
      'combustivel', 'fuel', 'eletroquim', 'electrochem', 'bateria', 'battery',
      'smart grid', 'eletric'
    ],
    primary: [
      'energy', 'energia', 'renewab', 'renovav', 'solar', 'photovolta', 'wind',
      'eolic', 'hydrogen', 'hidrogen', 'fuel', 'electrochem', 'eletroquim',
      'battery', 'grid'
    ],
    related: ['sustainab', 'sustentav', 'cleaner', 'engine', 'engenh', 'power'],
    crossref: ['renewable energy', 'sustainable energy']
  },
  {
    label: 'Ciência e tecnologia de alimentos',
    triggers: [
      'alimento', 'alimentos', 'food', 'nutricao', 'nutrition', 'nutricion',
      'bebida', 'beverage', 'grao', 'grain', 'fruta', 'fruit', 'hortalica',
      'vegetable', 'conservacao', 'processamento'
    ],
    primary: ['food', 'aliment', 'nutrit', 'nutric', 'dairy', 'beverag', 'bioprocess'],
    related: ['agricultur', 'agronom', 'chemi', 'biochem', 'biotech', 'sugar', 'microbiolog'],
    crossref: ['food science', 'food technology', 'nutrition']
  },
  {
    label: 'Química, catálise e sensores',
    triggers: [
      'quimic', 'chem', 'catalis', 'cataly', 'sensor', 'biossensor', 'biosensor',
      'cromatograf', 'chromatograph', 'espectroscop', 'spectroscop',
      'analitic', 'analyt', 'sintese', 'synthes', 'reacao'
    ],
    primary: [
      'chemi', 'quimic', 'catal', 'sensor', 'chromatograph', 'spectroscop',
      'analyt', 'analitic', 'synthes'
    ],
    related: ['biochem', 'material', 'sustent', 'green', 'verde', 'process'],
    crossref: ['chemistry', 'analytical', 'chemical']
  },
  {
    label: 'Biotecnologia, microbiologia e biociências',
    triggers: [
      'biotecnol', 'biotech', 'microbiolog', 'microb', 'bacteri', 'levedura',
      'yeast', 'fungo', 'fung', 'genetic', 'genomic', 'molecular', 'biolog',
      'celular', 'cellular', 'fisiolog', 'physiolog', 'botanic', 'botany'
    ],
    primary: [
      'biotech', 'biotecnol', 'microbiolog', 'microb', 'genet', 'genom',
      'molecul', 'biolog', 'physiol', 'fisiol', 'botan'
    ],
    related: ['biochem', 'plant', 'planta', 'bioenerg', 'agricultur'],
    crossref: ['biotechnology', 'microbiology', 'biochemistry']
  },
  {
    label: 'Agricultura, solos, água e florestas',
    triggers: [
      'agricultur', 'agricol', 'agronom', 'agro', 'lavoura', 'cultiv', 'crop',
      'soja', 'soybean', 'milho', 'maize', 'corn', 'arroz', 'rice', 'feijao',
      'bean', 'cafe', 'coffee', 'algodao', 'cotton', 'solo', 'soil', 'fertil',
      'adub', 'nutrient', 'agua', 'water', 'irrigac', 'irrigat', 'hidrolog',
      'hydrolog', 'florest', 'forest', 'eucalipt', 'silvicult', 'agroecolog',
      'praga', 'pest', 'herbicid', 'planta', 'plant'
    ],
    primary: [
      'agricultur', 'agricol', 'agronom', 'crop', 'soil', 'solo', 'water',
      'agua', 'irrigat', 'hydrolog', 'forest', 'florest', 'silvicult',
      'plant', 'planta', 'agroecolog', 'fertil', 'nutrient', 'horticult', 'bragantia'
    ],
    related: ['biosystem', 'environ', 'ambient', 'sustainab', 'ecolog', 'climat', 'precision'],
    crossref: ['agriculture', 'agronomy', 'soil', 'water']
  },
  {
    label: 'Pecuária, zootecnia e medicina veterinária',
    triggers: [
      'pecuari', 'gado', 'bovin', 'cattle', 'livestock', 'animal', 'veterin',
      'zootecn', 'pastag', 'pastur', 'forrag', 'forag', 'suino', 'swine',
      'ave', 'poultry', 'peixe', 'fish', 'aquicult', 'aquacult', 'ruminant',
      'silagem', 'silage'
    ],
    primary: [
      'veterin', 'zootecn', 'animal', 'livestock', 'cattle', 'bovin',
      'pastur', 'forag', 'aquacult', 'poultry', 'dairy', 'meat', 'industria animal'
    ],
    related: ['agricultur', 'biolog', 'food', 'nutrit'],
    crossref: ['animal science', 'veterinary', 'livestock']
  },
  {
    label: 'Tecnologias digitais, IA, IoT e geociências',
    triggers: [
      'inteligencia artificial', 'ia', 'ai', 'machine learning', 'deep learning',
      'aprendizado', 'algoritmo', 'algorithm', 'comput', 'software', 'dados',
      'data', 'iot', 'automac', 'automat', 'robot', 'drone', 'uav', 'vant',
      'sensoriamento', 'remote sensing', 'satelit', 'geoprocess', 'gis', 'sig',
      'geocienc', 'geoscien', 'informatic', 'eletronic', 'precisao', 'precision'
    ],
    primary: [
      'comput', 'electron', 'inform', 'intelligen', 'smart', 'data',
      'geoscien', 'sensing', 'sensor', 'precision', 'autom', 'robot', 'geomat', 'digital'
    ],
    related: ['biosystem', 'agricultur', 'energy', 'engineer'],
    crossref: ['agriculture', 'sensors', 'machine learning', 'geoscience']
  },
  {
    label: 'Sustentabilidade, ambiente, resíduos e gestão',
    triggers: [
      'sustent', 'sustain', 'ambient', 'environ', 'ecolog', 'clima', 'climat',
      'carbon', 'emiss', 'residu', 'waste', 'efluent', 'wastewater', 'esgoto',
      'poluic', 'pollut', 'reciclag', 'recycl', 'circular', 'gestao',
      'management', 'econom', 'politic', 'policy', 'inovac', 'innovat', 'governanc'
    ],
    primary: [
      'sustainab', 'sustent', 'environ', 'ambient', 'ecolog', 'climat',
      'carbon', 'waste', 'residu', 'wastewater', 'pollut', 'recycl',
      'circular', 'cleaner', 'manag', 'econom', 'policy', 'innovat'
    ],
    related: ['energy', 'agricultur', 'biotech', 'water'],
    crossref: ['sustainability', 'environmental', 'waste', 'circular economy']
  }
];

function queryTokens(query) {
  return normalize(query)
    .split(/\s+/)
    .filter(t => (t.length >= 3 || ['ia', 'ai'].includes(t)) && !SEARCH_STOPWORDS.has(t));
}

function triggerMatches(tokens, normalizedQuery, trigger) {
  if (trigger.includes(' ')) return normalizedQuery.includes(trigger);
  return tokens.some(
    t => t === trigger || (t.length >= 4 && (trigger.startsWith(t) || t.startsWith(trigger)))
  );
}

export function findJournalsByName(rows, query) {
  const q = normalize(query);
  if (!q) return [];
  const exact = rows.filter(r => normalize(r.titulo) === q);
  if (exact.length) return exact;
  return rows.filter(r => {
    const title = normalize(r.titulo);
    return (' ' + q + ' ').includes(' ' + title + ' ') || (q.length >= 4 && title.includes(q));
  });
}

export function expandSearchTerms(query) {
  const qNorm = normalize(query);
  const tokens = queryTokens(query);
  const matchedClusters = TOPIC_CLUSTERS.filter(c =>
    c.triggers.some(tr => triggerMatches(tokens, qNorm, tr))
  );
  const crossrefTerms = new Set(tokens);
  matchedClusters.forEach(c => c.crossref.forEach(term => crossrefTerms.add(term)));
  return {
    tokens,
    matchedClusters,
    crossrefTerms: [...crossrefTerms],
    crossrefQuery: [String(query || '').trim(), ...matchedClusters.flatMap(c => c.crossref)]
      .filter(Boolean)
      .join(' ')
  };
}

function scoreJournal(journal, tokens, matchedClusters) {
  const title = normalize(journal.titulo);
  const categories = (journal.percentisCiteScorePorCategoria || [])
    .map(c => c.categoria || '')
    .join(' ');
  const area = normalize([journal.area, categories].join(' '));
  const scope = normalize(
    [
      journal.escopo,
      journal.alinhamento,
      journal.observacoes,
      journal.tiposArtigo,
      journal.enquadramento,
      journal.check ? Object.values(journal.check).join(' ') : ''
    ].join(' ')
  );
  const meta = normalize([journal.idioma, journal.custo, journal.editora, journal.issn].join(' '));

  let score = 0;
  const matchedTerms = new Set();
  const matchedLabels = new Set();

  tokens.forEach(term => {
    const stem = term.length >= 5 ? term.slice(0, term.length - 1) : term;
    const hitTitle = title.includes(term) || (stem.length >= 4 && title.includes(stem));
    const hitArea = area.includes(term) || (stem.length >= 4 && area.includes(stem));
    const hitScope = scope.includes(term) || (stem.length >= 4 && scope.includes(stem));
    const hitMeta = meta.includes(term);
    if (hitTitle) score += 14;
    if (hitArea) score += 7;
    if (hitScope) score += 5;
    if (hitMeta) score += 3;
    if (hitTitle || hitArea || hitScope || hitMeta) matchedTerms.add(term);
  });

  matchedClusters.forEach(cluster => {
    let clusterScore = 0;
    const hitPrimary = new Set();
    cluster.primary.forEach(term => {
      if (title.includes(term)) { clusterScore += 8; hitPrimary.add(term); }
      if (area.includes(term)) { clusterScore += 5; hitPrimary.add(term); }
      if (scope.includes(term)) { clusterScore += 4; hitPrimary.add(term); }
    });
    cluster.related.forEach(term => {
      if (title.includes(term)) clusterScore += 3;
      if (area.includes(term)) clusterScore += 2;
      if (scope.includes(term)) clusterScore += 1;
    });
    if (hitPrimary.size > 0 || clusterScore >= 4) {
      score += clusterScore + Math.min(hitPrimary.size, 3) * 2;
      matchedLabels.add(cluster.label);
    }
  });

  return {
    journal,
    score,
    matchedTerms: [...matchedTerms],
    matchedLabels: [...matchedLabels]
  };
}

export function findSmartCatalogMatches(rows, query, { limit = 8 } = {}) {
  const named = findJournalsByName(rows, query);
  const { tokens, matchedClusters } = expandSearchTerms(query);

  const scored = rows
    .map(r => scoreJournal(r, tokens, matchedClusters))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(!b.journal.criterioPlanilha || b.journal.criterioPlanilha.status === 'selecao') -
          Number(!a.journal.criterioPlanilha || a.journal.criterioPlanilha.status === 'selecao') ||
        (b.journal.maiorPercentil ?? -1) - (a.journal.maiorPercentil ?? -1) ||
        (Number(b.journal.citescore) || 0) - (Number(a.journal.citescore) || 0) ||
        String(a.journal.titulo || '').localeCompare(String(b.journal.titulo || ''), 'pt-BR')
    );

  if (named.length) {
    const namedIds = new Set(named.map(r => String(r.id ?? r.titulo)));
    const related = scored.filter(
      item => item.score > 0 && !namedIds.has(String(item.journal.id ?? item.journal.titulo))
    );
    return {
      isExactName: true,
      matches: named,
      relatedMatches: related.slice(0, Math.max(0, limit - named.length)).map(x => x.journal),
      ordered: scored,
      matchedLabels: [...new Set(matchedClusters.map(c => c.label))]
    };
  }

  const positive = scored.filter(item => item.score > 0);
  return {
    isExactName: false,
    matches: positive.slice(0, limit).map(x => x.journal),
    relatedMatches: [],
    ordered: scored,
    totalMatches: positive.length,
    matchedLabels: [...new Set(positive.slice(0, limit).flatMap(x => x.matchedLabels))]
  };
}
