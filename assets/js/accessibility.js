const STORAGE_KEY="rigoratlas_a11y_v1";
const SPEECH_SUPPORTED=typeof window!=="undefined"&&"speechSynthesis" in window&&typeof window.SpeechSynthesisUtterance==="function";

const defaultState=()=>({calm:false,focus:false,contrast:false,scale:100,autoRead:false,rate:1});
let state=loadState();
let readingQueue=[];
let readingIndex=-1;
let isReadingSequence=false;
let activeHighlightEl=null;
let lastSpokenText="";
let lastSpokenAt=0;

function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return defaultState();
    const parsed=JSON.parse(raw);
    return{
      calm:Boolean(parsed.calm),
      focus:Boolean(parsed.focus),
      contrast:Boolean(parsed.contrast),
      scale:[100,112,125].includes(Number(parsed.scale))?Number(parsed.scale):100,
      autoRead:Boolean(parsed.autoRead),
      rate:[0.9,1,1.15,1.3].includes(Number(parsed.rate))?Number(parsed.rate):1
    };
  }catch{
    return defaultState();
  }
}

function saveState(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}
}

function pickPortugueseVoice(){
  if(!SPEECH_SUPPORTED)return null;
  const voices=window.speechSynthesis.getVoices()||[];
  return voices.find(v=>/^pt-br$/i.test(v.lang))
    ||voices.find(v=>/^pt/i.test(v.lang))
    ||voices.find(v=>/portugu[eê]s|brazil/i.test(v.name))
    ||null;
}

function liveAnnounce(text){
  const el=document.getElementById("a11y-live");
  if(!el)return;
  el.textContent="";
  requestAnimationFrame(()=>{el.textContent=text;});
}

function clearSpeakingHighlight(){
  if(activeHighlightEl){
    activeHighlightEl.classList.remove("a11y-speaking");
    activeHighlightEl=null;
  }
}

function highlightElement(el){
  clearSpeakingHighlight();
  if(!el)return;
  activeHighlightEl=el;
  el.classList.add("a11y-speaking");
}

function stopSpeech(){
  isReadingSequence=false;
  readingQueue=[];
  readingIndex=-1;
  clearSpeakingHighlight();
  if(SPEECH_SUPPORTED){
    try{window.speechSynthesis.cancel();}catch{}
  }
  syncButtons();
}

function speakText(text,{interrupt=true,onEnd=null,force=false}={}){
  const clean=String(text||"").replace(/\s+/g," ").trim();
  if(!clean)return;
  liveAnnounce(clean);
  if(!SPEECH_SUPPORTED)return;
  if(!state.autoRead&&!isReadingSequence&&!force)return;
  const now=Date.now();
  if(!force&&clean===lastSpokenText&&now-lastSpokenAt<900)return;
  lastSpokenText=clean;
  lastSpokenAt=now;
  if(interrupt){
    try{window.speechSynthesis.cancel();}catch{}
  }
  const utter=new SpeechSynthesisUtterance(clean);
  utter.lang="pt-BR";
  utter.rate=state.rate||1;
  const voice=pickPortugueseVoice();
  if(voice)utter.voice=voice;
  if(typeof onEnd==="function"){
    utter.onend=onEnd;
    utter.onerror=onEnd;
  }
  try{
    window.speechSynthesis.speak(utter);
  }catch{}
}

function extractReadableElementText(el){
  if(!el)return "";
  const aria=el.getAttribute("aria-label");
  if(el.matches("input,textarea,select")){
    const id=el.id;
    const lbl=id?document.querySelector(`label[for="${CSS.escape(id)}"]`):el.closest("label");
    const labelText=aria||(lbl?lbl.innerText:"Campo");
    const val=el.tagName==="SELECT"?(el.options[el.selectedIndex]?.text||""):(el.value||el.placeholder||"");
    return `${labelText}. ${val}`.trim();
  }
  if(el.classList.contains("journal-card")){
    const title=el.querySelector("h3")?.innerText||"Revista";
    const area=el.querySelector(".journal-area")?.innerText||"";
    const metrics=Array.from(el.querySelectorAll(".journal-metrics span")).map(s=>s.innerText).join(", ");
    const cost=el.querySelector(".journal-cost")?.innerText||"";
    return `Revista ${title}. ${area}. ${metrics}. ${cost}`.trim();
  }
  if(el.classList.contains("featured-journal")){
    const rank=el.querySelector(".featured-rank")?.innerText||"";
    const title=el.querySelector("strong")?.innerText||"";
    const score=el.querySelector(".featured-score")?.innerText||"";
    return `Destaque ${rank}: ${title}. ${score}`.trim();
  }
  if(el.classList.contains("faq-question")||el.closest(".faq-item")){
    const summary=el.classList.contains("faq-question")?el:el.closest(".faq-item")?.querySelector(".faq-question");
    const item=summary?.closest("details");
    const q=summary?.innerText||"";
    const ans=item?.open?(" Resposta: "+(item.querySelector(".faq-answer")?.innerText||"")):"";
    return (q+ans).slice(0,850);
  }
  const txt=(aria||el.innerText||el.textContent||"").replace(/\s+/g," ").trim();
  return txt.slice(0,500);
}

function buildPageQueue(){
  const selectors=[
    ".banner-copy h1",
    ".banner-copy .banner-lead",
    ".banner-video-hero .hero-video-title",
    ".featured-heading h2",
    "#featured-criteria",
    "#featured-journals .featured-journal",
    "#ai-answer .ai-section-head h3",
    "#ai-answer .ai-base-card",
    "#como-funciona .section-heading h2",
    "#como-funciona .flow-step",
    "#revistas .catalog-heading h2",
    "#revistas #count",
    "#revistas #lista .journal-card:nth-child(-n+6)",
    "#sinais-alerta h2",
    "#sinais-alerta .predatory-intro",
    "#comparar h2",
    "#faq h2",
    "#faq .faq-item",
    "#sugerir h2",
    ".site-footer .footer-grid",
    ".legal-compliance-footer h2",
    ".legal-compliance-footer .legal-card",
    ".check-main h1",
    ".check-lead",
    ".check-group h2",
    ".information-page h1",
    ".information-page h2",
    ".information-page p",
    ".journal-detail h1",
    ".journal-detail section",
    ".access-card h1",
    ".access-card p"
  ];
  const nodes=[];
  const seen=new Set();
  for(const sel of selectors){
    document.querySelectorAll(sel).forEach(node=>{
      if(seen.has(node))return;
      if(node.offsetParent===null&&getComputedStyle(node).position!=="fixed")return;
      const text=extractReadableElementText(node);
      if(text){
        seen.add(node);
        nodes.push({el:node,text});
      }
    });
  }
  if(!nodes.length){
    document.querySelectorAll("main h1,main h2,main p,main li").forEach(node=>{
      if(seen.has(node)||node.offsetParent===null)return;
      const text=extractReadableElementText(node);
      if(text){seen.add(node);nodes.push({el:node,text});}
    });
  }
  return nodes;
}

function advanceQueue(){
  if(!isReadingSequence)return;
  readingIndex+=1;
  if(readingIndex>=readingQueue.length){
    stopSpeech();
    speakText("Leitura da página concluída.",{force:true});
    return;
  }
  const step=readingQueue[readingIndex];
  highlightElement(step.el);
  try{
    step.el.scrollIntoView({behavior:state.calm?"auto":"smooth",block:"center"});
  }catch{}
  syncButtons();
  speakText(step.text,{interrupt:true,force:true,onEnd:()=>{
    if(isReadingSequence)setTimeout(advanceQueue,180);
  }});
}

function startOrTogglePageRead(){
  if(isReadingSequence){
    stopSpeech();
    return;
  }
  const heroVideo=document.getElementById("hero-video");
  if(heroVideo&&!heroVideo.paused)heroVideo.pause();
  readingQueue=buildPageQueue();
  if(!readingQueue.length)return;
  readingIndex=-1;
  isReadingSequence=true;
  syncButtons();
  advanceQueue();
}

function applyTheme(){
  const root=document.documentElement;
  root.setAttribute("data-a11y-calm",state.calm?"true":"false");
  root.setAttribute("data-a11y-focus",state.focus?"true":"false");
  root.setAttribute("data-a11y-contrast",state.contrast?"true":"false");
  root.setAttribute("data-a11y-scale",String(state.scale));
  syncButtons();
  saveState();
}

function syncButtons(){
  const setPressed=(id,val)=>{
    const el=document.getElementById(id);
    if(el)el.setAttribute("aria-pressed",String(Boolean(val)));
  };
  setPressed("a11y-calm",state.calm);
  setPressed("a11y-focus",state.focus);
  setPressed("a11y-contrast",state.contrast);
  setPressed("a11y-auto-read",state.autoRead);
  setPressed("a11y-read-page",isReadingSequence);

  const readBtn=document.getElementById("a11y-read-page");
  if(readBtn)readBtn.textContent=isReadingSequence?"⏸ Pausar leitura":"▶ Ouvir página";
  const stopBtn=document.getElementById("a11y-stop");
  if(stopBtn)stopBtn.hidden=!isReadingSequence;
  const rateSel=document.getElementById("a11y-rate");
  if(rateSel)rateSel.value=String(state.rate);
  if(!SPEECH_SUPPORTED){
    ["a11y-auto-read","a11y-read-page","a11y-stop","a11y-rate"].forEach(id=>{
      const el=document.getElementById(id);
      if(el)el.disabled=true;
    });
  }
}

function initFocusHoverHighlight(){
  const cardsSelector=".journal-card,.featured-journal,.faq-item,.flow-step,.ai-base-card,.predatory-details li";
  document.addEventListener("pointerenter",e=>{
    if(!state.focus)return;
    const card=e.target.closest?.(cardsSelector);
    if(card){
      document.querySelectorAll(".a11y-card-active").forEach(n=>{if(n!==card)n.classList.remove("a11y-card-active");});
      card.classList.add("a11y-card-active");
    }
  },true);
  document.addEventListener("focusin",e=>{
    if(state.focus){
      const card=e.target.closest?.(cardsSelector);
      document.querySelectorAll(".a11y-card-active").forEach(n=>{if(n!==card)n.classList.remove("a11y-card-active");});
      if(card)card.classList.add("a11y-card-active");
    }
    if(state.autoRead&&!isReadingSequence){
      const target=e.target.closest?.(".journal-card,.featured-journal,.faq-item,a,button,input,select,textarea,summary,h1,h2,h3");
      if(target){
        highlightElement(target);
        speakText(extractReadableElementText(target));
      }
    }
  });
  document.addEventListener("click",e=>{
    if(!state.autoRead||isReadingSequence)return;
    if(e.target.closest?.(".a11y-bar"))return;
    const target=e.target.closest?.(".journal-card,.featured-journal,.faq-question,.flow-step,.ai-base-card,tr,h1,h2,h3,p");
    if(target){
      highlightElement(target);
      speakText(extractReadableElementText(target));
    }
  });
}

function bindControls(){
  document.getElementById("a11y-calm")?.addEventListener("click",()=>{
    state.calm=!state.calm;
    if(state.calm)state.contrast=false;
    applyTheme();
    liveAnnounce(state.calm?"Modo de conforto visual para autismo ativado. Cores suaves e menos animações.":"Modo de conforto visual desativado.");
  });
  document.getElementById("a11y-focus")?.addEventListener("click",()=>{
    state.focus=!state.focus;
    applyTheme();
    liveAnnounce(state.focus?"Modo foco ativado. Realce de leitura e contornos ampliados.":"Modo foco desativado.");
  });
  document.getElementById("a11y-contrast")?.addEventListener("click",()=>{
    state.contrast=!state.contrast;
    if(state.contrast)state.calm=false;
    applyTheme();
    liveAnnounce(state.contrast?"Alto contraste ativado.":"Alto contraste desativado.");
  });
  document.getElementById("a11y-font-inc")?.addEventListener("click",()=>{
    state.scale=state.scale===100?112:125;
    applyTheme();
    liveAnnounce("Tamanho do texto ajustado para "+state.scale+" por cento.");
  });
  document.getElementById("a11y-font-dec")?.addEventListener("click",()=>{
    state.scale=state.scale===125?112:100;
    applyTheme();
    liveAnnounce("Tamanho do texto ajustado para "+state.scale+" por cento.");
  });
  document.getElementById("a11y-auto-read")?.addEventListener("click",()=>{
    state.autoRead=!state.autoRead;
    saveState();
    syncButtons();
    if(state.autoRead){
      speakText("Leitor automático em áudio ativado. Navegue pelo teclado ou clique em qualquer elemento para ouvir o conteúdo.",{force:true});
    }else{
      stopSpeech();
      liveAnnounce("Leitor automático em áudio desativado.");
    }
  });
  document.getElementById("a11y-read-page")?.addEventListener("click",startOrTogglePageRead);
  document.getElementById("a11y-stop")?.addEventListener("click",()=>{
    stopSpeech();
    liveAnnounce("Leitura em áudio interrompida.");
  });
  document.getElementById("a11y-rate")?.addEventListener("change",e=>{
    state.rate=Number(e.target.value)||1;
    saveState();
    speakText("Velocidade ajustada para "+state.rate+" vezes.",{force:true});
  });
  document.getElementById("a11y-reset")?.addEventListener("click",()=>{
    stopSpeech();
    state=defaultState();
    applyTheme();
    liveAnnounce("Preferências de acessibilidade redefinidas para o padrão.");
  });

  ["hero-video","checklist-video"].forEach(vidId=>{
    document.getElementById(vidId)?.addEventListener("play",()=>{
      if(isReadingSequence||SPEECH_SUPPORTED){
        stopSpeech();
      }
    });
  });

  document.getElementById("hero-play-btn")?.addEventListener("click",()=>{
    const vid=document.getElementById("hero-video");
    if(!vid)return;
    vid.scrollIntoView({behavior:state.calm?"auto":"smooth",block:"center"});
    vid.focus();
    vid.play().catch(()=>{});
  });

  document.querySelectorAll(".video-chapter-btn[data-seek]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const targetId=btn.dataset.seekTarget||"hero-video";
      const vid=document.getElementById(targetId);
      if(!vid)return;
      const t=Number(btn.dataset.seek)||0;
      document.querySelectorAll(".video-chapter-btn[data-seek]").forEach(b=>{
        if((b.dataset.seekTarget||"hero-video")===targetId){
          b.setAttribute("aria-pressed",String(b===btn));
        }
      });
      const applySeek=()=>{
        try{vid.currentTime=t;}catch{}
      };
      if(vid.readyState>=1){
        vid.play().then(()=>applySeek()).catch(()=>{applySeek();vid.play().catch(()=>{});});
      }else{
        vid.addEventListener("loadedmetadata",()=>{applySeek();vid.play().catch(()=>{});},{once:true});
        vid.load();
      }
      liveAnnounce("Reproduzindo capítulo: "+btn.innerText);
    });
  });

  window.addEventListener("rigoratlas:announce",e=>{
    const msg=e?.detail?.message;
    if(!msg)return;
    liveAnnounce(msg);
    if(state.autoRead&&!isReadingSequence){
      speakText(msg,{interrupt:true});
    }
  });

  document.addEventListener("keydown",e=>{
    if(!e.altKey||e.ctrlKey||e.metaKey)return;
    const tag=document.activeElement?.tagName;
    if(tag==="INPUT"||tag==="TEXTAREA")return;
    const k=e.key.toLowerCase();
    if(k==="c"){e.preventDefault();document.getElementById("a11y-calm")?.click();}
    else if(k==="f"){e.preventDefault();document.getElementById("a11y-focus")?.click();}
    else if(k==="l"){e.preventDefault();document.getElementById("a11y-auto-read")?.click();}
    else if(k==="p"){e.preventDefault();document.getElementById("a11y-read-page")?.click();}
  });
}

function ensureAccessibilityUI(){
  if(!document.querySelector(".skip-link")){
    const mainEl=document.querySelector("main");
    if(mainEl){
      if(!mainEl.id)mainEl.id="conteudo-principal";
      const skip=document.createElement("a");
      skip.className="skip-link";
      skip.href="#"+mainEl.id;
      skip.textContent="Ir para o conteúdo principal";
      document.body.prepend(skip);
    }
  }
  if(!document.getElementById("a11y-live")){
    const live=document.createElement("div");
    live.id="a11y-live";
    live.className="sr-only";
    live.setAttribute("role","status");
    live.setAttribute("aria-live","polite");
    document.body.appendChild(live);
  }
}

ensureAccessibilityUI();
bindControls();
