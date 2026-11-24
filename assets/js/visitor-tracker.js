const VISIT_KEY="rigoratlas_visits_v1";
const SESSION_KEY="rigoratlas_session_visit_id";
const SYNC_URL_KEY="rigoratlas_remote_sync_url";
const DEFAULT_REMOTE_ENDPOINT="";
const MAX_ENTRIES=500;

export function getRemoteSyncUrl(){
  try{
    return localStorage.getItem(SYNC_URL_KEY)||DEFAULT_REMOTE_ENDPOINT||"";
  }catch{
    return DEFAULT_REMOTE_ENDPOINT||"";
  }
}

export function setRemoteSyncUrl(url){
  const clean=String(url||"").trim();
  try{
    if(clean)localStorage.setItem(SYNC_URL_KEY,clean);
    else localStorage.removeItem(SYNC_URL_KEY);
  }catch{}
  return clean;
}

export function sendRemoteVisit(entry){
  const endpoint=getRemoteSyncUrl();
  if(!endpoint||!/^https:\/\//i.test(endpoint))return false;
  try{
    const payload=JSON.stringify({evento:"visita_rigoratlas",...entry});
    if(navigator.sendBeacon){
      const blob=new Blob([payload],{type:"text/plain;charset=utf-8"});
      if(navigator.sendBeacon(endpoint,blob))return true;
    }
    fetch(endpoint,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:payload,keepalive:true}).catch(()=>{});
    return true;
  }catch{
    return false;
  }
}

function detectBrowserAndOs(ua){
  const s=String(ua||"");
  let browser="Navegador";
  if(/Edg\//.test(s))browser="Edge";
  else if(/OPR\/|Opera/.test(s))browser="Opera";
  else if(/Chrome\//.test(s))browser="Chrome";
  else if(/Firefox\//.test(s))browser="Firefox";
  else if(/Safari\//.test(s))browser="Safari";

  let os="Sistema";
  if(/Windows NT 10|Windows NT 11/.test(s))os="Windows 10/11";
  else if(/Windows/.test(s))os="Windows";
  else if(/Android/.test(s))os="Android";
  else if(/iPhone|iPad|iOS/.test(s))os="iOS";
  else if(/Mac OS X/.test(s))os="macOS";
  else if(/Linux/.test(s))os="Linux";

  const isMobile=/Mobi|Android|iPhone|iPad/i.test(s)||window.innerWidth<=700;
  const device=window.innerWidth<=700?"Celular":isMobile?"Tablet/Móvel":"Desktop/Notebook";
  return {browser,os,device,label:`${browser} · ${os}`};
}

export function getVisitData(){
  try{
    const raw=localStorage.getItem(VISIT_KEY);
    if(!raw)return {totalVisitas:0,registros:[]};
    const parsed=JSON.parse(raw);
    return {
      totalVisitas:Number(parsed.totalVisitas)||0,
      registros:Array.isArray(parsed.registros)?parsed.registros:[]
    };
  }catch{
    return {totalVisitas:0,registros:[]};
  }
}

function saveVisitData(data){
  try{localStorage.setItem(VISIT_KEY,JSON.stringify(data));}catch{}
}

function formatDateBr(d){
  try{
    return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"medium"}).format(d);
  }catch{
    return d.toLocaleString("pt-BR");
  }
}

function registerVisit(){
  const existingSessionId=sessionStorage.getItem(SESSION_KEY);
  const data=getVisitData();
  const pageName=(location.pathname.split("/").pop()||"index.html")+(location.search||"")+(location.hash||"");

  if(existingSessionId){
    const hit=data.registros.find(r=>String(r.id)===existingSessionId);
    if(hit){
      if(!hit.paginas.includes(pageName))hit.paginas.push(pageName);
      hit.ultimoAcessoBR=formatDateBr(new Date());
      saveVisitData(data);
      updateFooterBadge(data);
      return;
    }
  }

  const now=new Date();
  const env=detectBrowserAndOs(navigator.userAgent);
  const newId=Date.now();
  const entry={
    id:newId,
    numero:data.totalVisitas+1,
    dataHoraBR:formatDateBr(now),
    ultimoAcessoBR:formatDateBr(now),
    iso:now.toISOString(),
    paginaInicial:pageName,
    paginas:[pageName],
    origem:document.referrer||"Acesso direto",
    dispositivo:env.device,
    navegadorSistema:env.label,
    resolucao:`${window.screen?.width||window.innerWidth}x${window.screen?.height||window.innerHeight}`,
    idioma:navigator.language||"pt-BR",
    acoes:[]
  };

  data.totalVisitas+=1;
  data.registros.unshift(entry);
  if(data.registros.length>MAX_ENTRIES)data.registros=data.registros.slice(0,MAX_ENTRIES);
  saveVisitData(data);
  try{sessionStorage.setItem(SESSION_KEY,String(newId));}catch{}
  sendRemoteVisit(entry);
  updateFooterBadge(data);
}

export function recordCustomAction(actionLabel){
  const sid=sessionStorage.getItem(SESSION_KEY);
  if(!sid||!actionLabel)return;
  const data=getVisitData();
  const hit=data.registros.find(r=>String(r.id)===sid);
  if(!hit)return;
  const clean=String(actionLabel).trim();
  if(clean&&!hit.acoes.includes(clean)){
    hit.acoes.push(clean);
    hit.ultimoAcessoBR=formatDateBr(new Date());
    saveVisitData(data);
  }
}

function updateFooterBadge(data){
  const el=document.getElementById("visit-counter-badge");
  if(!el)return;
  const n=data?.totalVisitas??getVisitData().totalVisitas;
  el.textContent=`Visitas registradas neste navegador: ${n}`;
}

export function formatVisitsTxt(data=getVisitData()){
  const lines=[
    "================================================================",
    "RIGORATLAS — REGISTRO TÉCNICO LOCAL DE VISITAS",
    `Gerado em: ${formatDateBr(new Date())}`,
    `Total de visitas registradas neste navegador: ${data.totalVisitas}`,
    "Obs.: Em hospedagem estática (GitHub Pages), o registro padrão fica salvo no navegador do visitante.",
    "================================================================",
    ""
  ];
  if(!data.registros.length){
    lines.push("Nenhum acesso registrado até o momento.");
    return lines.join("\r\n");
  }
  data.registros.forEach(r=>{
    lines.push(`Visita #${r.numero} | Início: ${r.dataHoraBR} | Última atividade: ${r.ultimoAcessoBR||r.dataHoraBR}`);
    lines.push(`  Página inicial : ${r.paginaInicial}`);
    lines.push(`  Páginas vistas : ${(r.paginas||[]).join(" -> ")}`);
    lines.push(`  Dispositivo    : ${r.dispositivo} (${r.navegadorSistema}, tela ${r.resolucao}, idioma ${r.idioma})`);
    lines.push(`  Origem         : ${r.origem}`);
    if(r.acoes&&r.acoes.length)lines.push(`  Ações          : ${r.acoes.join(" | ")}`);
    lines.push("----------------------------------------------------------------");
  });
  return lines.join("\r\n");
}

export function clearVisitLog(){
  saveVisitData({totalVisitas:0,registros:[]});
  try{sessionStorage.removeItem(SESSION_KEY);}catch{}
  updateFooterBadge({totalVisitas:0,registros:[]});
}

registerVisit();

window.addEventListener("hashchange",()=>{
  const h=location.hash||"";
  if(h)recordCustomAction("Navegou para "+h);
});
