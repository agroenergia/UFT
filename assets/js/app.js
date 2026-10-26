const DATA_URL="./assets/data/revistas.json";const $=id=>document.getElementById(id);const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));const fmt=v=>v===null||v===undefined||v===""?"Não informado":String(v);const safeUrl=u=>{try{const x=new URL(u);return ["https:","http:"].includes(x.protocol)?x.href:""}catch{return""}};let ALL=[],BASE="",SELECTED=new Set();function field(r,k){return r[k]??null}function priority(r){return {"ALTO":0,"MÉDIO":1,"COMPLEMENTAR":2}[r.tier]??3}function render(){const q=$("q").value.toLocaleLowerCase("pt-BR").trim();let arr=ALL.filter(r=>{const t=[r.titulo,r.area,r.alinhamento,r.observacoes,r.editora,r.issn].join(" ").toLocaleLowerCase("pt-BR");return (!q||t.includes(q))&&(!$("area").value||r.area===$("area").value)&&(!$("sjr").value||r.sjr===$("sjr").value)&&(!$("idioma").value||String(r.idioma||"").includes($("idioma").value))&&(!$("custo").value||($("custo").value==="confirmar"?/confirmar/i.test(r.custo||""): /gratuita|gratuito|assinatura|sem apc/i.test(r.custo||"")&&!/confirmar/i.test(r.custo||"")))});const o=$("ord").value;arr.sort((a,b)=>o==="nome"?a.titulo.localeCompare(b.titulo):o==="citescore"?(Number(b.citescore)||0)-(Number(a.citescore)||0):priority(a)-priority(b)||a.titulo.localeCompare(b.titulo));$("count").textContent=arr.length+" revistas encontradas";$("lista").innerHTML=arr.map(r=>{const url=safeUrl(r.url_ficha||r.url),check=r.check;return '<article class="journal-card" id="revista-'+esc(r.id)+'"><div class="journal-card-top"><span class="tier">'+esc(r.tier||"Curadoria")+'</span><label class="cmp"><input type="checkbox" data-id="'+esc(r.id)+'" '+(SELECTED.has(String(r.id))?"checked":"")+'> Comparar</label></div><h3>'+esc(r.titulo)+'</h3><p class="journal-area">'+esc(r.area||"Área não informada")+'</p><p>'+esc(r.alinhamento||r.observacoes||r.escopo||"Escopo a confirmar na fonte oficial.")+'</p><div class="journal-metrics"><span><b>SJR</b> '+esc(fmt(r.sjr))+'</span><span><b>CiteScore</b> '+esc(fmt(r.citescore))+'</span><span><b>Impacto</b> '+esc(fmt(r.fatorImpacto))+'</span></div><p><strong>Idioma:</strong> '+esc(fmt(r.idioma))+'</p><p><strong>Custo informado:</strong> '+esc(fmt(r.custo))+'</p>'+(check?'<details><summary>Ver adequação do manuscrito</summary><p><b>Pergunta-chave:</b> '+esc(check.pergunta)+'</p><p><b>Requisitos:</b> '+esc(check.obrigatorios)+'</p><p><b>Quando evitar:</b> '+esc(check.evitar)+'</p></details>':'')+'<div class="journal-actions">'+(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Consultar site externo ↗</a><small class="external-link-note">Link externo ao PPGAD/UFT. Os dados da ficha não são atualizados automaticamente por este link.</small>':'<span>Link indisponível</span>')+'</div><small class="journal-note"><span class="origin-internal">Catálogo do projeto</span> · Dados cadastrados pela equipe; verificação editorial individual não comprovada.</small></article>'}).join("")||'<p class="empty">Nenhuma revista corresponde aos filtros. Tente ampliar a busca.</p>';renderCompare()}function renderCompare(){const arr=ALL.filter(r=>SELECTED.has(String(r.id)));$("cmp-tabela").innerHTML=arr.length?'<table><tr><th>Indicador</th>'+arr.map(r=>'<th>'+esc(r.titulo)+'</th>').join("")+'</tr>'+[["Área","area"],["Quartil SJR","sjr"],["CiteScore (valor)","citescore"],["Fator de impacto (valor)","fatorImpacto"],["Idioma","idioma"],["Custo informado","custo"],["Adequação","alinhamento"]].map(([label,key])=>'<tr><th>'+label+'</th>'+arr.map(r=>'<td>'+esc(fmt(r[key]))+'</td>').join("")+'</tr>').join("")+'</table>':'<p class="empty">Marque até quatro revistas para comparar.</p>'}const JOURNAL_FIELD_LABELS={id:"Identificador no catálogo",titulo:"Revista",area:"Área",sjr:"Quartil SJR informado",idioma:"Idioma",custo:"Custo informado",alinhamento:"Alinhamento com a pesquisa",url:"Site da revista",url_ficha:"Link da ficha",tier:"Faixa de curadoria",citescore:"CiteScore informado",fatorImpacto:"Fator de impacto informado",issn:"ISSN",editora:"Editora",escopo:"Escopo editorial informado",observacoes:"Observações",check:"Adequação do manuscrito",pergunta:"Pergunta-chave de adequação",obrigatorios:"Requisitos importantes",evitar:"Quando esta revista pode não ser adequada",ano:"Ano do indicador",fonte:"Fonte",fonteIndicador:"Fonte do indicador",baseAtualizada:"Referência da base"};
function fullRecordEntries(value,prefix=""){
  const entries=[];
  Object.entries(value||{}).forEach(([key,item])=>{
    const label=JOURNAL_FIELD_LABELS[key]||key.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/^./,c=>c.toLocaleUpperCase("pt-BR"));
    const pathLabel=prefix?prefix+" · "+label:label;
    if(item===null||item===undefined||item==="")return;
    if(Array.isArray(item)){if(item.length)entries.push([pathLabel,item.map(v=>typeof v==="object"?JSON.stringify(v):String(v)).join(" · ")]);return}
    if(typeof item==="object"){entries.push(...fullRecordEntries(item,pathLabel));return}
    entries.push([pathLabel,String(item)]);
  });
  return entries;
}
function makeFullRecord(r){
  const entries=fullRecordEntries(r);const details=document.createElement("details");details.className="ai-full-record";
  const summary=document.createElement("summary");summary.textContent="Ver ficha completa · "+entries.length+" dados";details.append(summary);
  const intro=document.createElement("p");intro.className="ai-full-record-note";intro.textContent="Todos os campos preenchidos para esta revista no catálogo do projeto. Campos em branco não foram cadastrados.";details.append(intro);
  const list=document.createElement("dl");list.className="ai-full-record-list";
  entries.forEach(([label,value])=>{const row=document.createElement("div");row.className="ai-full-record-row";const term=document.createElement("dt");term.textContent=label;const desc=document.createElement("dd");const link=safeUrl(value);if(/^(site da revista|link da ficha)$/i.test(label)&&link){const a=document.createElement("a");a.href=link;a.target="_blank";a.rel="noopener noreferrer";a.textContent=value;desc.append(a)}else desc.textContent=value;row.append(term,desc);list.append(row)});
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
  return [...ALL].map(r=>({journal:r,score:journalQuestionScore(r,question)}))
    .sort((a,b)=>b.score-a.score||(priority(a.journal)-priority(b.journal))||a.journal.titulo.localeCompare(b.journal.titulo,"pt-BR"));
}
async function searchCrossref(question){
  const phrase=String(question||"").trim();if(phrase.replace(/[^a-zA-ZÀ-ÿ]/g,"").length<4)return {journals:[],error:null};
  const now=new Date(),fromYear=now.getFullYear()-4;
  const params=new URLSearchParams({ "query.bibliographic":phrase.slice(0,300),filter:"from-pub-date:"+fromYear+"-01-01,type:journal-article",rows:"80",select:"DOI,title,container-title,URL,published,published-print,published-online,publisher,type",sort:"published",order:"desc"});
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);let response;
  try{response=await fetch(CROSSREF_API+"?"+params.toString(),{headers:{Accept:"application/json"},cache:"no-store",signal:controller.signal})}finally{clearTimeout(timeout)}
  if(!response.ok)throw new Error("Crossref respondeu com HTTP "+response.status);
  const payload=await response.json(),items=payload&&payload.message&&payload.message.items||[],groups=new Map();
  items.forEach(item=>{
    const title=Array.isArray(item["container-title"])?item["container-title"][0]:"";
    if(!title||!item.DOI)return;
    const key=normalizeSearchText(title),entry=groups.get(key)||{title,count:0,publisher:item.publisher||"",papers:[]};
    entry.count++;if(!entry.publisher&&item.publisher)entry.publisher=item.publisher;
    const dates=[item.published,item["published-online"],item["published-print"],item.issued].filter(Boolean);
    const year=dates.map(d=>d["date-parts"]&&d["date-parts"][0]&&d["date-parts"][0][0]).find(Boolean)||"";
    entry.papers.push({title:Array.isArray(item.title)?item.title[0]:"",doi:item.DOI,url:"https://doi.org/"+encodeURIComponent(item.DOI),year});
    groups.set(key,entry);
  });
  const known=new Set(ALL.map(r=>normalizeSearchText(r.titulo)));
  return {journals:[...groups.values()].sort((a,b)=>b.count-a.count||a.title.localeCompare(b.title,"en")).slice(0,6).map(g=>({...g,inCatalog:known.has(normalizeSearchText(g.title)),papers:g.papers.slice(0,2)})),error:null,fromYear};
}
function makeAllCatalogSection(question){
  const details=document.createElement("details");details.className="ai-catalog-expansion";
  const ordered=orderCatalogForQuestion(question),summary=document.createElement("summary");
  summary.textContent="Explorar todas as "+ordered.length+" revistas do catálogo, incluindo áreas adjacentes";
  details.append(summary);
  const note=document.createElement("p");note.className="ai-catalog-note";note.textContent="A lista prioriza as revistas cujas áreas e escopos cadastrados mais se aproximam da pergunta. O restante do catálogo, com temas de pesquisa adjacentes, também está incluído. Revise as fontes oficiais antes de submeter.";details.append(note);
  const grid=document.createElement("div");grid.className="ai-catalog-grid";
  ordered.forEach(({journal:r,score})=>{
    const card=document.createElement("article");card.className="ai-catalog-card";
    const title=document.createElement("h4");title.textContent=r.titulo;card.append(title);
    const relation=document.createElement("span");relation.className=score?"catalog-relevance direct":"catalog-relevance adjacent";relation.textContent=score?"Relação temática no catálogo":"Área adjacente da curadoria";card.append(relation);
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
  const heading=document.createElement("h3");heading.textContent="Novas possibilidades encontradas na literatura";section.append(heading);
  const lead=document.createElement("p");lead.className="ai-web-note";
  if(discovery&&discovery.journals&&discovery.journals.length){
    lead.textContent="Busca bibliográfica no Crossref para a sua pergunta, filtrada para artigos dos últimos "+(new Date().getFullYear()-(discovery.fromYear||new Date().getFullYear()-4))+" anos. Os títulos abaixo publicaram artigos relacionados aos termos pesquisados; isso não confirma escopo, indexação, taxas ou aceitação.";section.append(lead);
    const source=document.createElement("a");source.href="https://www.crossref.org/documentation/retrieve-metadata/rest-api/";source.target="_blank";source.rel="noopener noreferrer";source.className="ai-source-link";source.textContent="Fonte e método: Crossref REST API ↗";section.append(source);
    const list=document.createElement("div");list.className="ai-web-journals";
    discovery.journals.forEach(journal=>{
      const card=document.createElement("article");card.className="ai-web-journal";
      const title=document.createElement("h4");title.textContent=journal.title;card.append(title);
      const badge=document.createElement("span");badge.className=journal.inCatalog?"origin-internal":"origin-external";badge.textContent=journal.inCatalog?"Já está no catálogo":"Novo título para avaliar";card.append(badge);
      const meta=document.createElement("p");meta.textContent=journal.count+" artigos relacionados encontrados"+(journal.publisher?" · "+journal.publisher:"");card.append(meta);
      journal.papers.forEach(paper=>{if(!paper.title)return;const p=document.createElement("p");p.className="ai-web-paper";const a=document.createElement("a");a.href=paper.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=paper.title+" ↗";p.append(a);const year=document.createElement("span");year.textContent=paper.year?" ("+paper.year+")":"";p.append(year);card.append(p)});
      list.append(card);
    });
    section.append(list);
  }else{
    lead.textContent=discovery&&discovery.error?"A busca na literatura não ficou disponível nesta tentativa. As revistas do catálogo continuam acessíveis abaixo.":"A busca não encontrou registros para estes termos. Tente acrescentar o tema, a cultura, a tecnologia ou o problema do seu artigo.";section.append(lead);
  }
  parent.append(section);
}
function presentAI(raw,question,discovery){
  const el=$("ai-answer");el.replaceChildren();const wrap=document.createElement("div");wrap.className="ai-rich";
  const heading=document.createElement("h3");heading.textContent="Orientação para sua publicação";wrap.append(heading);
  const matched=ALL.filter(r=>String(raw).toLocaleLowerCase("pt-BR").includes(String(r.titulo).toLocaleLowerCase("pt-BR")));
  if(matched.length){
    const sub=document.createElement("p");sub.className="ai-rich-sub";sub.textContent="Revistas mencionadas na resposta da IA e cadastradas no catálogo. Abra cada ficha para consultar os dados completos.";wrap.append(sub);
    const grid=document.createElement("div");grid.className="ai-rich-grid";
    matched.forEach(r=>{const card=document.createElement("article");card.className="ai-rich-card";const name=document.createElement("h4");name.textContent=r.titulo;card.append(name);card.append(makeFullRecord(r));const origin=document.createElement("span");origin.className="origin-internal";origin.textContent="Catálogo do projeto";card.append(origin);const area=document.createElement("p");area.textContent=r.area||"Área não informada";card.append(area);const metrics=document.createElement("p");metrics.className="ai-rich-metrics";metrics.textContent="SJR: "+fmt(r.sjr)+" · CiteScore: "+fmt(r.citescore);card.append(metrics);const cost=document.createElement("p");cost.textContent="Custo informado: "+fmt(r.custo);card.append(cost);const url=safeUrl(r.url_ficha||r.url);if(url){const a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Abrir site externo ↗";card.append(a);const external=document.createElement("small");external.className="external-link-note";external.textContent="Endereço externo à UFT; confirme as informações na fonte.";card.append(external)}grid.append(card)});
    wrap.append(grid);
  }
  appendCrossrefResults(wrap,discovery);
  wrap.append(makeAllCatalogSection(question));
  const details=document.createElement("details");details.className="ai-explanation";details.open=!matched.length;
  const summary=document.createElement("summary");summary.textContent=matched.length?"Ler explicação completa da IA":"Resposta da IA";details.append(summary);
  const body=document.createElement("div");body.className="ai-explanation-text";body.textContent=raw;details.append(body);wrap.append(details);
  const note=document.createElement("p");note.className="source-disclaimer";note.textContent="Fontes: catálogo do projeto e registros bibliográficos do Crossref, quando encontrados. Uma ocorrência em artigo não confirma que uma revista seja adequada ao seu manuscrito; verifique o escopo e as regras atuais na página oficial.";wrap.append(note);
  el.append(wrap);
}
async function askAI(){
  const question=$("ai-question").value.trim(),status=$("ai-status"),answer=$("ai-answer");if(!question)return;
  status.hidden=false;status.textContent="Consultando o assistente e buscando artigos relacionados no Crossref…";answer.textContent="";
  $("ai-loading").hidden=false;$("ai-search-button").disabled=true;$("ai-search-button").textContent="Pesquisando…";
  const webPromise=searchCrossref(question).catch(error=>({journals:[],error:error.message,fromYear:new Date().getFullYear()-4}));
  let aiText="",aiError="";
  try{
    const resp=await fetch("https://muddy-field-7b19.michael-oliveira.workers.dev/api/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question,catalog:ALL.map(r=>({titulo:r.titulo,area:r.area,escopo:r.alinhamento||r.observacoes||r.escopo,idioma:r.idioma,sjr:r.sjr,custo:r.custo,citescore:r.citescore,fatorImpacto:r.fatorImpacto,url:r.url_ficha||r.url}))})});
    const data=await resp.json().catch(()=>({}));if(!resp.ok)throw Error(data.error||"Falha no serviço de IA");aiText=data.answer||"Sem resposta.";
  }catch(error){aiError=error.message||"Falha no serviço de IA";aiText="O assistente de IA está indisponível nesta tentativa. Consulte as revistas relacionadas do catálogo e as referências bibliográficas recentes abaixo."}
  const discovery=await webPromise;presentAI(aiText,question,discovery);
  status.textContent=aiError?"IA indisponível; busca acadêmica externa e catálogo carregados quando disponíveis. Erro: "+aiError:
    discovery.error?"IA consultou o catálogo; Crossref indisponível nesta tentativa. A lista completa do catálogo continua abaixo.":
    "A resposta combina o catálogo do projeto com artigos recentes localizados no Crossref. Consulte os links das fontes e confirme o escopo diretamente com a revista.";
  $("ai-loading").hidden=true;$("ai-search-button").disabled=false;$("ai-search-button").textContent="Pesquisar";
}
function exportCsv(){const cols=["titulo","area","editora","sjr","idioma","custo","alinhamento","citescore","fatorImpacto","url_ficha"];const csv=[cols.join(";"),...ALL.map(r=>cols.map(k=>'"'+String(r[k]??"").replaceAll('"','""')+'"').join(";"))].join("\n");const a=document.createElement("a");const u=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.href=u;a.download="revistas-ppgad.csv";a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}
const JOURNAL_COVERS={
  5:"https://ars.els-cdn.com/content/image/X09596526.jpg",
  4:"https://ars.els-cdn.com/content/image/X09601481.jpg",
  1:"https://ars.els-cdn.com/content/image/X01681699.jpg",
  10:"https://ars.els-cdn.com/content/image/X03014797.jpg",
  14:"https://ars.els-cdn.com/content/image/X01678809.jpg"
};
function featuredSelection(rows){
  return rows.filter(r=>r.citescore!==null && r.citescore!=="" && Number.isFinite(Number(r.citescore)))
    .sort((a,b)=>Number(b.citescore)-Number(a.citescore)||a.titulo.localeCompare(b.titulo,"pt-BR")).slice(0,5);
}
function renderFeatured(){
  const target=$("featured-journals");if(!target)return;
  target.innerHTML=featuredSelection(ALL).map((r,i)=>'<a class="featured-journal" href="#revista-'+esc(r.id)+'" data-featured-id="'+esc(r.id)+'"><span class="cover-miniature"><span class="cover-fallback" aria-hidden="true"><span>REVISTA</span><b>'+esc(r.titulo)+'</b><i></i></span>'+(JOURNAL_COVERS[r.id]?'<img src="'+esc(JOURNAL_COVERS[r.id])+'" alt="Capa de '+esc(r.titulo)+'" width="66" height="88" loading="lazy" referrerpolicy="no-referrer">':'')+'</span><span class="featured-info"><span class="featured-rank">0'+(i+1)+' · '+esc(fmt(r.sjr))+'</span><strong>'+esc(r.titulo)+'</strong><span class="featured-score">CiteScore <b>'+esc(fmt(r.citescore))+'</b></span><span class="featured-link">Ver no catálogo ↗</span></span></a>').join("");
  target.querySelectorAll("img").forEach(img=>img.addEventListener("error",()=>{img.hidden=true;img.alt="";}));
  target.addEventListener("click",event=>{
    const link=event.target.closest("[data-featured-id]");if(!link)return;
    const journal=ALL.find(r=>String(r.id)===link.dataset.featuredId);if(!journal)return;
    event.preventDefault();
    ["area","sjr","idioma","custo"].forEach(id=>$(id).value="");$("q").value=journal.titulo;render();
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

async function init(){const res=await fetch(DATA_URL,{cache:"no-store"});if(!res.ok)throw Error("Não foi possível carregar a base de revistas");const data=await res.json();ALL=(data.revistas||[]).map((r,i)=>({...r,id:r.id??i+1}));BASE=data.fonteArquivo||data.baseAtualizada||"planilha do projeto";$("base-data").textContent=BASE;[...new Set(ALL.map(r=>r.area).filter(Boolean))].sort().forEach(v=>$("area").add(new Option(v,v)));["q","area","sjr","idioma","custo","ord"].forEach(id=>$(id).addEventListener("input",render));$("limpar").onclick=()=>{["q","area","sjr","idioma","custo"].forEach(id=>$(id).value="");render()};$("lista").addEventListener("change",e=>{const id=e.target.dataset.id;if(!id)return;if(e.target.checked){if(SELECTED.size>=4){e.target.checked=false;alert("Selecione até quatro revistas.");return}SELECTED.add(id)}else SELECTED.delete(id);renderCompare()});$("csv").onclick=exportCsv;$("ai-search-form").addEventListener("submit",e=>{e.preventDefault();askAI()});$("pdf-download").onclick=()=>window.print();render();renderFeatured();setupBanner()}init().catch(e=>{$("lista").textContent=e.message;if($("featured-journals"))$("featured-journals").textContent="Não foi possível carregar os destaques. Tente atualizar a página.";console.error(e)});
