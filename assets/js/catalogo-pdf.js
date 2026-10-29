import {metrics as normalizeMetrics,metricLabels,metricText} from "./criteria.js";
const $=id=>document.getElementById(id),fmt=v=>v===null||v===undefined||v===""?"Não informado":String(v);
const siteBase=new URL("./",document.querySelector('link[rel="canonical"]').href);
function safeUrl(value){try{const u=new URL(value);return["https:","http:"].includes(u.protocol)?u.href:""}catch{return""}}
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el}
function field(list,label,value,wide=false){if(value===null||value===undefined||value==="")return;const row=node("div",wide?"report-field wide":"report-field");row.append(node("dt","",label),node("dd","",String(value)));list.append(row)}
function renderCatalog(journals,data){
 const rank={selecao:0,confirmar:1,abaixo:2};
 const all=[...(journals||[])].sort((a,b)=>(rank[a.criterioPlanilha?.status]??1)-(rank[b.criterioPlanilha?.status]??1)||a.titulo.localeCompare(b.titulo,"pt-BR"));
 const list=$("catalog-report-list");list.replaceChildren();
 const checked=all.filter(r=>r.conferenciasOnline?.length).length;
 $("report-status").textContent=all.length+" revistas cadastradas · "+checked+" com campos conferidos · Atualização: "+(data.atualizadoEm||"Não informada");
 if(!all.length){$("report-status").textContent="O catálogo ainda não contém revistas.";return}
 all.forEach((r,index)=>{
   const card=node("article","report-journal");card.dataset.journalId=r.id;
   const head=node("div","report-card-head");head.append(node("span","report-number",String(index+1).padStart(2,"0")),node("span","report-status-label",r.enquadramento||"A confirmar"));card.append(head);
   card.append(node("h2","",r.titulo));if(r.area)card.append(node("p","report-area",r.area));
   const metrics=node("div","report-metrics");
   [["Quartil",r.sjr],["CiteScore",r.citescore],["Impacto",r.fatorImpacto]].forEach(([label,value])=>metrics.append(node("span","",label+": "+fmt(value))));card.append(metrics);
   const scope=r.alinhamento||r.escopo;if(scope)card.append(node("p","report-scope",scope));
   const fields=node("dl","report-fields");
   field(fields,"Editora",r.editora);field(fields,"ISSN",r.issn);field(fields,"Idioma",r.idioma);field(fields,"Modelo",r.modeloPublicacao);
   Object.entries(metricLabels).forEach(([k,v])=>field(fields,v,metricText(normalizeMetrics(r)[k])));field(fields,"Custos",r.custo,true);field(fields,"Tipos de artigo",r.tiposArtigo,true);
   field(fields,"Primeira decisão",r.prazoPrimeiraDecisao||(r.prazoPrimeiraDecisaoPlanilha?"Planilha: "+r.prazoPrimeiraDecisaoPlanilha:null));
   field(fields,"Aceitação informada",r.taxaAceitacaoPercentual==null?null:r.taxaAceitacaoPercentual+"%");
   card.append(fields);
   const links=node("div","report-links");
   const record=node("a","","Ficha completa e fontes ↗");record.href=new URL("ficha-revista.html?id="+encodeURIComponent(r.id),siteBase).href;record.target="_blank";record.rel="noopener noreferrer";links.append(record);
   const external=safeUrl(r.url_ficha||r.url);if(external){const a=node("a","",r.tipoLink?"Fonte externa ↗":"Página da revista ↗");a.href=external;a.target="_blank";a.rel="noopener noreferrer";links.append(a)}card.append(links);
   list.append(card);
 });
 $("print-report").disabled=false;
}
$("print-report").addEventListener("click",()=>window.print());
fetch("./assets/data/revistas.json",{cache:"no-store"}).then(response=>{if(!response.ok)throw Error("Não foi possível carregar o catálogo.");return response.json()}).then(data=>renderCatalog(data.revistas,data)).catch(error=>{$("report-status").textContent=error.message});
