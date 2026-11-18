import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=async p=>readFile(new URL('../assets/js/'+p,import.meta.url),'utf8');
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const {findJournalsByName,findSmartCatalogMatches}=await import(uri(await load('journal-search.js')));
const rows=[{titulo:'Bragantia'},{titulo:'Revista Ciência Agronômica'},{titulo:'BioEnergy Research'}];
test('name search handles exact names, accents and questions without thematic false positives',()=>{
 assert.deepEqual(findJournalsByName(rows,'BRAGANTIA'),[rows[0]]);
 assert.deepEqual(findJournalsByName(rows,'Quais os dados da Bragantia?'),[rows[0]]);
 assert.deepEqual(findJournalsByName(rows,'ciencia agronomica'),[rows[1]]);
 assert.deepEqual(findJournalsByName(rows,'onde publicar sobre biomassa'),[]);
 assert.deepEqual(findJournalsByName(rows,''),[]);
});
test('smart internal search recommends relevant base journals for Portuguese themes such as glicose',async()=>{
 const data=JSON.parse(await readFile(new URL('../assets/data/revistas.json',import.meta.url),'utf8'));
 const result=findSmartCatalogMatches(data.revistas,'glicose');
 assert.equal(result.isExactName,false);
 assert.ok(result.matches.length>0);
 const titles=result.matches.map(r=>r.titulo);
 assert.ok(titles.some(t=>/Biochem|Enzyme|Biotechnol|Sugar/i.test(t)),titles.join(', '));
});
test('expanded criteria display numeric CiteScore and percentile without removed pending disclaimers',async()=>{
 const criteria=uri(await load('criteria.js'));
 const eligibility=uri((await load('eligibility.js')).replace("'./criteria.js'",JSON.stringify(criteria)));
 const ui=(await load('criteria-ui.js')).replace("'./criteria.js'",JSON.stringify(criteria)).replace("'./eligibility.js'",JSON.stringify(eligibility));
 const {journalAssessmentHTML}=await import(uri(ui));
 const data=JSON.parse(await readFile(new URL('../assets/data/revistas.json',import.meta.url),'utf8'));
 const html=journalAssessmentHTML(data.revistas.find(r=>r.titulo==='Bragantia'),s=>String(s));
 assert.match(html,/CiteScore 2,9/);assert.match(html,/65%/);assert.match(html,/2025/);assert.match(html,/sourceid\/38490/);assert.match(html,/Notas na Scopus por categoria/);assert.match(html,/Página oficial na Scopus/);
 assert.doesNotMatch(html,/Conferido|Percentil H > 50|Verificação do roteiro da equipe|Revisão humana dos alertas editoriais/);
});
test('comparison exposes original APC and separates decision, acceptance and publication',async()=>{
 const criteria=uri(await load('criteria.js'));
 const eligibility=uri((await load('eligibility.js')).replace("'./criteria.js'",JSON.stringify(criteria)));
 const ui=(await load('criteria-ui.js')).replace("'./criteria.js'",JSON.stringify(criteria)).replace("'./eligibility.js'",JSON.stringify(eligibility));
 const {comparisonHTML}=await import(uri(ui));
 const data=JSON.parse(await readFile(new URL('../assets/data/revistas.json',import.meta.url),'utf8'));
 const html=comparisonHTML(data.revistas.filter(r=>[14,24].includes(r.id)),s=>String(s));
 for(const text of ['USD 4.760','USD 3.190','143 dias','7 dias após','Mediana de 6 dias','SCIE','sourceid/15110','sourceid/15611'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/A confirmar|150 dias/);
 const springer=comparisonHTML([data.revistas.find(r=>r.id==='springer-12155')],s=>String(s));
 assert.match(springer,/USD 4.090/);assert.match(springer,/12 dias/);assert.match(springer,/2026-10-29/);
});
