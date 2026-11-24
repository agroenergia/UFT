import {findJournalsByName,findSmartCatalogMatches,expandSearchTerms} from "./journal-search.js?v=20261118v4";
import {evaluateJournal} from "./eligibility.js";
import {journalAssessmentHTML,journalCriteriaHTML,comparisonHTML} from "./criteria-ui.js?v=20261118v4";
import {metricLabels,filterIds,metrics,matchesCriteria,metricText,researchPolicy} from "./criteria.js";
import {recordCustomAction} from "./visitor-tracker.js?v=20261124legal1";
const currentCriteria=()=>Object.fromEntries(filterIds.map(id=>[id,document.getElementById(id)?.value||""]));
const DATA_URL="./assets/data/revistas.json";const $=id=>document.getElementById(id);const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));const fmt=v=>v===null||v===undefined||v===""?"Não informado":String(v);const safeUrl=u=>{try{const x=new URL(u);return ["https:","http:"].includes(x.protocol)?x.href:""}catch{return""}};let ALL=[],BASE="",SELECTED=new Set();function field(r,k){return r[k]??null}function priority(r){return {"ALTO":0,"MÉDIO":1,"COMPLEMENTAR":2}[r.tier]??3}let CATALOG_TOP10=false,CURRENT_PAGE=1,PER_PAGE=24;
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
function compactCost(r){return r.acordoCapes===true?"Acordo CAPES: cobertura condicionada":({sem_apc:"Sem APC",rota_assinatura:"Rota de assinatura",apc:"Com taxa",confirmar:"Valor a confirmar"}[r.modeloCusto]||"Valor a confirmar")}
function compactStatus(r){return r.statusConferencia==='Em conferência'?'Em conferência':({selecao:"Na seleção",abaixo:"Fora do recorte",confirmar:"A confirmar"}[r.criterioPlanilha?.status]||"A confirmar")}
function renderPagination(total,perPage,totalPages){
  const pagination=$("catalog-pagination");
  if(!pagination)return;
  if(total===0){pagination.hidden=true;return;}
  pagination.hidden=false;
  const summary=$("pagination-summary");
  if(summary){
    if(perPage>=total){
      summary.textContent="Mostrando todas as "+total+" revistas";
    }else{
      const start=(CURRENT_PAGE-1)*perPage+1;
      const end=Math.min(CURRENT_PAGE*perPage,total);
      summary.textContent="Mostrando "+start+"–"+end+" de "+total+" revistas (Página "+CURRENT_PAGE+" de "+totalPages+")";
    }
  }
  const prevBtn=$("pagination-prev"),nextBtn=$("pagination-next");
  const isFirst=CURRENT_PAGE<=1,isLast=CURRENT_PAGE>=totalPages;
  if(prevBtn){prevBtn.disabled=isFirst;prevBtn.setAttribute("aria-disabled",String(isFirst));}
  if(nextBtn){nextBtn.disabled=isLast;nextBtn.setAttribute("aria-disabled",String(isLast));}
  const numbersWrap=$("pagination-numbers");
  if(numbersWrap){
    numbersWrap.replaceChildren();
    if(totalPages>1){
      const pagesToDisplay=[];
      if(totalPages<=7){
        for(let i=1;i<=totalPages;i++)pagesToDisplay.push(i);
      }else{
        pagesToDisplay.push(1);
        if(CURRENT_PAGE>4)pagesToDisplay.push("...");
        const start=Math.max(2,CURRENT_PAGE-1),end=Math.min(totalPages-1,CURRENT_PAGE+1);
        for(let i=start;i<=end;i++){if(!pagesToDisplay.includes(i))pagesToDisplay.push(i);}
        if(CURRENT_PAGE<totalPages-3)pagesToDisplay.push("...");
        if(!pagesToDisplay.includes(totalPages))pagesToDisplay.push(totalPages);
      }
      pagesToDisplay.forEach(item=>{
        if(item==="..."){
          const span=document.createElement("span");span.className="pagination-ellipsis";span.textContent="…";span.setAttribute("aria-hidden","true");numbersWrap.append(span);
        }else{
          const btn=document.createElement("button");btn.type="button";btn.className="pagination-btn pagination-num"+(item===CURRENT_PAGE?" active":"");btn.textContent=String(item);btn.setAttribute("aria-label","Ir para a página "+item);
          if(item===CURRENT_PAGE)btn.setAttribute("aria-current","page");
          btn.onclick=()=>{CURRENT_PAGE=item;render();$("revistas")?.scrollIntoView({behavior:"smooth",block:"start"});};
          numbersWrap.append(btn);
        }
      });
    }
  }
}
function render(){
  let arr=searchCatalog();
  const order=$("ord").value;
  arr.sort((a,b)=>order==="percentil"?((metrics(b).maiorPercentil??-1)-(metrics(a).maiorPercentil??-1)||a.titulo.localeCompare(b.titulo,"pt-BR")):order==="nome"?a.titulo.localeCompare(b.titulo,"pt-BR"):order==="tier"?priority(a)-priority(b)||((Number(b.citescore)||0)-(Number(a.citescore)||0)):((Number(b.citescore)||0)-(Number(a.citescore)||0))||a.titulo.localeCompare(b.titulo,"pt-BR"));
  if(CATALOG_TOP10)arr=arr.filter(r=>isSelection(r)&&r.citescore!==null&&r.citescore!==""&&Number.isFinite(Number(r.citescore))).slice(0,10);
  $("count").textContent=arr.length+(arr.length===1?" revista encontrada":" revistas encontradas")+" de "+ALL.length;
  renderActiveFilters();
  const perPageVal=$("per-page-select")?$("per-page-select").value:String(PER_PAGE);
  const perPage=perPageVal==="all"?Math.max(1,arr.length):(parseInt(perPageVal,10)||PER_PAGE);
  const totalPages=Math.max(1,Math.ceil(arr.length/perPage));
  if(CURRENT_PAGE>totalPages)CURRENT_PAGE=totalPages;
  if(CURRENT_PAGE<1)CURRENT_PAGE=1;
  const startIndex=(CURRENT_PAGE-1)*perPage;
  const visible=arr.slice(startIndex,startIndex+perPage);
  renderPagination(arr.length,perPage,totalPages);
  $("lista").innerHTML=visible.map(r=>{
    const url=safeUrl(r.url_ficha||r.url);
    const scopusUrl=r.scopusSourceId?"https://www.scopus.com/sourceid/"+encodeURIComponent(r.scopusSourceId):"";
    const shortCol=r.colecaoWos?String(r.colecaoWos).replace("Science Citation Index Expanded (SCIE)","SCIE"):null;
    const wosBadge=r.quartilJif?(r.quartilJif+(r.percentilJif!=null?" ("+r.percentilJif+"%)":"")):shortCol;
    const jifBadge=r.fatorImpacto!==null&&r.fatorImpacto!==undefined&&r.fatorImpacto!==""?(r.fatorImpacto+(r.anoFatorImpacto?" ("+r.anoFatorImpacto+")":"")):null;
    const metrics=[["Maior percentil",r.maiorPercentil===null?"A confirmar":r.maiorPercentil+"%"],["Quartil SJR",r.sjr],["CiteScore",r.citescore],["JIF (WoS)",jifBadge],["WoS",wosBadge]].filter(([,v])=>v!==null&&v!==undefined&&v!=="").map(([name,v])=>'<span><b>'+name+'</b> '+esc(v)+'</span>').join("");
    return '<article class="journal-card" id="revista-'+esc(r.id)+'"><div class="journal-card-top"><span class="tier criterion-badge status-'+esc(r.criterioPlanilha?.status||"confirmar")+'">'+esc(compactStatus(r))+'</span><label class="cmp"><input type="checkbox" data-id="'+esc(r.id)+'" '+(SELECTED.has(String(r.id))?"checked":"")+'> Comparar</label></div><h3>'+esc(r.titulo)+'</h3><p class="journal-area">'+esc(r.area||"Área não informada")+'</p><div class="journal-metrics">'+metrics+'</div><p class="journal-cost"><strong>Custo:</strong> '+esc(compactCost(r))+'</p>'+journalCriteriaHTML(r,esc)+journalAssessmentHTML(r,esc,$("submission-date")?.value,$("publication-target")?.value)+'<div class="journal-actions journal-card-actions"><a class="journal-record-link" href="ficha-revista.html?id='+encodeURIComponent(r.id)+'" target="_blank" rel="noopener">Ficha completa ↗</a>'+(scopusUrl?'<a class="journal-scopus-link" href="'+esc(scopusUrl)+'" target="_blank" rel="noopener noreferrer">Notas na Scopus (oficial) ↗</a>':"")+(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+(r.tipoLink?"Fonte externa":"Site da revista")+' ↗</a>':"")+'</div></article>';
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
  button.onclick=()=>{field.value="";CURRENT_PAGE=1;CATALOG_TOP10=false;render();$(id).focus()};target.append(button);
 }
 if($("program-only").checked){const button=document.createElement("button");button.type="button";button.textContent="Quatro critérios conferidos ×";button.setAttribute("aria-label","Remover filtro dos quatro critérios");button.onclick=()=>{$("program-only").checked=false;CURRENT_PAGE=1;render();$("program-only").focus()};target.append(button)}
 target.hidden=!target.childElementCount;
}
function renderCompare(){
  const arr=ALL.filter(r=>SELECTED.has(String(r.id)));
  $("cmp-tabela").innerHTML=arr.length?comparisonHTML(arr,esc):'<p class="compare-hint">Marque “Comparar” nos cartões do <a href="#revistas">catálogo</a> para visualizar as revistas aqui.</p>';
}
const JOURNAL_FIELD_LABELS={...metricLabels,id:"Identificador no catálogo",titulo:"Revista",area:"Área",sjr:"Quartil SJR informado",idioma:"Idioma",custo:"Custo informado",alinhamento:"Alinhamento com a pesquisa",url:"Site da revista",url_ficha:"Link da ficha",tier:"Faixa de curadoria",citescore:"CiteScore informado",fatorImpacto:"Fator de impacto informado",issn:"ISSN",editora:"Editora",escopo:"Escopo editorial informado",observacoes:"Observações",check:"Adequação do manuscrito",pergunta:"Pergunta-chave de adequação",obrigatorios:"Requisitos importantes",evitar:"Quando esta revista pode não ser adequada",ano:"Ano do indicador",fonte:"Fonte",fonteIndicador:"Fonte do indicador",baseAtualizada:"Referência da base"};
Object.assign(JOURNAL_FIELD_LABELS,{"enquadramento": "Enquadramento na planilha", "criterioPlanilha": "Critério da planilha", "status": "Situação", "regra": "Regra aplicada", "anoQuartil": "Ano do quartil informado", "indicadoresPlanilha": "Indicadores originais da planilha", "anoOutrosIndicadores": "Ano dos demais indicadores", "indiceSjr": "Índice SJR (valor)", "fatorImpacto5Anos": "Fator de impacto de 5 anos", "snip": "SNIP", "articleInfluenceScore": "Article Influence Score", "fontesCadastro": "Fontes de cadastro", "arquivo": "Arquivo de origem", "aba": "Aba", "linha": "Linha", "campos": "Campos", "documentosEquipe": "Documentos da equipe", "tipo": "Tipo", "conferencia": "Situação da conferência", "conferenciasOnline": "Campos conferidos em fontes online", "consultadoEm": "Data da consulta", "anoIndicador": "Ano de referência do indicador", "correcoesDocumentadas": "Correções documentadas", "campo": "Campo", "anterior": "Valor anterior", "atual": "Valor atualizado", "pendenciasConferencia": "Pendências de conferência", "valorPlanilha": "Valor da planilha", "valorObservadoOnline": "Valor observado na fonte online", "motivo": "Motivo da pendência", "atualizadoEm": "Cadastro atualizado em", "statusConferencia": "Situação da conferência", "origemCadastro": "Origem do cadastro", "modeloCusto": "Modelo de custo", "modeloPublicacao": "Modelo de publicação", "tiposArtigo": "Tipos de artigo", "limiteManuscrito": "Limite do manuscrito", "prazoPrimeiraDecisao": "Primeira decisão informada pela editora", "prazoPrimeiraDecisaoPlanilha": "Primeira decisão / estimativa da planilha", "prazoPublicacaoPlanilha": "Prazo de publicação / estimativa da planilha", "taxaAceitacaoPercentual": "Taxa de aceitação (%)", "urlInstrucoes": "Instruções aos autores", "dicasEquipe": "Orientações da equipe", "observacaoVarredura": "Observação da varredura", "situacaoOriginalPlanilha": "Situação original na planilha", "tipoLink": "Tipo de endereço externo", "anotacaoEquipe": "Anotação da equipe", "origem": "Origem geográfica", "observacao": "Observação", "scopusSourceId": "Código oficial na Scopus (Source ID)", "anoCiteScore": "Ano do CiteScore", "percentisCiteScorePorCategoria": "Percentis CiteScore na Scopus por categoria", "posicao": "Posição no ranking da categoria", "total": "Total de revistas na categoria", "linhaArquivo": "Linha na planilha Scopus", "urlArquivo": "Planilha pública consultada", "tituloNaFonte": "Título registrado na Scopus", "sha256Arquivo": "Hash SHA-256 do arquivo fonte", "colecaoWos": "Coleção Web of Science (WoS)", "quartilJif": "Quartil JIF (JCR/WoS)", "categoriaWos": "Categoria temática na WoS", "posicaoJif": "Posição no ranking JIF (WoS)", "totalJif": "Total de revistas na categoria WoS", "classificadorWos": "Classificador de ranqueamento na WoS"});
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
const PORTAL_TOPIC_GROUPS=[
 ["agroenergia","agroenergy","agricultura","agricultural","agriculture","agronomia","agronomy","agro","cultivo","crop","farm","agroindustrial"],
 ["bioenergia","bioenergy","biomassa","biomass","biocombustivel","biofuel","etanol","ethanol","biodiesel","biorefinery","biorrefinaria"],
 ["glicose","glucose","sugar","acucar","carboidrato","carbohydrate","fermentacao","fermentation","biochemistry","bioquimica","enzyme","enzima","biosensor"],
 ["energia","energy","renewable","renovavel","renovaveis","solar","eolica","wind","biofuel","hidrogenio","hydrogen","combustivel","fuel"],
 ["sustentabilidade","sustainability","sustainable","sustentavel","cleaner","production","producao","circular","environmental","ambiental"],
 ["ambiente","environment","environmental","ambiental","climate","clima","ecosystem","ecossistema","emissions","emissoes"],
 ["solo","soil","agua","water","irrigacao","irrigation","plant","planta","plantas","forestry","floresta","manejo"],
 ["residuo","residuos","waste","wastewater","recycling","reciclagem","geoscience","geociencia","biosystem","biossistema"],
 ["food","alimento","alimentos","nutrition","nutricao","chemistry","quimica","biotechnology","biotecnologia","catalysis","catalise"]
];
const PORTAL_SCOPE_TERMS=["agro","agricultur","agronom","farm","crop","bioenerg","biomass","biofuel","ethanol","biodiesel","energy","renewab","sustainab","cleaner","environment","ecosystem","emission","soil","irrigat","waste","forestr","plant","biosystem","geoscien","carbon","climate","water","circular","glucos","sugar","carbohydr","ferment","biochem","biotech","enzym","biosensor","food","chemi","catal","microb","veterin","animal","comput","sensor","machin"];
function termsFromQuestion(question){return normalizeSearchText(question).split(/[^a-z0-9]+/).filter(t=>t.length>2&&!SEARCH_STOPWORDS.has(t))}
function crossrefItemMatches(item,question){
  const title=(item.title||[]).join(" "),journal=(item["container-title"]||[]).join(" "),subjects=(item.subject||[]).join(" ");
  const text=normalizeSearchText([title,journal,subjects].join(" "));
  const inScope=PORTAL_SCOPE_TERMS.some(term=>text.includes(term));
  if(findJournalsByName(ALL,question).some(r=>normalizeSearchText(r.titulo)===normalizeSearchText(journal)))return true;
  const expanded=expandSearchTerms(question);
  const terms=[...new Set([...termsFromQuestion(question),...expanded.crossrefTerms.map(normalizeSearchText)])].filter(t=>t.length>3);
  if(!inScope&&!terms.some(term=>text.includes(term)))return false;
  const matchedGroup=PORTAL_TOPIC_GROUPS.some(group=>group.some(term=>terms.some(q=>term===q||term.startsWith(q)||q.startsWith(term)))&&group.some(term=>text.includes(term)));
  const directMatch=terms.some(term=>term.length>4&&text.includes(term));
  return matchedGroup||directMatch;
}
async function searchCrossref(question){
  const phrase=String(question||"").trim(),expanded=expandSearchTerms(phrase),terms=termsFromQuestion(phrase);
  const expandedQuery=(expanded.crossrefQuery||phrase).trim();
  if(terms.length===0&&expanded.crossrefTerms.length===0)return {journals:[],error:null,query:phrase,fromYear:new Date().getFullYear()-4};
  const fromYear=new Date().getFullYear()-4;
  const params=new URLSearchParams({"query.bibliographic":expandedQuery.slice(0,300),filter:"from-pub-date:"+fromYear+"-01-01,type:journal-article",rows:"100",select:"DOI,title,container-title,URL,published,published-print,published-online,publisher,type,subject",sort:"relevance",order:"desc",mailto:"mdqmichael@gmail.com"});
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
  return {journals:journals.filter(j=>!j.inCatalog||findJournalsByName(ALL,phrase).some(r=>normalizeSearchText(r.titulo)===normalizeSearchText(j.title))||searchCatalog().some(r=>normalizeSearchText(r.titulo)===normalizeSearchText(j.title))),error:null,fromYear,query:phrase};
}
function makeAllCatalogSection(question,orderedItems=null){
  const details=document.createElement("details");details.className="ai-catalog-expansion";
  const ordered=orderedItems||findSmartCatalogMatches(searchCatalog(),question).ordered,summary=document.createElement("summary");
  summary.textContent="Ver todas as "+ordered.length+" revistas ordenadas por proximidade com a busca";
  details.append(summary);
  const note=document.createElement("p");note.className="ai-catalog-note";note.textContent="As revistas aparecem ordenadas pela proximidade temática na nossa base auditada. Ajuste os filtros na seção Catálogo se desejar restringir área, custo ou percentil.";details.append(note);
  const grid=document.createElement("div");grid.className="ai-catalog-grid";
  ordered.forEach(({journal:r,score})=>{
    const card=document.createElement("article");card.className="ai-catalog-card";
    const title=document.createElement("h4");title.textContent=r.titulo;card.append(title);
    const relation=document.createElement("span");relation.className=score?"catalog-relevance direct":"catalog-relevance adjacent";relation.textContent=score?"Tema relacionado à busca":"Demais revistas da base";card.append(relation);const criterion=document.createElement("p");criterion.className="catalog-criterion status-"+(r.criterioPlanilha?.status||"confirmar");criterion.textContent=r.enquadramento||"Enquadramento a confirmar";card.append(criterion);
    const area=document.createElement("p");area.textContent=r.area||"Área não informada";card.append(area);
    const description=document.createElement("p");description.textContent=r.alinhamento||r.observacoes||r.escopo||"O catálogo não contém descrição de escopo para esta revista.";card.append(description);
    const metrics=document.createElement("p");metrics.className="ai-catalog-metrics";metrics.textContent="SJR: "+fmt(r.sjr)+" · CiteScore: "+fmt(r.citescore)+" · JIF (WoS): "+fmt(r.fatorImpacto)+(r.colecaoWos?" ("+r.colecaoWos+")":"")+" · Maior percentil: "+(r.maiorPercentil==null?"A confirmar":r.maiorPercentil+"%")+" · Idioma: "+fmt(r.idioma);card.append(metrics);
    const cost=document.createElement("p");cost.className="ai-catalog-cost";cost.textContent="Custo informado: "+fmt(r.custo);card.append(cost);
    card.insertAdjacentHTML("beforeend",journalCriteriaHTML(r,esc));card.append(makeFullRecord(r));
    if(r.scopusSourceId){const scopus=document.createElement("a");scopus.href="https://www.scopus.com/sourceid/"+encodeURIComponent(r.scopusSourceId);scopus.target="_blank";scopus.rel="noopener noreferrer";scopus.textContent="Ver notas no site oficial da Scopus ↗";card.append(scopus)}
    const url=safeUrl(r.url_ficha||r.url);if(url){const a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Abrir site da revista ↗";card.append(a)}
    grid.append(card);
  });
  details.append(grid);return details;
}
function appendCrossrefResults(parent,discovery){
  const section=document.createElement("section");section.className="ai-web-discovery";
  const kicker=document.createElement("span");kicker.className="external-stage-kicker";kicker.textContent="RECURSOS COMPLEMENTARES · CROSSREF";section.append(kicker);
  const heading=document.createElement("h3");heading.textContent="Sugestões complementares na plataforma Crossref";section.append(heading);
  const internetJournals=discovery&&discovery.journals||[],knownCount=internetJournals.filter(j=>j.inCatalog).length,newCount=internetJournals.filter(j=>!j.inCatalog).length,summary=document.createElement("p");summary.className="ai-result-summary";
  summary.textContent="No Crossref: "+internetJournals.length+" revistas com artigos recentes · "+knownCount+" já estão na base · "+newCount+" sugestões adicionais.";
  section.append(summary);
  const criteriaNote=document.createElement("p");criteriaNote.textContent="Preferências para conferir: "+filterIds.filter(id=>$(id).value).map(id=>(($(id).dataset.filterLabel||id)+": "+($(id).selectedOptions?.[0]?.textContent||$(id).value))).join(" · ");if(filterIds.some(id=>$(id).value))section.append(criteriaNote);
  const lead=document.createElement("p");lead.className="ai-web-note";
  if(discovery&&discovery.journals&&discovery.journals.length){
    const query=document.createElement("p");query.className="external-search-query";query.append(document.createTextNode("Busca por: "));const strong=document.createElement("strong");strong.textContent=discovery.query||"tema da pergunta";query.append(strong);section.append(query);
    lead.textContent="Esta área mostra revistas encontradas em referências de artigos recentes no Crossref. Elas complementam nossa base auditada e devem ter escopo, indexação e taxas confirmados nas fontes oficiais.";section.append(lead);
    const source=document.createElement("a");source.href="https://www.crossref.org/documentation/retrieve-metadata/rest-api/";source.target="_blank";source.rel="noopener noreferrer";source.className="ai-source-link";source.textContent="Como são encontradas estas sugestões?";section.append(source);
    const list=document.createElement("div");list.className="ai-web-journals";
    discovery.journals.forEach(journal=>{
      const card=document.createElement("article");card.className="ai-web-journal";
      const label=document.createElement("span");label.className="external-result-label";label.textContent=journal.inCatalog?"NO CATÁLOGO":"SUGESTÃO CROSSREF";card.append(label);
      const title=document.createElement("h4");title.textContent=journal.title;card.append(title);
      const badge=document.createElement("span");badge.className=journal.inCatalog?"origin-internal":"origin-external";badge.textContent=journal.inCatalog?"No catálogo":"Conferir antes de usar";card.append(badge);
      const registered=ALL.find(r=>normalizeSearchText(r.titulo)===normalizeSearchText(journal.title));card.insertAdjacentHTML("beforeend",journalCriteriaHTML(registered||{},esc));
      const pending=document.createElement("p");pending.textContent="Candidata a verificar: confirmar Scopus/WoS, percentis CiteScore/JIF, análise antipredatória, escopo, idioma, APC, acordo CAPES e prazo nas fontes oficiais. O Crossref não fornece essas comprovações.";card.append(pending);
      const meta=document.createElement("p");meta.className="external-result-meta";meta.textContent=journal.count+" artigos relacionados"+(journal.publisher?" · "+journal.publisher:"");card.append(meta);
      journal.papers.forEach(paper=>{if(!paper.title)return;const p=document.createElement("p");p.className="ai-web-paper";const link=document.createElement("a");link.href=paper.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent=paper.title+" ↗";p.append(link);const year=document.createElement("span");year.textContent=paper.year?" ("+paper.year+")":"";p.append(year);card.append(p)});
      list.append(card);
    });
    section.append(list);
  }else{
    lead.textContent=discovery&&discovery.error?"Os recursos do Crossref não ficaram disponíveis nesta tentativa. As recomendações da nossa base auditada continuam disponíveis acima e no catálogo abaixo.":"Não foram encontradas sugestões adicionais no Crossref para este termo. Confira as revistas recomendadas da nossa base auditada acima.";section.append(lead);
  }
  parent.append(section);
}
function presentAI(raw,question,discovery,directMatches=null,smartMeta=null){
  const el=$("ai-answer");el.replaceChildren();const wrap=document.createElement("div");wrap.className="ai-rich";
  const heading=document.createElement("h3");heading.textContent="Possibilidades recomendadas na base auditada";wrap.append(heading);
  const smart=smartMeta||findSmartCatalogMatches(searchCatalog(),question,{limit:8});
  const matched=directMatches&&directMatches.length?directMatches:(smart.matches||[]);
  const baseSection=document.createElement("section");baseSection.className="ai-base-results";
  const baseHeading=document.createElement("h3");baseHeading.textContent="Revistas encontradas na nossa base auditada";baseSection.append(baseHeading);
  const baseSummary=document.createElement("p");baseSummary.className="ai-base-summary";
  const topicText=smart.matchedLabels&&smart.matchedLabels.length?" · Temas associados: "+smart.matchedLabels.join("; "):"";
  const totalRelated=typeof smart.totalMatches==="number"?smart.totalMatches:matched.length;
  baseSummary.textContent=(matched.length
    ?matched.length+(matched.length===1?" principal possibilidade indicada":" principais possibilidades indicadas")+(totalRelated>matched.length?" (entre "+totalRelated+" revistas relacionadas)":"")
    :"Nenhuma correspondência direta na base para este termo")+" · "+ALL.length+" revistas auditadas no catálogo"+topicText+".";
  baseSection.append(baseSummary);
  if(smart.usedFullBaseFallback){
    const fallbackNote=document.createElement("p");fallbackNote.className="ai-base-summary";
    fallbackNote.textContent="Os filtros selecionados no catálogo restringiam este tema; as recomendações acima consideraram toda a base auditada.";
    baseSection.append(fallbackNote);
  }
  if(matched.length){
    const grid=document.createElement("div");grid.className="ai-rich-grid";
    matched.forEach(r=>{const card=document.createElement("article");card.className="ai-rich-card";const name=document.createElement("h4");name.textContent=r.titulo;card.append(name);const recordLink=document.createElement("a");recordLink.href="ficha-revista.html?id="+encodeURIComponent(r.id);recordLink.textContent="Abrir ficha completa";card.append(recordLink);card.insertAdjacentHTML("beforeend",journalCriteriaHTML(r,esc));card.append(makeFullRecord(r));const origin=document.createElement("span");origin.className="origin-internal";origin.textContent="Base auditada";card.append(origin);const area=document.createElement("p");area.textContent=r.area||"Área não informada";card.append(area);const scopeText=r.escopo||r.alinhamento||r.observacoes;if(scopeText){const scope=document.createElement("p");scope.textContent=scopeText;card.append(scope)}const metrics=document.createElement("p");metrics.className="ai-rich-metrics";metrics.textContent="SJR: "+fmt(r.sjr)+" · CiteScore: "+fmt(r.citescore)+" · JIF (WoS): "+fmt(r.fatorImpacto)+(r.colecaoWos?" ("+r.colecaoWos+")":"")+" · Maior percentil: "+(r.maiorPercentil==null?"A confirmar":r.maiorPercentil+"%");card.append(metrics);const cost=document.createElement("p");cost.textContent="Custo informado: "+fmt(r.custo);card.append(cost);if(r.scopusSourceId){const scopus=document.createElement("a");scopus.href="https://www.scopus.com/sourceid/"+encodeURIComponent(r.scopusSourceId);scopus.target="_blank";scopus.rel="noopener noreferrer";scopus.textContent="Ver notas no site oficial da Scopus ↗";card.append(scopus);}const url=safeUrl(r.url_ficha||r.url);if(url){const a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Abrir site da revista ↗";card.append(a);}grid.append(card)});
    baseSection.append(grid);
  }else{
    const empty=document.createElement("p");empty.className="ai-base-empty";empty.textContent="Nenhuma revista da base auditada apresentou correspondência direta com os termos buscados. Tente termos mais amplos (ex.: glicose, bioenergia, química, alimentos, agricultura) ou explore o catálogo abaixo.";baseSection.append(empty);
  }
  baseSection.append(makeAllCatalogSection(question,smart.ordered));wrap.append(baseSection);
  if(discovery)appendCrossrefResults(wrap,discovery);
  const note=document.createElement("p");note.className="source-disclaimer";note.textContent="As informações da base refletem o cadastro auditado do projeto. Confira escopo, percentis e taxas atualizadas nas fontes oficiais antes da submissão.";wrap.append(note);
  el.append(wrap);
}
function matchesSjr(r,val){
  if(!val)return true;
  if(!r.sjr)return false;
  if(val==="Q1")return r.sjr==="Q1"||r.sjr==="Q1/Q2";
  if(val==="Q2")return r.sjr==="Q2"||r.sjr==="Q1/Q2";
  if(val==="Q1/Q2")return r.sjr==="Q1"||r.sjr==="Q2"||r.sjr==="Q1/Q2";
  return r.sjr===val;
}
function searchCatalog(){
  return ALL.filter(r=>
    (!$("program-only")||!$("program-only").checked||evaluateJournal(r).state==="pass"||(r.maiorPercentil>=50&&(r.indexacaoScopus||r.indexacaoWos)))&&
    matchesCriteria(r,currentCriteria())&&
    (!$("criterio")?.value||r.criterioPlanilha?.status===$("criterio").value)&&
    (!$("area")?.value||r.area===$("area").value)&&
    matchesSjr(r,$("sjr")?.value)&&
    (!$("idioma")?.value||String(r.idioma||"").includes($("idioma").value))&&
    matchesCost(r,$("custo")?.value)&&
    (!$("score")?.value||Number(r.citescore)>=Number($("score").value))&&
    (!$("q")?.value||normalizeSearchText([r.titulo,r.area,r.issn,r.escopo,r.alinhamento,r.observacoes,r.editora,...(r.check?Object.values(r.check):[])].join(" ")).includes(normalizeSearchText($("q").value)))
  );
}
async function askAI(){
  const question=$("ai-question").value.trim(),status=$("ai-status"),answer=$("ai-answer");if(!question)return;
  const filteredCatalog=searchCatalog();
  let smart=findSmartCatalogMatches(filteredCatalog,question,{limit:8});
  let usedFullBaseFallback=false;
  if(!smart.matches.length&&filteredCatalog.length<ALL.length){
    const fullSmart=findSmartCatalogMatches(ALL,question,{limit:8});
    if(fullSmart.matches.length){smart=fullSmart;usedFullBaseFallback=true;}
  }
  const initialMatches=smart.matches;
  presentAI("",question,null,initialMatches,{...smart,usedFullBaseFallback});
  status.hidden=false;status.textContent="Exibindo recomendações da nossa base auditada. Consultando recursos da plataforma Crossref…";
  $("ai-loading").hidden=false;$("ai-search-button").disabled=true;$("ai-search-button").textContent="Pesquisando…";
  let discovery={journals:[],error:null,fromYear:new Date().getFullYear()-4,query:question};
  try{
    const areaVal=$("area")?.value||"";
    const crQuery=initialMatches.length&&smart.isExactName?question:(areaVal?question+" "+areaVal:question);
    discovery=await searchCrossref(crQuery);
  }catch(error){
    discovery={journals:[],error:error.message,fromYear:new Date().getFullYear()-4,query:question};
  }
  presentAI("",question,discovery,initialMatches,{...smart,usedFullBaseFallback});
  status.textContent=discovery.error
    ?"Pesquisa concluída na base auditada. Os recursos da plataforma Crossref não ficaram disponíveis nesta tentativa."
    :"Pesquisa concluída na base auditada e na plataforma Crossref.";
  $("ai-loading").hidden=true;$("ai-search-button").disabled=false;$("ai-search-button").textContent="Pesquisar";
  recordCustomAction("Pesquisou: "+question);
  window.dispatchEvent(new CustomEvent("rigoratlas:announce",{detail:{message:"Pesquisa concluída para "+question+". "+initialMatches.length+" revistas principais recomendadas na base auditada."}}));
}
function scopusPercentile(r){
  const m=metrics(r).maiorPercentil;
  if(m!==null&&m!==undefined&&Number.isFinite(Number(m)))return Number(m);
  if(r.percentilCiteScore!==null&&r.percentilCiteScore!==undefined&&Number.isFinite(Number(r.percentilCiteScore)))return Number(r.percentilCiteScore);
  return null;
}
function featuredSelection(rows){
  const eligible=rows.filter(r=>r.indexacaoScopus===true&&scopusPercentile(r)!==null&&scopusPercentile(r)>50);
  if(!eligible.length)return [];
  const used=new Set();
  const pick=cands=>{
    const item=cands.find(r=>!used.has(String(r.id)));
    if(item)used.add(String(item.id));
    return item||null;
  };
  const near50=eligible
    .filter(r=>scopusPercentile(r)<=58)
    .sort((a,b)=>(scopusPercentile(a)-scopusPercentile(b))||((isSelection(b)?1:0)-(isSelection(a)?1:0))||((b.acordoCapes?1:0)-(a.acordoCapes?1:0))||a.titulo.localeCompare(b.titulo,"pt-BR"));
  const entry50=pick(near50.filter(isSelection).concat(near50));
  const near75=eligible
    .filter(r=>scopusPercentile(r)===75)
    .sort((a,b)=>((isSelection(b)?1:0)-(isSelection(a)?1:0))||((b.sjr?1:0)-(a.sjr?1:0))||((Number(b.citescore)||0)-(Number(a.citescore)||0))||a.titulo.localeCompare(b.titulo,"pt-BR"));
  const mid75=pick(near75.length?near75:eligible.slice().sort((a,b)=>Math.abs(scopusPercentile(a)-75)-Math.abs(scopusPercentile(b)-75)));
  const topHigh=eligible
    .slice()
    .sort((a,b)=>(scopusPercentile(b)-scopusPercentile(a))||((isSelection(b)?1:0)-(isSelection(a)?1:0))||((Number(b.citescore)||0)-(Number(a.citescore)||0))||a.titulo.localeCompare(b.titulo,"pt-BR"));
  const highs=[pick(topHigh),pick(topHigh),pick(topHigh)].filter(Boolean);
  return [entry50,mid75,...highs].filter(Boolean).map(r=>{
    const pct=scopusPercentile(r);
    const faixa=pct>=90?"Alto nível":pct===75?"Patamar 75%":"Faixa > 50%";
    return {journal:r,pct,faixa};
  });
}
function renderFeatured(){
  const target=$("featured-journals");if(!target)return;
  target.innerHTML=featuredSelection(ALL).map(({journal:r,pct,faixa},i)=>'<a class="featured-journal" href="#revista-'+esc(r.id)+'" data-featured-id="'+esc(r.id)+'"><span class="cover-miniature"><span class="cover-fallback" aria-hidden="true"><span>SCOPUS '+esc(pct)+'%</span><b>'+esc(r.titulo)+'</b><i></i></span></span><span class="featured-info"><span class="featured-rank">0'+(i+1)+' · '+esc(faixa)+'</span><strong>'+esc(r.titulo)+'</strong><span class="featured-score">Percentil Scopus <b>'+esc(pct)+'%</b>'+(r.citescore!==null&&r.citescore!==undefined?' <small class="featured-cs">· CiteScore '+esc(fmt(r.citescore))+'</small>':'')+'</span><span class="featured-link">Ver no catálogo ↗</span></span></a>').join("")||"<p>Nenhum destaque disponível na seleção atual.</p>";
  target.addEventListener("click",event=>{
    const link=event.target.closest("[data-featured-id]");if(!link)return;
    const journal=ALL.find(r=>String(r.id)===link.dataset.featuredId);if(!journal)return;
    event.preventDefault();
    if($("program-only"))$("program-only").checked=false;
    CATALOG_TOP10=false;
    [...filterIds,"criterio","area","sjr","idioma","custo","score"].forEach(id=>{const el=$(id);if(el)el.value=""});
    if($("q"))$("q").value=journal.titulo;
    render();
    const card=$("revista-"+journal.id);if(card){card.tabIndex=-1;card.focus({preventScroll:true});card.scrollIntoView({behavior:"smooth",block:"start"});}
  });
}
function openFaqTarget(hash){
  if(!hash||!hash.startsWith("#faq-"))return;
  const target=document.getElementById(hash.slice(1));
  if(target&&target.tagName==="DETAILS"){target.open=true;target.scrollIntoView({behavior:"smooth",block:"start"});}
}
function setupBanner(){
  document.querySelectorAll('.banner-prompts a[href^="#faq-"]').forEach(link=>link.addEventListener("click",event=>{
    event.preventDefault();
    const href=link.getAttribute("href");
    if(history&&history.replaceState)history.replaceState(null,"",href);
    openFaqTarget(href);
  }));
  window.addEventListener("hashchange",()=>openFaqTarget(location.hash));
  if(location.hash.startsWith("#faq-"))openFaqTarget(location.hash);
  document.querySelectorAll("[data-focus-search]").forEach(link=>link.addEventListener("click",event=>{
    event.preventDefault();if($("ai-question")){$("ai-question").focus({preventScroll:true});$("ai-question").scrollIntoView({behavior:"smooth",block:"center"});}
  }));
}

function setupHeaderMenu(){
  const header=document.querySelector(".site-header"),nav=$("primary-navigation"),mobileNav=document.querySelector(".mobile-floating-nav");
  if(!header)return;
  const allNavLinks=[
    ...(nav?nav.querySelectorAll("a"):[]),
    ...(mobileNav?mobileNav.querySelectorAll("a"):[])
  ];
  const markActive=href=>{
    if(!href)return;
    allNavLinks.forEach(a=>a.classList.toggle("on",a.getAttribute("href")===href));
  };
  const dropdown=nav?.querySelector("[data-nav-dropdown]");
  const trigger=dropdown?.querySelector(".nav-dropdown-trigger");
  const setDropdown=open=>{
    if(!dropdown||!trigger)return;
    dropdown.classList.toggle("is-open",open);
    trigger.setAttribute("aria-expanded",String(Boolean(open)));
  };
  if(dropdown&&trigger){
    trigger.addEventListener("click",event=>{
      event.stopPropagation();
      setDropdown(!dropdown.classList.contains("is-open"));
    });
    dropdown.addEventListener("mouseenter",()=>trigger.setAttribute("aria-expanded","true"));
    dropdown.addEventListener("mouseleave",()=>{
      if(!dropdown.classList.contains("is-open"))trigger.setAttribute("aria-expanded","false");
    });
    document.addEventListener("click",event=>{
      if(!dropdown.contains(event.target))setDropdown(false);
    });
    document.addEventListener("keydown",event=>{
      if(event.key==="Escape")setDropdown(false);
    });
  }
  const onNavClick=event=>{
    const link=event.target.closest("a");
    if(!link)return;
    if(link.getAttribute("href")?.startsWith("#"))markActive(link.getAttribute("href"));
    setDropdown(false);
  };
  nav?.addEventListener("click",onNavClick);
  mobileNav?.addEventListener("click",onNavClick);
  window.addEventListener("hashchange",()=>{
    if(location.hash&&allNavLinks.some(a=>a.getAttribute("href")===location.hash))markActive(location.hash);
  });
  const updateOffset=()=>document.documentElement.style.setProperty("--header-offset",(Math.ceil(header.getBoundingClientRect().height)+14)+"px");
  updateOffset();
  if(typeof ResizeObserver!=="undefined")new ResizeObserver(updateOffset).observe(header);
  else window.addEventListener("resize",updateOffset);
}

async function init(){
  const res=await fetch(DATA_URL,{cache:"no-store",signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error("Não foi possível carregar a base de revistas");
  const data=await res.json();if(!Array.isArray(data.revistas)||data.revistas.some(r=>!r||typeof r.titulo!=="string"))throw Error("Formato do catálogo inválido");ALL=data.revistas.map((r,i)=>metrics({...r,id:r.id??i+1}));
  if($("metric-coverage"))$("metric-coverage").textContent=ALL.filter(r=>r.maiorPercentil!==null).length+" de "+ALL.length+" registros com percentil CiteScore/JIF numérico. Campos ausentes exigem conferência na fonte; quartil e pontuação não foram convertidos em percentil.";
  BASE=data.fonteArquivo||data.baseAtualizada||"base do projeto";
  if($("catalog-summary"))$("catalog-summary").textContent=ALL.length+" revistas para explorar e comparar";
  if($("selecao-option"))$("selecao-option").textContent="Seleção da equipe ("+selectionCatalog().length+")";
  try{renderFeatured();}catch(e){console.error("Erro em renderFeatured:",e);}
  if(/^#revista-/.test(location.hash)){
    if($("criterio"))$("criterio").value="";
    const targetId=location.hash.replace("#revista-","");
    const catalogList=searchCatalog();
    const idx=catalogList.findIndex(r=>String(r.id)===targetId);
    if(idx!==-1){
      const perPageVal=$("per-page-select")?$("per-page-select").value:String(PER_PAGE);
      const perPage=perPageVal==="all"?catalogList.length:(parseInt(perPageVal,10)||PER_PAGE);
      CURRENT_PAGE=Math.floor(idx/perPage)+1;
    }
  }
  if($("area")){
    [...new Set(ALL.map(r=>r.area).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR")).forEach(v=>$("area").add(new Option(v,v)));
  }
  const resetCatalogPagination=()=>{CATALOG_TOP10=false;CURRENT_PAGE=1;document.querySelectorAll("[data-fast-filter]").forEach(b=>b.setAttribute("aria-pressed","false"))};
  [...filterIds,"q","criterio","area","sjr","idioma","custo","score","ord"].forEach(id=>$(id)?.addEventListener("input",()=>{resetCatalogPagination();render()}));
  if($("limpar"))$("limpar").onclick=()=>{if($("program-only"))$("program-only").checked=false;[...filterIds,"q","criterio","area","sjr","idioma","custo","score"].forEach(id=>{const el=$(id);if(el)el.value=""});resetCatalogPagination();render()};
  document.querySelectorAll("[data-fast-filter]").forEach(button=>button.addEventListener("click",()=>{
    [...filterIds,"q","criterio","area","sjr","idioma","custo","score"].forEach(id=>{const el=$(id);if(el)el.value=""});
    resetCatalogPagination();
    const filter=button.dataset.fastFilter;
    if(filter!=="clear"&&filter!=="all"&&$("criterio"))$("criterio").value="selecao";
    if(filter==="q1"&&$("sjr"))$("sjr").value="Q1";
    if(filter==="sem"&&$("custo"))$("custo").value="sem";
    if(filter==="portugues"&&$("idioma"))$("idioma").value="Português";
    if(filter==="top10"){CATALOG_TOP10=true;if($("ord"))$("ord").value="citescore"}
    document.querySelectorAll("[data-fast-filter]").forEach(b=>b.setAttribute("aria-pressed",String(filter!=="clear"&&b===button)));
    render();$("lista")?.scrollIntoView({behavior:"smooth",block:"start"});
  }));
  if($("program-only"))$("program-only").addEventListener("change",()=>{CURRENT_PAGE=1;render()});
  $("per-page-select")?.addEventListener("change",e=>{PER_PAGE=e.target.value==="all"?"all":(parseInt(e.target.value,10)||24);CURRENT_PAGE=1;render()});
  $("pagination-prev")?.addEventListener("click",()=>{if(CURRENT_PAGE>1){CURRENT_PAGE--;render();$("revistas")?.scrollIntoView({behavior:"smooth",block:"start"})}});
  $("pagination-next")?.addEventListener("click",()=>{
    const perPageVal=$("per-page-select")?$("per-page-select").value:String(PER_PAGE);
    const perPage=perPageVal==="all"?Infinity:(parseInt(perPageVal,10)||PER_PAGE);
    const totalPages=Math.max(1,Math.ceil(searchCatalog().length/perPage));
    if(CURRENT_PAGE<totalPages){CURRENT_PAGE++;render();$("revistas")?.scrollIntoView({behavior:"smooth",block:"start"})}
  });
  $("lista")?.addEventListener("change",e=>{const id=e.target.dataset.id;if(!id)return;if(e.target.checked){if(SELECTED.size>=4){e.target.checked=false;alert("Selecione até quatro revistas.");return}SELECTED.add(id)}else SELECTED.delete(id);renderCompare()});
  if($("ai-search-form"))$("ai-search-form").addEventListener("submit",e=>{e.preventDefault();askAI()});
  const predatoryToggle=$("predatory-toggle"),predatoryDetails=$("predatory-details");
  if(predatoryToggle&&predatoryDetails)predatoryToggle.addEventListener("click",()=>{const open=predatoryDetails.hidden;predatoryDetails.hidden=!open;predatoryToggle.setAttribute("aria-expanded",String(open));predatoryToggle.textContent=open?"Ocultar sinais de alerta":"Ver sinais de alerta"});
  try{render();}catch(e){console.error("Erro em render:",e);}
  setupBanner();
}
setupHeaderMenu();
if($("ai-search-button"))$("ai-search-button").disabled=true;
init().then(()=>{if($("ai-search-button"))$("ai-search-button").disabled=false}).catch(e=>{
 const message="Não foi possível carregar os dados agora. Atualize a página para tentar novamente. Se persistir, fale com o administrador.";
 const targets = (ALL && ALL.length) ? ["lista","cmp-tabela"] : ["lista","featured-journals","cmp-tabela","catalog-summary","metric-coverage"];
 targets.forEach(id=>{if($(id))$(id).textContent=message});
 const retry=document.createElement("button");retry.type="button";retry.textContent="Tentar novamente";retry.onclick=()=>location.reload();if($("lista"))$("lista").append(retry);
 if($("ai-status")){$("ai-status").hidden=false;$("ai-status").textContent="Pesquisa indisponível até o catálogo carregar.";}
 console.error(e);
});
