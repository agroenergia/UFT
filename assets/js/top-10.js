const $=id=>document.getElementById(id),fmt=v=>v===null||v===undefined||v===""?"Não informado":String(v);
function safeUrl(value){try{const u=new URL(value);return["https:","http:"].includes(u.protocol)?u.href:""}catch{return""}}
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el}
function renderTen(journals,data){
 const top= (journals||[]).filter(r=>(!r.criterioPlanilha||r.criterioPlanilha.status==="selecao")&&r.citescore!==null&&r.citescore!==""&&Number.isFinite(Number(r.citescore))).sort((a,b)=>Number(b.citescore)-Number(a.citescore)||a.titulo.localeCompare(b.titulo,"pt-BR")).slice(0,10);
 const list=$("top-ten-list");list.replaceChildren();
 if(!top.length){$("report-status").textContent="A base ainda não tem CiteScores suficientes para montar este guia.";return}
 $("report-status").textContent=top.length+" revistas da seleção da planilha · CiteScores mais altos cadastrados";
 top.forEach((r,index)=>{
   const card=node("article","top-ten-card"),head=node("div","report-card-head"),rank=node("span","report-rank",String(index+1).padStart(2,"0")),badge=node("span","report-tier",r.tier||"Curadoria");
   head.append(rank,badge);card.append(head);card.append(node("h2","",r.titulo));card.append(node("p","report-area",r.area||"Área não informada"));
   const metrics=node("div","report-metrics");
   [["CiteScore",r.citescore],["Quartil SJR",r.sjr],["Fator de impacto",r.fatorImpacto]].forEach(([label,value])=>metrics.append(node("span","",label+": "+fmt(value))));
   card.append(metrics);card.append(node("p","report-scope",r.alinhamento||r.observacoes||r.escopo||"Escopo não preenchido na planilha."));
   const fields=node("dl","report-fields");[["Idioma",r.idioma],["Custo informado",r.custo]].forEach(([label,value])=>{if(value===null||value===undefined||value==="")return;const dt=node("dt","",label),dd=node("dd","",String(value));fields.append(dt,dd)});
   card.append(fields);
   const link=safeUrl(r.url_ficha||r.url);if(link){const a=node("a","report-link","Consultar site oficial ↗");a.href=link;a.target="_blank";a.rel="noopener noreferrer";card.append(a)}
   card.append(node("p","report-fit","Confira a adequação do manuscrito e todos os dados na ficha completa do catálogo."));
   list.append(card);
 });
 const source=node("p","report-source","Base consultada: "+(data.baseAtualizada||data.fonteArquivo||"planilhas do projeto")+".");
 list.insertAdjacentElement("afterend",source);
}
$("print-report").addEventListener("click",()=>window.print());
fetch("./assets/data/revistas.json",{cache:"no-store"}).then(response=>{if(!response.ok)throw Error("Não foi possível carregar o catálogo.");return response.json()}).then(data=>renderTen(data.revistas,data)).catch(error=>{$("report-status").textContent=error.message});

