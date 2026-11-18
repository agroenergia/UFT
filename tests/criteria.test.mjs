import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../assets/js/criteria.js',import.meta.url),'utf8');
const {metrics,matchesCriteria,csvCell}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('missing metrics never pass thresholds or mean zero APC',()=>{
 for(const f of [{percentil:'50'},{percentilH:'50'},{indexacao:'either'},{apcMax:'0'},{acordoCapes:'nao'},{prazoMax:'180'}])assert.equal(matchesCriteria({},f),false);
 assert.equal(metrics({citescore:99,sjr:'Q1',fatorImpacto:15}).maiorPercentil,null);
});
test('distinct thresholds: greater than H50; at least CiteScore/JIF50; percentile ranges',()=>{
 assert.equal(matchesCriteria({percentilCiteScore:49,percentilJif:50},{percentil:'50'}),true);
 assert.equal(matchesCriteria({percentilCiteScore:92},{percentil:'90-100'}),true);
 assert.equal(matchesCriteria({percentilCiteScore:88},{percentil:'90-100'}),false);
 assert.equal(matchesCriteria({percentilCiteScore:88},{percentil:'75-89'}),true);
 assert.equal(matchesCriteria({percentilCiteScore:74},{percentil:'75-89'}),false);
 assert.equal(matchesCriteria({percentilCiteScore:45},{percentil:'0-49'}),true);
 assert.equal(matchesCriteria({percentilCiteScore:50},{percentil:'0-49'}),false);
 assert.equal(matchesCriteria({percentilH:50},{percentilH:'50'}),false);
 assert.equal(matchesCriteria({percentilH:50.1},{percentilH:'50'}),true);
 assert.equal(metrics({percentilCiteScore:101,percentilJif:80}).maiorPercentil,80);
});
test('combine index, budget, time, agreement and stratum without inferring coverage',()=>{
 const r={indexacaoScopus:true,percentilJif:80,percentilH:70,apcBRL:0,prazoPublicacaoDias:180,acordoCapes:true,estrato:'A2'};
 const f={indexacao:'either',percentil:'80',percentilH:'50',apcMax:'0',prazoMax:'180',acordoCapes:'sim',estrato:'A2'};
 assert.equal(matchesCriteria(r,f),true);assert.equal(matchesCriteria({...r,prazoPublicacaoDias:181},f),false);
 assert.equal(matchesCriteria({...r,apcBRL:null,custo:'Gratuito via assinatura'},f),false);
});
test('CSV quotes, formula defense and no column-breaking newlines',()=>{
 assert.equal(csvCell('a;"b"'),'"a;""b"""');assert.equal(csvCell('=1+1'),'"\'=1+1"');assert.equal(csvCell(null),'""');assert.equal(csvCell('a\nb'),'"a\nb"');
});
test('preserve original 118 records, verify 270 CAPES Scopus records, and prevent unverified Springer records from passing filters',async()=>{
 const data=JSON.parse(await readFile(new URL('../assets/data/revistas.json',import.meta.url)));
 assert.equal(data.revistas.length,388);assert.equal(new Set(data.revistas.map(r=>String(r.id))).size,388);
 const capes=data.revistas.filter(r=>String(r.id).startsWith('capes-scopus-'));
 assert.equal(capes.length,270);
 for(const r of capes){
  assert.ok(r.scopusSourceId);
  assert.ok(r.percentilCiteScore>=50,r.titulo);
  assert.equal(r.evidenciasMetricas.percentilCiteScore.url,'https://www.scopus.com/sourceid/'+r.scopusSourceId);
  assert.equal(r.evidenciasMetricas.percentilCiteScore.anoIndicador,2025);
  assert.equal(r.percentilCiteScore,Math.max(...r.percentisCiteScorePorCategoria.map(c=>c.percentil)));
 }
 data.revistas=data.revistas.filter(r=>!String(r.id).startsWith('capes-scopus-'));
 assert.equal(data.revistas.length,118);assert.equal(new Set(data.revistas.map(r=>String(r.id))).size,118);assert.equal(data.atualizadoEm,'2026-11-17');
 const batch=data.revistas.filter(r=>String(r.id).startsWith('springer-'));
 assert.equal(batch.length,50);
 for(const r of batch){
  assert.equal(r.statusConferencia,'Em conferência');assert.equal(r.criterioPlanilha.status,'confirmar');
  for(const f of [{percentilH:'50'},{apcMax:'0'},{acordoCapes:'sim'},{prazoMax:'365'}])assert.equal(matchesCriteria(r,f),false,r.titulo);
  assert.ok(Number.isFinite(metrics(r).maiorPercentil));
  assert.ok(r.conferenciasOnline.length>0);
 }
 assert.equal(data.revistas.filter(r=>matchesCriteria(r,{percentil:'50'})).length,95);
 assert.equal(data.revistas.filter(r=>Number.isFinite(r.percentilCiteScore)).length,117);
 for(const r of data.revistas.filter(r=>Number.isFinite(r.percentilCiteScore))){assert.equal(r.evidenciasMetricas.percentilCiteScore.anoIndicador,2025);assert.ok(r.evidenciasMetricas.percentilCiteScore.urlArquivo);assert.equal(r.percentilCiteScore,Math.max(...r.percentisCiteScorePorCategoria.map(c=>c.percentil)));}
});
