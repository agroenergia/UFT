import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const dataURL=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const read=p=>readFile(new URL('../assets/'+p,import.meta.url),'utf8');
const criteria=dataURL(await read('js/criteria.js'));
const {evaluateJournal,expectedPublication}=await import(dataURL((await read('js/eligibility.js')).replace("'./criteria.js'",JSON.stringify(criteria))));
const {cleanState,summary,checklistCSV}=await import(dataURL(await read('js/checklist-model.js')));
const {items}=JSON.parse(await read('data/checklist.json'));
test('unknown journal facts cannot pass evidence requirements',()=>{
 assert.equal(evaluateJournal({indexacaoScopus:true,percentilJif:99,percentilH:99,analiseEditorial:'revisada_sem_alerta_grave'}).state,'pending');
 const e={url:'https://example.org/verified',consultadoEm:'2026-10-29',anoIndicador:2025,categoria:'Test category'};
 const r={indexacaoScopus:true,percentilJif:50,percentilH:51,analiseEditorial:'revisada_sem_alerta_grave',evidenciasMetricas:Object.fromEntries(['indexacaoScopus','percentilJif','percentilH','analiseEditorial'].map(k=>[k,e]))};
 assert.equal(evaluateJournal(r).state,'pass');assert.equal(evaluateJournal({...r,percentilH:50}).state,'fail');
 assert.equal(evaluateJournal({...r,evidenciasMetricas:{...r.evidenciasMetricas,percentilJif:{...e,categoria:''}}}).state,'pending');
});
test('calendar estimates reject invalid input and cross leap day correctly',()=>{
 assert.deepEqual(expectedPublication(2,'2028-02-28','2028-02-29'),{date:'2028-03-01',late:true});
 for(const [days,date] of [[null,'2026-01-01'],[2,'2026-02-30'],[1e99,'2026-01-01']])assert.equal(expectedPublication(days,date),null);
});
test('conditional completion requires a reason; after submission excluded from progress',()=>{
 const s=cleanState({version:1,entries:{}},items);assert.equal(summary(s,items).total,29);
 s.entries.figuras.status='na';assert.equal(summary(s,items).done,0);s.entries.figuras.note='Sem figuras';assert.equal(summary(s,items).done,1);
 s.entries.recibo.status='done';assert.equal(summary(s,items).done,1);assert.equal(summary(s,items).afterDone,1);
 s.entries.escopo.status='na';assert.equal(cleanState(s,items).entries.escopo.status,'pending');
});
test('export contains all tasks and escapes formulas and quotes',()=>{
 const s=cleanState({version:1,title:'=1+1',entries:{escopo:{status:'done',note:'a;"b"'}}},items);
 const csv=checklistCSV(s,items);assert.equal(csv.split('\r\n').length,33);assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"a;""b"""'));assert.throws(()=>cleanState({},items));
});
