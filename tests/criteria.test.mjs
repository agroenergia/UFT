import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../assets/js/criteria.js',import.meta.url),'utf8');
const {metrics,matchesCriteria,csvCell}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('missing metrics never pass thresholds or mean zero APC',()=>{
 for(const f of [{percentil:'50'},{percentilH:'50'},{indexacao:'either'},{apcMax:'0'},{acordoCapes:'nao'},{prazoMax:'180'}])assert.equal(matchesCriteria({},f),false);
 assert.equal(metrics({citescore:99,sjr:'Q1',fatorImpacto:15}).maiorPercentil,null);
});
test('distinct thresholds: greater than H50; at least CiteScore/JIF50',()=>{
 assert.equal(matchesCriteria({percentilCiteScore:49,percentilJif:50},{percentil:'50'}),true);
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
test('68 original records preserved, source date unchanged',async()=>{
 const data=JSON.parse(await readFile(new URL('../assets/data/revistas.json',import.meta.url)));
 assert.equal(data.revistas.length,68);assert.equal(new Set(data.revistas.map(r=>r.id)).size,68);assert.equal(data.atualizadoEm,'2026-10-26');
 assert.equal(data.revistas.filter(r=>matchesCriteria(r,{percentil:'50'})).length,0);
});
