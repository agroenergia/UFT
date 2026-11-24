import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../assets/js/app.js',import.meta.url),'utf8');
const ask=source.slice(source.indexOf('async function askAI(){'),source.indexOf('\nfunction scopusPercentile'));
for(const fails of [false,true])test('internal smart search renders base recommendations and calls Crossref'+(fails?' safely when Crossref fails':''),async()=>{
 const journal={titulo:'Bragantia',id:11},rendered=[],calls=[];
 const fields={'ai-question':{value:'Bragantia'},'ai-status':{},'ai-answer':{},'ai-loading':{},'ai-search-button':{},area:{value:'unrelated filter'}};
 const discovery={journals:[{title:'Bragantia'}]};
 const context=vm.createContext({$:id=>fields[id],ALL:[journal],findSmartCatalogMatches:()=>({isExactName:true,matches:[journal],relatedMatches:[],ordered:[{journal,score:10}],matchedLabels:[]}),presentAI:(...args)=>rendered.push(args),searchCrossref:async q=>{calls.push(q);if(fails)throw Error('offline');return discovery;},searchCatalog:()=>[journal],recordCustomAction:()=>{},window:{dispatchEvent:()=>{}},CustomEvent:class{constructor(t,d){this.type=t;this.detail=d?.detail;}}});
 await vm.runInContext(ask+';askAI()',context);
 assert.equal(calls[0],'Bragantia');
 assert.equal(rendered.length,2);assert.equal(rendered[0][2],null);assert.equal(rendered[1][3][0],journal);
 if(!fails)assert.equal(rendered[1][2],discovery);
 assert.equal(fields['ai-search-button'].disabled,false);assert.equal(fields['ai-loading'].hidden,true);
});
