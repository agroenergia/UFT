import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = p => readFile(new URL(p, root), 'utf8');

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
    'assets/js/top-10.js'
  ]) {
    await assert.rejects(() => access(new URL(removed, root)), `${removed} should be removed`);
  }
});

test('videos disable native browser download controls', async () => {
  const indexHtml = await read('index.html');
  const videoTags = indexHtml.match(/<video\b[^>]*>/gi) || [];
  assert.equal(videoTags.length, 2);
  for (const tag of videoTags) {
    assert.match(tag, /controlsList="nodownload"/i);
  }
});

test('API compliance: Crossref mailto, NCBI PubMed tool/email, and no unlicensed Elsevier cover CDN hotlinks', async () => {
  const appJs = await read('assets/js/app.js');
  const chatJs = await read('assets/js/openalex-chat.js');

  assert.doesNotMatch(appJs, /ars\.els-cdn\.com/i, 'app.js must not hotlink Elsevier cover images');
  assert.match(appJs, /mailto:"mdqmichael@gmail\.com"/, 'Crossref request in app.js should include Polite Pool mailto');
  assert.match(chatJs, /tool:\s*'RigorAtlas-UFT'/, 'PubMed E-utilities must declare tool parameter');
  assert.match(chatJs, /email:\s*'mdqmichael@gmail\.com'/, 'PubMed E-utilities must declare email parameter');
  assert.match(chatJs, /Regime somente consulta online \(downloads desativados\)/i, 'chat drawer must display fixed compliance notice');
});

test('fixed legal compliance footer and full policy documentation cover APIs, AI, Scopus, WoS, and LGPD', async () => {
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
    assert.match(html, /Scopus®/i, `${page} must attribute Scopus trademark`);
    assert.match(html, /Web of Science™/i, `${page} must attribute Web of Science trademark`);
    assert.match(html, /LGPD/i, `${page} must reference LGPD`);
  }

  const policyHtml = await read('privacidade.html');
  for (const term of [
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
    'Procuradoria Federal junto à UFT'
  ]) {
    assert.ok(policyHtml.includes(term), `privacidade.html must document: ${term}`);
  }
});
