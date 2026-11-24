import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const rootDir = fileURLToPath(root);
const read = p => readFile(new URL(p, root), 'utf8');

async function walkFiles(dir, rel = '') {
  const out = [];
  for (const ent of await readdir(dir, {withFileTypes: true})) {
    if (ent.name === '.git' || ent.name === 'node_modules') continue;
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...await walkFiles(full, relPath));
    else out.push(relPath);
  }
  return out;
}

test('no download buttons, download attributes, or file-export modules remain in site or chat', async () => {
  const htmlPages = [
    'index.html',
    'privacidade.html',
    'sobre.html',
    'checklist.html',
    'ficha-revista.html',
    'contato-enviado.html',
    'acesso.html',
    'base-planilha.html',
    'catalogo-pdf.html',
    'guia-top-10.html',
    'docs/guia.html'
  ];
  for (const page of htmlPages) {
    const content = await read(page);
    assert.doesNotMatch(content, /<a\b[^>]*\sdownload(?=[\s>="'])/i, `${page} must not contain HTML <a download> attribute`);
    assert.doesNotMatch(content, /Baixar\s+(XLS|CSV|PDF|MP4|JSON|Bloco|Excel|meu andamento|modelo|apresenta|checklist)/i, `${page} must not contain download labels`);
    assert.doesNotMatch(content, /window\.print\s*\(/i, `${page} must not trigger print/PDF export`);
    assert.doesNotMatch(content, /xls-export\.js|pdf-export\.js|base-planilha\.js|catalogo-pdf\.js|top-10\.js/i, `${page} must not load removed export scripts`);
  }

  const jsModules = [
    'assets/js/app.js',
    'assets/js/openalex-chat.js',
    'assets/js/checklist.js',
    'assets/js/ficha-revista.js',
    'assets/js/visitor-tracker.js'
  ];
  for (const mod of jsModules) {
    const content = await read(mod);
    assert.doesNotMatch(content, /\.download\s*=/i, `${mod} must not trigger programmatic file downloads`);
    assert.doesNotMatch(content, /Baixar PDF|downloadPublicationPdf|downloadJournalsXls|downloadVisitsTxt|downloadVisitsJson|exportCsv/i, `${mod} must not retain download helpers`);
    assert.doesNotMatch(content, /window\.print\s*\(/i, `${mod} must not trigger print/PDF`);
  }

  for (const removed of [
    'assets/downloads/RigorAtlas-checklist-modelo.xlsx',
    'assets/js/pdf-export.js',
    'assets/js/xls-export.js',
    'assets/js/base-planilha.js',
    'assets/js/catalogo-pdf.js',
    'assets/js/top-10.js',
    'assets/video/apresentacao-rigoratlas.mp4',
    'assets/video/checklist-requisitos.mp4',
    'assets/img/video-poster.jpg',
    'assets/img/checklist-video-poster.jpg',
    'assets/img/logo-pesquisa-ppgad.svg'
  ]) {
    await assert.rejects(() => access(new URL(removed, root)), `${removed} should be removed`);
  }
});

test('no institutional-branded videos remain in index.html', async () => {
  const indexHtml = await read('index.html');
  assert.doesNotMatch(indexHtml, /<video\b/i, 'index.html must not embed removed institutional videos');
  assert.match(indexHtml, /class="banner-guide-panel"/i, 'index.html should render independent editorial guide panel');
  assert.match(indexHtml, /class="req-guide-panel"/i, 'index.html should render independent 7-pillar guide panel');
});

test('API compliance: Crossref mailto, NCBI PubMed tool/email, and no unlicensed Elsevier cover CDN hotlinks', async () => {
  const appJs = await read('assets/js/app.js');
  const chatJs = await read('assets/js/openalex-chat.js');

  assert.doesNotMatch(appJs, /ars\.els-cdn\.com/i, 'app.js must not hotlink Elsevier cover images');
  assert.match(appJs, /mailto:"mdqmichael@gmail\.com"/, 'Crossref request in app.js should include Polite Pool mailto');
  assert.match(chatJs, /tool:\s*'RigorAtlas'/, 'PubMed E-utilities must declare independent tool parameter');
  assert.match(chatJs, /email:\s*'mdqmichael@gmail\.com'/, 'PubMed E-utilities must declare email parameter');
  assert.match(chatJs, /Regime somente consulta online \(downloads desativados\)/i, 'chat drawer must display fixed compliance notice');
});

test('fixed legal compliance footer and full policy documentation cover independence, APIs, AI, Scopus, WoS, and LGPD', async () => {
  const pagesWithFooter = [
    'index.html',
    'privacidade.html',
    'sobre.html',
    'checklist.html',
    'ficha-revista.html',
    'contato-enviado.html',
    'acesso.html'
  ];
  for (const page of pagesWithFooter) {
    const html = await read(page);
    assert.match(html, /DOCUMENTAÇÃO JURÍDICA FIXA/i, `${page} must include fixed legal footer`);
    assert.match(html, /Regime Somente Consulta · Downloads Desativados/i, `${page} must state read-only no-download status`);
    assert.match(html, /sem vínculo institucional/i, `${page} must state institutional independence`);
    assert.match(html, /Scopus®/i, `${page} must attribute Scopus trademark`);
    assert.match(html, /Web of Science™/i, `${page} must attribute Web of Science trademark`);
    assert.match(html, /LGPD/i, `${page} must reference LGPD`);
  }

  const policyHtml = await read('privacidade.html');
  for (const term of [
    'Cláusula de Independência Institucional',
    'Crossref REST API',
    'OpenAlex REST API',
    'ORCID Public API',
    'NCBI PubMed E-utilities',
    'DOAJ API',
    'CC0 1.0',
    'Elsevier B.V.',
    'Clarivate™',
    'Journal Citation Reports™',
    'Journal Impact Factor™',
    'Lei nº 13.709/2018',
    'Lei nº 12.965/2014',
    'Lei nº 9.610/1998',
    'OAB'
  ]) {
    assert.ok(policyHtml.includes(term), `privacidade.html must document: ${term}`);
  }
});

test('header displays 4 main terms + hover dropdown below search bar and provides mobile-only floating nav', async () => {
  const indexHtml = await read('index.html');
  assert.doesNotMatch(indexHtml, /id="menu-toggle"/i, 'index.html must not contain #menu-toggle button');
  assert.doesNotMatch(indexHtml, /<span>Menu<\/span>/i, 'index.html must not show Menu button label');
  assert.match(indexHtml, /<div class="header-subnav">\s*<nav id="primary-navigation" class="header-term-nav"[^>]*>/i, 'index.html must render always-visible horizontal term navigation under search bar');
  assert.doesNotMatch(indexHtml, /id="primary-navigation"[^>]*\shidden\b/i, '#primary-navigation must not be hidden');
  const navMatch = indexHtml.match(/<nav id="primary-navigation"[\s\S]*?<\/nav>/i);
  assert.ok(navMatch, '#primary-navigation must exist');
  const navBlock = navMatch[0];
  for (const mainTerm of ['>Início<', '>Comparar<', '>Sinais de alerta<', '>Contato<', 'Mais recursos']) {
    assert.ok(navBlock.includes(mainTerm), `primary nav must include ${mainTerm}`);
  }
  assert.match(navBlock, /id="nav-more-menu" class="nav-dropdown-menu"/i, 'secondary items must live in dropdown menu');
  assert.match(indexHtml, /<nav class="mobile-floating-nav"/i, 'index.html must provide mobile floating bottom navigation');
  const searchPos = indexHtml.indexOf('id="ai-search-form"');
  const navPos = indexHtml.indexOf('id="primary-navigation"');
  assert.ok(searchPos > 0 && navPos > searchPos, 'horizontal term navigation must appear below the search bar');
});

test('institutional independence: zero unauthorized UFT/PPGAD references remain, .search-privacy banner removed, and approved team credits present', async () => {
  const indexHtml = await read('index.html');
  assert.doesNotMatch(indexHtml, /class="search-privacy"/i, 'index.html must not display the top .search-privacy banner');
  for (const member of ['Michael Oliveira', 'Neiber Garcia', 'Prof. Dr. Guilherme Benko Siqueira']) {
    assert.ok(indexHtml.includes(member), `index.html footer must include ${member}`);
  }

  const forbidden = /\b(uft|ppgad|propesq|tocantins|palmas)\b|universidade federal do tocantins|agroenergia digital|agroneg[oó]cio digital|nibert|dra\.?\s*solange|@uft\.edu\.br|@mail\.uft\.edu\.br|logo-pesquisa-ppgad|ppgad_admin|ppgad-logo|cafe\/uft|procuradoria federal/i;
  const files = await walkFiles(rootDir);
  const violations = [];
  for (const rel of files) {
    if (rel === 'tests/compliance.test.mjs') continue;
    if (!/\.(html|js|mjs|css|svg|json|py|yml|yaml|md)$|^(LICENSE|README\.md)$/i.test(rel)) continue;
    const text = await read(rel);
    const match = text.match(forbidden);
    if (match) {
      violations.push(`${rel}: matched "${match[0]}"`);
    }
  }
  assert.deepEqual(violations, [], `Unauthorized institutional references found:\n${violations.join('\n')}`);
});

