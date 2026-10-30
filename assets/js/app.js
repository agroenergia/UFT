import {evaluateJournal} from "./eligibility.js";
import {journalAssessmentHTML} from "./criteria-ui.js";
import {metricLabels,filterIds,metrics,matchesCriteria,metricText,csvCell,researchPolicy} from "./criteria.js";
const currentCriteria=()=>Object.fromEntries(filterIds.map(id=>[id,document.getElementById(id)?.value||""]));
const DATA_URL="./assets/data/revistas.json";const $=id=>document.getElementById(id);const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));const fmt=v=>v===null||v===undefined||v===""?"Não informado":String(v);const safeUrl=u=>{try{const x=new URL(u);return ["https:","http:"].includes(x.protocol)?x.href:""}catch{return""}};let ALL=[],BASE="",SELECTED=new Set();function field(r,k){return r[k]??null}function priority(r){return {"ALTO":0,"MÉDIO":1,"COMPLEMENTAR":2}[r.tier]??3}let CATALOG_TOP10=false,CATALOG_VISIBLE=6;
const isSelection=r=>!r.criterioPlanilha||r.criterioPlanilha.status==="selecao";
const selectionCatalog=()=>ALL.filter(isSelection);
function matchesCost(r,filter){
  if(!filter)return true;
  const model=r.modeloCusto;
  if(filter==="sem")return model==="sem_apc"||model==="rota_assinatura";
  if(filter==="oa")return model==="apc";
  if(filter==="confirmar")return !model||model==="confirmar";
  return true;
}
function compactCost(r){return {sem_apc:"Sem APC",rota_assinatura:"Rota de assinatura",apc:"Com taxa",confirmar:"Valor a confirmar"}[r.modeloCusto]||"Valor a confirmar"}
function compactStatus(r){return r.statusConferencia==='Em conferência'?'Em conferência':({selecao:"Na seleção",abaixo:"Fora do recorte",confirmar:"A confirmar"}[r.criterioPlanilha?.status]||"A confirmar")}
function render(){
  let arr=searchCatalog();
  const order=$("ord").value;
  arr.sort((a,b)=>order==="percentil"?((metrics(b).maiorPercentil??-1)-(metrics(a).maiorPercentil??-1)||a.titulo.localeCompare(b.titulo,"pt-BR")):order==="nome"?a.titulo.localeCompare(b.titulo,"pt-BR"):order==="tier"?priority(a)-priority(b)||((Number(b.citescore)||0)-(Number(a.citescore)||0)):((Number(b.citescore)||0)-(Number(a.citescore)||0))||a.titulo.localeCompare(b.titulo,"pt-BR"));
  if(CATALOG_TOP10)arr=arr.filter(r=>isSelection(r)&&r.citescore!==null&&r.citescore!==""&&Number.isFinite(Number(r.citescore))).slice(0,10);
  $("count").textContent=arr.length+(arr.length===1?" revista encontrada":" revistas encontradas")+" de "+ALL.length;
  renderActiveFilters();
  const visible=arr.slice(0,CATALOG_VISIBLE);
  const expand=$("catalog-expand"),hasMore=visible.length<arr.length;expand.hidden=arr.length<=6;expand.setAttribute("aria-expanded",String(CATALOG_VISIBLE>6));expand.textContent=hasMore?"Ver mais "+Math.min(6,arr.length-visible.length)+" revistas ("+visible.length+" de "+arr.length+") ↓":"Mostrar apenas 6 registros ↑";
  $("lista").innerHTML=visible.map(r=>{
    const url=safeUrl(r.url_ficha||r.url);
    const metrics=[["Maior percentil",r.maiorPercentil===null?"A confirmar":r.maiorPercentil+"%"],["Quartil",r.sjr],["CiteScore",r.citescore],["Impacto",r.fatorImpacto]].filter(([,v])=>v!==null&&v!==undefined&&v!=="").map(([name,v])=>'<span><b>'+name+'</b> '+esc(v)+'</span>').join("");
    return '<article class="journal-card" id="revista-'+esc(r.id)+'"><div class="journal-card-top"><span class="tier criterion-badge status-'+esc(r.criterioPlanilha?.status||"confirmar")+'">'+esc(compactStatus(r))+'</span><label class="cmp"><input type="checkbox" data-id="'+esc(r.id)+'" '+(SELECTED.has(String(r.id))?"checked":"")+'> Comparar</label></div><h3>'+esc(r.titulo)+'</h3><p class="journal-area">'+esc(r.area||"Área não informada")+'</p><div class="journal-metrics">'+metrics+'</div><p class="journal-cost"><strong>Custo:</strong> '+esc(compactCost(r))+'</p>'+journalAssessmentHTML(r,esc,$("submission-date").value,$("publication-target").value)+'<div class="journal-actions journal-card-actions"><a class="journal-record-link" href="ficha-revista.html?id='+encodeURIComponent(r.id)+'" target="_blank" rel="noopener">Ficha completa ↗</a>'+(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+(r.tipoLink?"Fonte externa":"Site da revista")+' ↗</a>':"")+'</div></article>';
  }).join("")||'<div class="catalog-empty"><h3>Nenhuma revista com essas escolhas</h3><p>Algumas informações ainda estão em conferência. Remova uma escolha acima ou veja o catálogo completo.</p><button type="button" id="empty-clear">Ver todas as revistas</button></div>';
  if($("empty-clear"))$("empty-clear").onclick=()=>$("limpar").click();
  renderCompare();
}
function renderActiveFilters(){
 const target=$("active-filters");target.replaceChildren();
 for(const id of ["q","area","idioma","custo",...filterIds,"sjr","score","criterio"]){
  const field=$(id);if(!field.value)continue;
  const button=document.createElement("button"),value=field.selectedOptions?.[0]?.textContent||field.value;
  const label=(field.dataset.filterLabel||id)+": "+value;
  button.type="button";button.textContent=label+" ×";button.setAttribute("aria-label","Remover filtro "+label);
  button.onclick=()=>{field.value="";CATALOG_VISIBLE=6;CATALOG_TOP10=false;render();$(id).focus()};target.append(button);
 }
 if($("program-only").checked){const button=document.createElement("button");button.type="button";button.textContent="Quatro critérios conferidos ×";button.setAttribute("aria-label","Remover filtro dos quatro critérios");button.onclick=()=>{$("program-only").checked=false;CATALOG_VISIBLE=6;render();$("program-only").focus()};target.append(button)}
 target.hidden=!target.childElementCount;
}
function renderCompare(){
  const arr=ALL.filter(r=>SELECTED.has(String(r.id)));
  $("cmp-tabela").innerHTML=arr.length?'<table><caption class="sr-only">Revistas selecionadas no catálogo</caption><thead><tr><th scope="col">Indicador</th>'+arr.map(r=>'<th scope="col">'+esc(r.titulo)+'</th>').join("")+'</tr></thead><tbody>'+[["Área","area"],...Object.entries(metricLabels).map(([k,v])=>[v,k]),["Quartil","sjr"],["CiteScore","citescore"],["Impacto","fatorImpacto"],["Idioma","idioma"],["Custo","custo"]].map(([label,key])=>'<tr><th scope="row">'+label+'</th>'+arr.map(r=>'<td>'+esc(metricText(r[key]))+'</td>').join("")+'</tr>').join("")+'</tbody></table>':'<p class="compare-hint">Marque “Comparar” nos cartões do <a href="#revistas">catálogo</a> para visualizar as revistas aqui.</p>';
}
const JOURNAL_FIELD_LABELS={...metricLabels,id:"Identificador no catálogo",titulo:"Revista",area:"Área",sjr:"Quartil SJR informado",idioma:"Idioma",custo:"Custo informado",alinhamento:"Alinhamento com a pesquisa",url:"Site da revista",url_ficha:"Link da ficha",tier:"Faixa de curadoria",citescore:"CiteScore informado",fatorImpacto:"Fator de impacto informado",issn:"ISSN",editora:"Editora",escopo:"Escopo editorial informado",observacoes:"Observações",check:"Adequação do manuscrito",pergunta:"Pergunta-chave de adequação",obrigatorios:"Requisitos importantes",evitar:"Quando esta revista pode não ser adequada",ano:"Ano do indicador",fonte:"Fonte",fonteIndicador:"Fonte do indicador",baseAtualizada:"Referência da base"};
Object.assign(JOURNAL_FIELD_LABELS,{"enquadramento": "Enquadramento na planilha", "criterioPlanilha": "Critério da planilha", "status": "Situação", "regra": "Regra aplicada", "anoQuartil": "Ano do quartil informado", "indicadoresPlanilha": "Indicadores originais da planilha", "anoOutrosIndicadores": "Ano dos demais indicadores", "indiceSjr": "Índice SJR (valor)", "fatorImpacto5Anos": "Fator de impacto de 5 anos", "snip": "SNIP", "articleInfluenceScore": "Article Influence Score", "fontesCadastro": "Fontes de cadastro", "arquivo": "Arquivo de origem", "aba": "Aba", "linha": "Linha", "campos": "Campos", "documentosEquipe": "Documentos da equipe", "tipo": "Tipo", "conferencia": "Situação da conferência", "conferenciasOnline": "Campos conferidos em fontes online", "consultadoEm": "Data da consulta", "anoIndicador": "Ano de referência do indicador", "correcoesDocumentadas": "Correções documentadas", "campo": "Campo", "anterior": "Valor anterior", "atual": "Valor atualizado", "pendenciasConferencia": "Pendências de conferência", "valorPlanilha": "Valor da planilha", "valorObservadoOnline": "Valor observado na fonte online", "motivo": "Motivo da pendência", "atualizadoEm": "Cadastro atualizado em", "statusConferencia": "Situação da conferência", "origemCadastro": "Origem do cadastro", "modeloCusto": "Modelo de custo", "modeloPublicacao": "Modelo de publicação", "tiposArtigo": "Tipos de artigo", "limiteManuscrito": "Limite do manuscrito", "prazoPrimeiraDecisao": "Primeira decisão informada pela editora", "prazoPrimeiraDecisaoPlanilha": "Primeira decisão / estimativa da planilha", "prazoPublicacaoPlanilha": "Prazo de publicação / estimativa da planilha", "taxaAceitacaoPercentual": "Taxa de aceitação (%)", "urlInstrucoes": "Instruções aos autores", "dicasEquipe": "Orientações da equipe", "observacaoVarredura": "Observação da varredura", "situacaoOriginalPlanilha": "Situação original na planilha", "tipoLink": "Tipo de endereço externo", "anotacaoEquipe": "Anotação da equipe", "origem": "Origem geográfica", "observacao": "Observação"});
JOURNAL_FIELD_LABELS.url="Página do periódico ou fonte de identificação";
function fullRecordEntries(value,prefix=""){
  const entries=[];
  Object.entries(value||{}).forEach(([key,item])=>{
    const label=JOURNAL_FIELD_LABELS[key]||key.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/^./,c=>c.toLocaleUpperCase("pt-BR"));
    const pathLabel=prefix?prefix+" · "+label:label;
    if(item===null||item===undefined||item==="")return;
    if(Array.isArray(item)){item.forEach((v,i)=>{if(typeof v==="object"&&v!==null)entries.push(...fullRecordEntries(v,pathLabel+" · "+(i+1)));else entries.push([pathLabel,String(v)])});return}
    if(typeof item==="object"){entries.push(...fullRecordEntries(item,pathLabel));return}
    const value=key==="modeloCusto"?({apc:"Com cobrança informada",sem_apc:"Sem APC",rota_assinatura:"Rota de assinatura informada",confirmar:"Custo a confirmar"}[item]||item):key==="status"?({selecao:"Seleção da planilha",abaixo:"Fora do recorte da planilha",confirmar:"Enquadramento a confirmar"}[item]||item):item;
    entries.push([pathLabel,String(value)]);
  });
  return entries;
}
function makeFullRecord(r){
  const entries=fullRecordEntries(r);const details=document.createElement("details");details.className="ai-full-record";
  const summary=document.createElement("summary");summary.textContent="Ver ficha completa · "+entries.length+" dados";details.append(summary);
  const intro=document.createElement("p");intro.className="ai-full-record-note";intro.textContent="Todos os campos preenchidos para esta revista no catálogo do projeto. Campos em branco não foram cadastrados.";details.append(intro);
  const list=document.createElement("dl");list.className="ai-full-record-list";
  entries.forEach(([label,value])=>{const row=document.createElement("div");row.className="ai-full-record-row";const term=document.createElement("dt");term.textContent=label;const desc=document.createElement("dd");const link=safeUrl(value);if(link){const a=document.createElement("a");a.href=link;a.target="_blank";a.rel="noopener noreferrer";a.textContent=value;desc.append(a)}else desc.textContent=value;row.append(term,desc);list.append(row)});
  details.append(list);return details;
}

const CROSSREF_API="https://api.crossref.org/works";
const SEARCH_STOPWORDS=new Set(["a","ao","aos","as","de","da","das","do","dos","e","em","na","nas","no","nos","para","por","que","qual","quais","um","uma","uns","umas","meu","minha","meus","minhas","artigo","revista","revistas","periodico","periodicos","publicar","publicacao","pesquisa","pesquisas","sobre","com","como","sao","tem","sem","mais","melhor","opcao","opcoes","site","catalogo","encontrar"]);
function normalizeSearchText(text){return String(text||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR")}
function journalQuestionScore(journal,question){
  const terms=normalizeSearchText(question).split(/[^a-z0-9]+/).filter(t=>(t.length>2||["ia","iot","ai"].includes(t))&&!SEARCH_STOPWORDS.has(t));
  const groups=[
    ["bioenergia","bioenergy","biomassa","biomass","biocombustivel","biocombustiveis","etanol","biodiesel","biofuel","agroenergia"],
    ["energia","energetica","energetico","energias","energy","renewable","renovavel","renovaveis","solar","eolica","hidrogenio","combustivel"],
    ["agricultura","agricola","agricolas","agro","agraria","agrarias","agronomia","cultivo","lavoura","agriculture","agricultural","farming","crop"],
    ["inteligencia","artificial","machine","learning","ia","computacao","digital","sensor","sensores","iot","automacao","algoritmo","computers"],
    ["sustentabilidade","sustentavel","sustainability","sustainable","ambiente","ambiental","environment","environmental","clima","climate","emissoes","circular","cleaner"],
    ["solo","agua","planta","plantas","soil","water","plant","irrigacao","irrigation","manejo","agroecologia"],
    ["gestao","management","residuo","residuos","waste","economia","circular","governanca","policy"]
  ];
  const normalized=normalizeSearchText([journal.titulo,journal.area,journal.alinhamento,journal.observacoes,journal.escopo,journal.check&&Object.values(journal.check).join(" ")].join(" "));
  let score=0;terms.forEach(term=>{if(normalized.includes(term))score+=normalized.includes(normalizeSearchText(journal.titulo))&&normalizeSearchText(journal.titulo).includes(term)?4:1});
  groups.forEach(group=>{if(terms.some(term=>group.some(word=>word===term||word.startsWith(term)&&term.length>4))&&group.some(word=>normalized.includes(word)))score+=2});
  return score;
}
function orderCatalogForQuestion(question){
  return searchCatalog().map(r=>({journal:r,score:journalQuestionScore(r,question)}))
    .sort((a,b)=>Number(isSelection(b.journal))-Number(isSelection(a.journal))||b.score-a.score||(priority(a.journal)-priority(b.journal))||a.journal.titulo.localeCompare(b.journal.titulo,"pt-BR"));
}
const PORTAL_TOPIC_GROUPS=[
 ["agroenergia","agroenergy","agricultura","agricultural","agriculture","agronomia","agronomy","agro","cultivo","crop","farm","agroindustrial"],
 ["bioenergia","bioenergy","biomassa","biomass","biocombustivel","biofuel","etanol","ethanol","biodiesel","biorefinery","biorrefinaria"],
 ["energia","energy","renewable","renovavel","renovaveis","solar","eolica","wind","biofuel","hidrogenio","hydrogen","combustivel","fuel"],
 ["sustentabilidade","sustainability","sustainable","sustentavel","cleaner","production","producao","circular","environmental","ambiental"],
 ["ambiente","environment","environmental","ambiental","climate","clima","ecosystem","ecossistema","emissions","emissoes"],
 ["solo","soil","agua","water","irrigacao","irrigation","plant","planta","plantas","forestry","floresta","manejo"],
 ["residuo","residuos","waste","wastewater","recycling","reciclagem","geoscience","geociencia","biosystem","biossistema"]
];
const PORTAL_SCOPE_TERMS=["agro","agricultur","agronom","farm","crop","bioenerg","biomass","biofuel","ethanol","biodiesel","energy","renewab","sustainab","cleaner","environment","ecosystem","emission","soil","irrigat","waste","forestr","plant","biosystem","geoscien","carbon","climate","water","circular"];
function termsFromQuestion(question){return normalizeSearchText(question).split(/[^a-z0-9]+/).filter(t=>t.length>3&&!SEARCH_STOPWORDS.has(t))}
function crossrefItemMatches(item,question){
  const title=(item.title||[]).join(" "),journal=(item["container-title"]||[]).join(" "),subjects=(item.subject||[]).join(" ");
  const text=normalizeSearchText([title,journal,subjects].join(" "));
  const inScope=PORTAL_SCOPE_TERMS.some(term=>text.includes(term));
  if(!inScope)return false;
  const terms=termsFromQuestion(question);
  const matchedGroup=PORTAL_TOPIC_GROUPS.some(group=>group.some(term=>terms.some(q=>term===q||term.startsWith(q)||q.startsWith(term)))&&group.some(term=>text.includes(term)));
  const directMatch=terms.some(term=>term.length>4&&text.includes(term));
  return matchedGroup||directMatch;
}
async function searchCrossref(question){
  const phrase=String(question||"").trim(),terms=termsFromQuestion(phrase);
  const expandedQuery=phrase+(/biomassa|bioenergia|agroenergia/i.test(phrase)?" biomass bioenergy agriculture":"");
  if(terms.length===0)return {journals:[],error:null,query:phrase,fromYear:new Date().getFullYear()-4};
  const fromYear=new Date().getFullYear()-4;
  const params=new URLSearchParams({"query.bibliographic":expandedQuery.slice(0,300),filter:"from-pub-date:"+fromYear+"-01-01,type:journal-article",rows:"100",select:"DOI,title,container-title,URL,published,published-print,published-online,publisher,type,subject",sort:"relevance",order:"desc"});
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);let response;
  try{response=await fetch(CROSSREF_API+"?"+params.toString(),{headers:{Accept:"application/json"},cache:"no-store",signal:controller.signal})}finally{clearTimeout(timeout)}
  if(!response.ok)throw new Error("A busca bibliográfica respondeu com erro HTTP "+response.status);
  const payload=await response.json(),items=payload&&payload.message&&payload.message.items||[],groups=new Map();
  items.filter(item=>crossrefItemMatches(item,phrase)).forEach(item=>{
    const title=Array.isArray(item["container-title"])?item["container-title"][0]:"";if(!title||!item.DOI)return;
    const key=normalizeSearchText(title),entry=groups.get(key)||{title,count:0,publisher:item.publisher||"",papers:[]};
    entry.count++;if(!entry.publisher&&item.publisher)entry.publisher=item.publisher;
    const dates=[item.published,item["published-online"],item["published-print"],item.issued].filter(Boolean);
    const year=dates.map(d=>d["date-parts"]&&d["date-parts"][0]&&d["date-parts"][0][0]).find(Boolean)||"";
    entry.papers.push({title:Array.isArray(item.title)?item.title[0]:"",doi:item.DOI,url:"https://doi.org/"+encodeURIComponent(item.DOI),year});
    groups.set(key,entry);
  });
  const known=new Set(ALL.map(r=>normalizeSearchText(r.titulo)));
  const journals=[...groups.values()].sort((a,b)=>b.count-a.count||a.title.localeCompare(b.title,"en")).slice(0,6).map(g=>({...g,inCatalog:known.has(normalizeSearchText(g.title)),papers:g.papers.slice(0,2)}));
  return {journals:journals.filter(j=>!j.inCatalog||searchCatalog().some(r=>normalizeSearchText(r.titulo)===normalizeSearchText(j.title))),error:null,fromYear,query:phrase};
}
function makeAllCatalogSection(question){
  const details=document.createElement("details");details.className="ai-catalog-expansion";
  const ordered=orderCatalogForQuestion(question),summary=document.createElement("summary");
  summary.textContent="Ver as "+ordered.length+" revistas nos filtros ativos";
  details.append(summary);
  const note=document.createElement("p");note.className="ai-catalog-note";note.textContent="Esta lista respeita os filtros ativos do catálogo. Os títulos aparecem por proximidade temática estimada com sua pergunta; essa ordem não é um ranking de qualidade nem informa percentil CAPES. Ajuste os filtros na seção Catálogo para ampliar a pesquisa.";details.append(note);
  const grid=document.createElement("div");grid.className="ai-catalog-grid";
  ordered.forEach(({journal:r,score})=>{
    const card=document.createElement("article");card.className="ai-catalog-card";
    const title=document.createElement("h4");title.textContent=r.titulo;card.append(title);
    const relation=document.createElement("span");relation.className=score?"catalog-relevance direct":"catalog-relevance adjacent";relation.textContent=score?"Tema relacionado à busca":"Tema próximo à área do projeto";card.append(relation);const criterion=document.createElement("p");criterion.className="catalog-criterion status-"+(r.criterioPlanilha?.status||"confirmar");criterion.textContent=r.enquadramento||"Enquadramento a confirmar";card.append(criterion);
    const area=document.createElement("p");area.textContent=r.area||"Área não informada";card.append(area);
    const description=document.createElement("p");description.textContent=r.alinhamento||r.observacoes||r.escopo||"O catálogo não contém descrição de escopo para esta revista.";card.append(description);
    const metrics=document.createElement("p");metrics.className="ai-catalog-metrics";metrics.textContent="SJR: "+fmt(r.sjr)+" · CiteScore: "+fmt(r.citescore)+" · Idioma: "+fmt(r.idioma);card.append(metrics);
    const cost=document.createElement("p");cost.className="ai-catalog-cost";cost.textContent="Custo informado: "+fmt(r.custo);card.append(cost);
    card.append(makeFullRecord(r));
    const url=safeUrl(r.url_ficha||r.url);if(url){const a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Abrir site da revista ↗";card.append(a)}
    grid.append(card);
  });
  details.append(grid);return details;
}
function appendCrossrefResults(parent,discovery){
  const section=document.createElement("section");section.className="ai-web-discovery";
  const kicker=document.createElement("span");kicker.className="external-stage-kicker";kicker.textContent="BUSCA COMPLEMENTAR NA INTERNET";section.append(kicker);
  const heading=document.createElement("h3");heading.textContent="Resultados encontrados na internet";section.append(heading);
  const internetJournals=discovery&&discovery.journals||[],knownCount=internetJournals.filter(j=>j.inCatalog).length,newCount=internetJournals.filter(j=>!j.inCatalog).length,summary=document.createElement("p");summary.className="ai-result-summary";
  summary.textContent="Na busca pela internet: "+internetJournals.length+" revistas relacionadas · "+knownCount+" já estão na base · "+newCount+" são novas sugestões.";
  section.append(summary);
  const criteriaNote=document.createElement("p");criteriaNote.textContent="Preferências para conferir: "+filterIds.filter(id=>$(id).value).map(id=>(($(id).dataset.filterLabel||id)+": "+($(id).selectedOptions?.[0]?.textContent||$(id).value))).join(" · ");if(filterIds.some(id=>$(id).value))section.append(criteriaNote);
  const lead=document.createElement("p");lead.className="ai-web-note";
  if(discovery&&discovery.journals&&discovery.journals.length){
    const query=document.createElement("p");query.className="external-search-query";query.append(document.createTextNode("Busca por: "));const strong=document.createElement("strong");strong.textContent=discovery.query||"tema da pergunta";query.append(strong);section.append(query);
    lead.textContent="Esta área mostra revistas encontradas em referências de artigos recentes. Elas podem já estar na base do projeto ou ser novas sugestões; os resultados não atestam qualidade, escopo, taxas ou aceitação.";section.append(lead);
    const source=document.createElement("a");source.href="https://www.crossref.org/documentation/retrieve-metadata/rest-api/";source.target="_blank";source.rel="noopener noreferrer";source.className="ai-source-link";source.textContent="Como são encontradas estas sugestões?";section.append(source);
    const list=document.createElement("div");list.className="ai-web-journals";
    discovery.journals.forEach(journal=>{
      const card=document.createElement("article");card.className="ai-web-journal";
      const label=document.createElement("span");label.className="external-result-label";label.textContent=journal.inCatalog?"NO CATÁLOGO":"SUGESTÃO DA INTERNET";card.append(label);
      const title=document.createElement("h4");title.textContent=journal.title;card.append(title);
      const badge=document.createElement("span");badge.className=journal.inCatalog?"origin-internal":"origin-external";badge.textContent=journal.inCatalog?"No catálogo":"Conferir antes de usar";card.append(badge);
      const pending=document.createElement("p");pending.textContent="Candidata a verificar: confirmar Scopus/WoS, percentis CiteScore/JIF e H, estrato, análise antipredatória, escopo, idioma, APC, acordo CAPES e prazo nas fontes oficiais. O Crossref não fornece essas comprovações.";card.append(pending);
      const meta=document.createElement("p");meta.className="external-result-meta";meta.textContent=journal.count+" artigos relacionados"+(journal.publisher?" · "+journal.publisher:"");card.append(meta);
      journal.papers.forEach(paper=>{if(!paper.title)return;const p=document.createElement("p");p.className="ai-web-paper";const link=document.createElement("a");link.href=paper.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent=paper.title+" ↗";p.append(link);const year=document.createElement("span");year.textContent=paper.year?" ("+paper.year+")":"";p.append(year);card.append(p)});
      list.append(card);
    });
    section.append(list);
  }else{
    lead.textContent=discovery&&discovery.error?"A busca na internet não ficou disponível nesta tentativa. As revistas do catálogo continuam acessíveis abaixo.":"Não foram encontradas sugestões externas relacionadas ao tema desta busca. Tente termos mais específicos.";section.append(lead);
  }
  parent.append(section);
}
function presentAI(raw,question,discovery){
  const el=$("ai-answer");el.replaceChildren();const wrap=document.createElement("div");wrap.className="ai-rich";
  const heading=document.createElement("h3");heading.textContent="Orientação para sua publicação";wrap.append(heading);
  const matched=searchCatalog().filter(r=>String(raw).toLocaleLowerCase("pt-BR").includes(String(r.titulo).toLocaleLowerCase("pt-BR")));
  const baseSection=document.createElement("section");baseSection.className="ai-base-results";
  const baseHeading=document.createElement("h3");baseHeading.textContent="Na base do projeto";baseSection.append(baseHeading);
  const baseSummary=document.createElement("p");baseSummary.className="ai-base-summary";
  baseSummary.textContent=matched.length+(matched.length===1?" revista da base mencionada":" revistas da base mencionadas")+" nesta orientação · "+selectionCatalog().length+" na seleção da planilha · "+ALL.length+" cadastradas no total, incluindo registros fora do recorte ou a confirmar.";baseSection.append(baseSummary);
  if(matched.length){
    const grid=document.createElement("div");grid.className="ai-rich-grid";
    matched.forEach(r=>{const card=document.createElement("article");card.className="ai-rich-card";const name=document.createElement("h4");name.textContent=r.titulo;card.append(name);card.append(makeFullRecord(r));const origin=document.createElement("span");origin.className="origin-internal";origin.textContent="Base do projeto";card.append(origin);const area=document.createElement("p");area.textContent=r.area||"Área não informada";card.append(area);const metrics=document.createElement("p");metrics.className="ai-rich-metrics";metrics.textContent="SJR: "+fmt(r.sjr)+" · CiteScore: "+fmt(r.citescore);card.append(metrics);const cost=document.createElement("p");cost.textContent="Custo informado: "+fmt(r.custo);card.append(cost);const url=safeUrl(r.url_ficha||r.url);if(url){const a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Abrir site da revista ↗";card.append(a);}grid.append(card)});
    baseSection.append(grid);
  }else{
    const empty=document.createElement("p");empty.className="ai-base-empty";empty.textContent="A orientação não citou um título específico da base. Consulte os registros dos filtros ativos abaixo; amplie os filtros se a lista estiver vazia.";baseSection.append(empty);
  }
  baseSection.append(makeAllCatalogSection(question));wrap.append(baseSection);
  appendCrossrefResults(wrap,discovery);
  const details=document.createElement("details");details.className="ai-explanation";details.open=!matched.length;
  const summary=document.createElement("summary");summary.textContent="Ver a explicação completa da orientação";details.append(summary);
  const body=document.createElement("div");body.className="ai-explanation-text";body.textContent=raw;details.append(body);wrap.append(details);
  const note=document.createElement("p");note.className="source-disclaimer";note.textContent="As informações da base refletem o cadastro atual do projeto. Quartil SJR não comprova percentil CAPES nem elegibilidade do artigo; confira indicadores, escopo e taxas nas fontes oficiais.";wrap.append(note);
  el.append(wrap);
}
function searchCatalog(){return ALL.filter(r=>(!$("program-only").checked||evaluateJournal(r).state==="pass")&&matchesCriteria(r,currentCriteria())&&(!$("criterio").value||r.criterioPlanilha?.status===$("criterio").value)&&(!$("area").value||r.area===$("area").value)&&(!$("sjr").value||r.sjr===$("sjr").value)&&(!$("idioma").value||String(r.idioma||"").includes($("idioma").value))&&matchesCost(r,$("custo").value)&&(!$("score").value||Number(r.citescore)>=Number($("score").value))&&(!$("q").value||normalizeSearchText([r.titulo,r.area,r.issn,r.escopo,r.alinhamento,r.observacoes,r.editora,...(r.check?Object.values(r.check):[])].join(" ")).includes(normalizeSearchText($("q").value))))}
async function askAI(){
  const question=$("ai-question").value.trim(),status=$("ai-status"),answer=$("ai-answer");if(!question)return;
  status.hidden=false;status.textContent="Consultando o catálogo e buscando novas possibilidades na internet…";answer.textContent="";
  $("ai-loading").hidden=false;$("ai-search-button").disabled=true;$("ai-search-button").textContent="Pesquisando…";
  const webPromise=searchCrossref(question+" "+$("area").value).catch(error=>({journals:[],error:error.message,fromYear:new Date().getFullYear()-4}));
  let aiText="",aiError="";
  try{
    const resp=await fetch("https://muddy-field-7b19.michael-oliveira.workers.dev/api/search",{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(30000),body:JSON.stringify({question:researchPolicy+"\nFiltros ativos: "+JSON.stringify(currentCriteria())+"\nPergunta: "+question,catalog:searchCatalog().map(r=>({...Object.fromEntries(Object.keys(metricLabels).map(k=>[k,metrics(r)[k]??null])),evidenciasMetricas:r.evidenciasMetricas,titulo:r.titulo,area:r.area,escopo:r.alinhamento||r.observacoes||r.escopo,idioma:r.idioma,sjr:r.sjr,custo:r.custo,citescore:r.citescore,fatorImpacto:r.fatorImpacto,enquadramento:r.enquadramento,conferencia:r.statusConferencia,url:r.url_ficha||r.url}))})});
    const data=await resp.json().catch(()=>({}));if(!resp.ok)throw Error(data.error||"Falha no serviço de IA");aiText=data.answer||"Sem resposta.";
  }catch(error){aiError=error.message||"Falha no serviço de IA";aiText="O assistente de IA está indisponível nesta tentativa. Consulte as revistas relacionadas do catálogo e as referências bibliográficas recentes abaixo."}
  const discovery=await webPromise;presentAI(aiText,question,discovery);
  status.textContent=aiError?"IA indisponível; busca externa e catálogo disponíveis quando carregados. Erro: "+aiError:
    discovery.error?"Busca na internet indisponível nesta tentativa. O catálogo completo continua disponível abaixo.":
    "Pesquisa concluída. Use os rótulos “No catálogo” e “Conferir antes de usar” para identificar a origem dos títulos.";
  $("ai-loading").hidden=true;$("ai-search-button").disabled=false;$("ai-search-button").textContent="Pesquisar";
}
function exportCsv(){const cols=[...Object.keys(metricLabels),"titulo","enquadramento","area","editora","issn","sjr","indiceSjr","idioma","custo","modeloPublicacao","alinhamento","escopo","tiposArtigo","citescore","fatorImpacto","fatorImpacto5Anos","snip","taxaAceitacaoPercentual","prazoPrimeiraDecisao","prazoPrimeiraDecisaoPlanilha","url","urlInstrucoes","atualizadoEm","statusConferencia","evidenciasMetricas","fontesCadastro","conferenciasOnline","pendenciasConferencia"];const csv=[['marca',...cols].map(csvCell).join(';'),...ALL.map(r=>['RigorAtlas',...cols.map(k=>r[k])].map(csvCell).join(';'))].join('\r\n');const a=document.createElement("a");const u=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.href=u;a.download="RigorAtlas-catalogo-"+new Date().toISOString().slice(0,10)+".csv";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}
const JOURNAL_COVERS={
  5:"https://ars.els-cdn.com/content/image/X09596526.jpg",
  4:"https://ars.els-cdn.com/content/image/X09601481.jpg",
  1:"https://ars.els-cdn.com/content/image/X01681699.jpg",
  10:"https://ars.els-cdn.com/content/image/X03014797.jpg",
  14:"https://ars.els-cdn.com/content/image/X01678809.jpg"
};
function featuredSelection(rows){
  return rows.filter(r=>isSelection(r)&&r.citescore!==null && r.citescore!=="" && Number.isFinite(Number(r.citescore)))
    .sort((a,b)=>Number(b.citescore)-Number(a.citescore)||a.titulo.localeCompare(b.titulo,"pt-BR")).slice(0,5);
}
function renderFeatured(){
  const target=$("featured-journals");if(!target)return;
  target.innerHTML=featuredSelection(ALL).map((r,i)=>'<a class="featured-journal" href="#revista-'+esc(r.id)+'" data-featured-id="'+esc(r.id)+'"><span class="cover-miniature"><span class="cover-fallback" aria-hidden="true"><span>REVISTA</span><b>'+esc(r.titulo)+'</b><i></i></span>'+(JOURNAL_COVERS[r.id]?'<img src="'+esc(JOURNAL_COVERS[r.id])+'" alt="Capa de '+esc(r.titulo)+'" width="66" height="88" loading="lazy" referrerpolicy="no-referrer">':'')+'</span><span class="featured-info"><span class="featured-rank">0'+(i+1)+' · '+esc(fmt(r.sjr))+'</span><strong>'+esc(r.titulo)+'</strong><span class="featured-score">CiteScore <b>'+esc(fmt(r.citescore))+'</b></span><span class="featured-link">Ver no catálogo ↗</span></span></a>').join("")||"<p>Nenhum destaque disponível na seleção atual.</p>";
  target.querySelectorAll("img").forEach(img=>img.addEventListener("error",()=>{img.hidden=true;img.alt="";}));
  target.addEventListener("click",event=>{
    const link=event.target.closest("[data-featured-id]");if(!link)return;
    const journal=ALL.find(r=>String(r.id)===link.dataset.featuredId);if(!journal)return;
    event.preventDefault();
    $("program-only").checked=false;CATALOG_TOP10=false;[...filterIds,"criterio","area","sjr","idioma","custo","score"].forEach(id=>$(id).value="");$("q").value=journal.titulo;render();
    const card=$("revista-"+journal.id);if(card){card.tabIndex=-1;card.focus({preventScroll:true});card.scrollIntoView({behavior:"smooth",block:"start"});}
  });
}
function setupBanner(){
  document.querySelectorAll("[data-search-prompt]").forEach(button=>button.addEventListener("click",()=>{
    $("ai-question").value=button.dataset.searchPrompt;
    $("ai-question").focus({preventScroll:true});$("ai-question").scrollIntoView({behavior:"smooth",block:"center"});
  }));
  document.querySelectorAll("[data-focus-search]").forEach(link=>link.addEventListener("click",event=>{
    event.preventDefault();$("ai-question").focus({preventScroll:true});$("ai-question").scrollIntoView({behavior:"smooth",block:"center"});
  }));
}

function setupHeaderMenu(){
  const header=document.querySelector(".site-header"),toggle=$("menu-toggle"),nav=$("primary-navigation");
  if(!header||!toggle||!nav)return;
  function setOpen(open,restoreFocus=false){
    nav.hidden=!open;toggle.setAttribute("aria-expanded",String(open));
    if(restoreFocus)toggle.focus();
  }
  toggle.addEventListener("click",()=>setOpen(nav.hidden));
  nav.addEventListener("click",event=>{if(event.target.closest("a"))setOpen(false)});
  document.addEventListener("click",event=>{if(!nav.hidden&&!nav.contains(event.target)&&!toggle.contains(event.target))setOpen(false)});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!nav.hidden){setOpen(false,true);event.preventDefault()}});
  document.addEventListener("focusin",event=>{if(!nav.hidden&&!header.contains(event.target))setOpen(false)});
  const updateOffset=()=>document.documentElement.style.setProperty("--header-offset",(Math.ceil(header.getBoundingClientRect().height)+14)+"px");
  updateOffset();
  if(typeof ResizeObserver!=="undefined")new ResizeObserver(updateOffset).observe(header);
  else window.addEventListener("resize",updateOffset);
}

async function init(){
  const res=await fetch(DATA_URL,{cache:"no-store",signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error("Não foi possível carregar a base de revistas");
  const data=await res.json();if(!Array.isArray(data.revistas)||data.revistas.some(r=>!r||typeof r.titulo!=="string"))throw Error("Formato do catálogo inválido");ALL=data.revistas.map((r,i)=>metrics({...r,id:r.id??i+1}));
  $("metric-coverage").textContent=ALL.filter(r=>r.maiorPercentil!==null).length+" de "+ALL.length+" registros com percentil CiteScore/JIF numérico. Campos ausentes exigem conferência na fonte; quartil e pontuação não foram convertidos em percentil.";
  BASE=data.fonteArquivo||data.baseAtualizada||"base do projeto";
  const checked=ALL.filter(r=>Array.isArray(r.conferenciasOnline)&&r.conferenciasOnline.length).length;
  $("catalog-summary").textContent=ALL.length+" revistas para explorar e comparar";$("selecao-option").textContent="Seleção da equipe ("+selectionCatalog().length+")";
  if(/^#revista-/.test(location.hash)){$("criterio").value="";CATALOG_VISIBLE=Infinity;}
  [...new Set(ALL.map(r=>r.area).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR")).forEach(v=>$("area").add(new Option(v,v)));
  const resetTop10=()=>{CATALOG_TOP10=false;CATALOG_VISIBLE=6;document.querySelectorAll("[data-fast-filter]").forEach(b=>b.setAttribute("aria-pressed","false"))};
  [...filterIds,"q","criterio","area","sjr","idioma","custo","score","ord"].forEach(id=>$(id).addEventListener("input",()=>{resetTop10();render()}));
  $("limpar").onclick=()=>{$("program-only").checked=false;[...filterIds,"q","criterio","area","sjr","idioma","custo","score"].forEach(id=>$(id).value="");resetTop10();render()};
  document.querySelectorAll("[data-fast-filter]").forEach(button=>button.addEventListener("click",()=>{
    [...filterIds,"q","criterio","area","sjr","idioma","custo","score"].forEach(id=>$(id).value="");
    CATALOG_TOP10=false;CATALOG_VISIBLE=6;
    const filter=button.dataset.fastFilter;
    if(filter!=="clear"&&filter!=="all")$("criterio").value="selecao";
    if(filter==="q1")$("sjr").value="Q1";
    if(filter==="sem")$("custo").value="sem";
    if(filter==="portugues")$("idioma").value="Português";
    if(filter==="top10"){CATALOG_TOP10=true;$("ord").value="citescore"}
    document.querySelectorAll("[data-fast-filter]").forEach(b=>b.setAttribute("aria-pressed",String(filter!=="clear"&&b===button)));
    render();$("lista").scrollIntoView({behavior:"smooth",block:"start"});
  }));
  ["program-only","submission-date","publication-target"].forEach(id=>$(id).addEventListener("change",()=>{CATALOG_VISIBLE=6;render()}));
  $("catalog-expand").addEventListener("click",()=>{CATALOG_VISIBLE=CATALOG_VISIBLE<$("count").textContent.match(/\d+/)[0]?CATALOG_VISIBLE+6:6;render();if(CATALOG_VISIBLE===6)$("revistas").scrollIntoView({behavior:"smooth",block:"start"})});
  $("lista").addEventListener("change",e=>{const id=e.target.dataset.id;if(!id)return;if(e.target.checked){if(SELECTED.size>=4){e.target.checked=false;alert("Selecione até quatro revistas.");return}SELECTED.add(id)}else SELECTED.delete(id);renderCompare()});
  $("csv").onclick=exportCsv;$("ai-search-form").addEventListener("submit",e=>{e.preventDefault();askAI()});
  const predatoryToggle=$("predatory-toggle"),predatoryDetails=$("predatory-details");predatoryToggle.addEventListener("click",()=>{const open=predatoryDetails.hidden;predatoryDetails.hidden=!open;predatoryToggle.setAttribute("aria-expanded",String(open));predatoryToggle.textContent=open?"Ocultar sinais de alerta":"Ver sinais de alerta"});
  render();renderFeatured();setupBanner();
}
setupHeaderMenu();
$("csv").disabled=true;$("ai-search-button").disabled=true;
init().then(()=>{$("csv").disabled=false;$("ai-search-button").disabled=false}).catch(e=>{
 const message="Não foi possível carregar os dados agora. Atualize a página para tentar novamente. Se persistir, fale com o administrador.";
 ["lista","featured-journals","cmp-tabela","catalog-summary","metric-coverage"].forEach(id=>{if($(id))$(id).textContent=message});
 const retry=document.createElement("button");retry.type="button";retry.textContent="Tentar novamente";retry.onclick=()=>location.reload();$("lista").append(retry);
 $("ai-status").hidden=false;$("ai-status").textContent="Pesquisa e CSV indisponíveis até o catálogo carregar.";console.error(e);
});
