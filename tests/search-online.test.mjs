import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../assets/js/app.js',import.meta.url),'utf8');
const ask=source.slice(source.indexOf('async function askAI(){'),source.indexOf('\nfunction exportCsv'));
for(const fails of [false,true])test('named search keeps catalog and calls online services'+(fails?' even when AI fails':''),async()=>{
 const journal={titulo:'Bragantia',id:11},rendered=[],calls=[];
 const fields={'ai-question':{value:'Bragantia'},'ai-status':{},'ai-answer':{},'ai-loading':{},'ai-search-button':{},area:{value:'unrelated filter'}};
 const discovery={journals:[{title:'Bragantia'}]};
 const context=vm.createContext({$:id=>fields[id],ALL:[journal],findJournalsByName:()=>[journal],presentAI:(...args)=>rendered.push(args),searchCrossref:async q=>{calls.push(q);return discovery;},searchCatalog:()=>[],researchPolicy:'',currentCriteria:()=>({}),metricLabels:{},metrics:r=>r,evaluateJournal:()=>({checks:[]}),AbortSignal,fetch:async(url,options)=>{calls.push(JSON.parse(options.body));if(fails)throw Error('offline');return {ok:true,json:async()=>({answer:'Orientação'})};}});
 await vm.runInContext(ask+';askAI()',context);
 assert.equal(calls[0],'Bragantia');assert.equal(calls[1].catalog[0].titulo,'Bragantia');
 assert.equal(rendered.length,2);assert.equal(rendered[0][2],null);assert.equal(rendered[1][2],discovery);assert.equal(rendered[1][3][0],journal);
 assert.equal(fields['ai-search-button'].disabled,false);assert.equal(fields['ai-loading'].hidden,true);
});
