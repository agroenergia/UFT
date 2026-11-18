import {metrics as normalizeMetrics} from "./criteria.js";
import {downloadJournalsXls,downloadJournalsCsv} from "./xls-export.js?v=20261118v7";
import {recordCustomAction} from "./visitor-tracker.js?v=20261118v7";

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let ALL=[];

function filteredRows(){
  const recorte=$("xls-filter")?.value||"all";
  const busca=($("xls-search")?.value||"").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"");
  return ALL.filter(r=>{
    const pct=normalizeMetrics(r).maiorPercentil;
    if(recorte==="pct50"&&!(pct!==null&&pct>=50))return false;
    if(recorte==="capes"&&r.acordoCapes!==true)return false;
    if(recorte==="wos"&&r.indexacaoWos!==true)return false;
    if(busca){
      const hay=[r.titulo,r.area,r.editora,r.issn,r.colecaoWos,r.classificadorWos].join(" ").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"");
      if(!hay.includes(busca))return false;
    }
    return true;
  });
}

function renderTable(){
  const rows=filteredRows();
  $("xls-status").textContent=`Exibindo ${rows.length} de ${ALL.length} revistas auditadas prontas para exportar em planilha Excel (.xls).`;
  const tbody=$("xls-tbody");
  if(!tbody)return;
  tbody.innerHTML=rows.map((r,idx)=>{
    const m=normalizeMetrics(r);
    const pct=m.maiorPercentil!==null&&m.maiorPercentil!==undefined?m.maiorPercentil+"%":"—";
    const scopusCell=r.indexacaoScopus?`Sim · CiteScore ${r.citescore??"—"} (${pct})`:"Não confirmado";
    const wosCell=r.indexacaoWos?`${r.colecaoWos||"WoS"} · JIF ${r.fatorImpacto??"—"}`:"Não confirmado";
    const capesCell=r.acordoCapes===true?"Acordo CAPES":(r.custo||"A confirmar");
    const scopusUrl=r.scopusSourceId?`https://www.scopus.com/sourceid/${encodeURIComponent(r.scopusSourceId)}`:"";
    return `<tr>
      <td>${idx+1}</td>
      <td><strong>${esc(r.titulo)}</strong><br><small>${esc(r.issn||"ISSN a confirmar")}</small></td>
      <td>${esc(r.editora||"—")}</td>
      <td>${esc(r.area||"—")}</td>
      <td>${esc(scopusCell)}</td>
      <td>${esc(wosCell)}</td>
      <td>${esc(capesCell)}</td>
      <td><a href="ficha-revista.html?id=${encodeURIComponent(r.id)}" target="_blank" rel="noopener">Ficha ↗</a>${scopusUrl?` · <a href="${esc(scopusUrl)}" target="_blank" rel="noopener noreferrer">Scopus ↗</a>`:""}</td>
    </tr>`;
  }).join("")||`<tr><td colspan="8">Nenhuma revista encontrada com esse filtro.</td></tr>`;
}

async function init(){
  const res=await fetch("./assets/data/revistas.json",{cache:"no-store"});
  if(!res.ok)throw Error("Não foi possível carregar a base de revistas.");
  const data=await res.json();
  ALL=(data.revistas||[]).slice().sort((a,b)=>a.titulo.localeCompare(b.titulo,"pt-BR"));
  renderTable();

  ["dl-xls-all","dl-xls-pct50","dl-xls-filtered","dl-csv-filtered"].forEach(id=>{
    if($(id))$(id).disabled=false;
  });

  $("xls-filter")?.addEventListener("change",renderTable);
  $("xls-search")?.addEventListener("input",renderTable);

  $("dl-xls-all")?.addEventListener("click",()=>{
    const stamp=new Date().toISOString().slice(0,10);
    downloadJournalsXls(ALL,`RigorAtlas-base-completa-${ALL.length}-revistas-${stamp}.xls`);
    recordCustomAction(`Download XLS completo (${ALL.length} revistas)`);
  });
  $("dl-xls-pct50")?.addEventListener("click",()=>{
    const sub=ALL.filter(r=>{const p=normalizeMetrics(r).maiorPercentil;return p!==null&&p>=50;});
    const stamp=new Date().toISOString().slice(0,10);
    downloadJournalsXls(sub,`RigorAtlas-percentil-50plus-${sub.length}-revistas-${stamp}.xls`);
    recordCustomAction(`Download XLS 50+ (${sub.length} revistas)`);
  });
  $("dl-xls-filtered")?.addEventListener("click",()=>{
    const rows=filteredRows();
    const stamp=new Date().toISOString().slice(0,10);
    downloadJournalsXls(rows,`RigorAtlas-selecao-${rows.length}-revistas-${stamp}.xls`);
    recordCustomAction(`Download XLS filtrado (${rows.length} revistas)`);
  });
  $("dl-csv-filtered")?.addEventListener("click",()=>{
    const rows=filteredRows();
    const stamp=new Date().toISOString().slice(0,10);
    downloadJournalsCsv(rows,`RigorAtlas-planilha-${rows.length}-revistas-${stamp}.csv`);
    recordCustomAction(`Download CSV (${rows.length} revistas)`);
  });
  $("dl-print")?.addEventListener("click",()=>window.print());
}

init().catch(err=>{
  $("xls-status").textContent=err.message||"Erro ao carregar os dados.";
});
