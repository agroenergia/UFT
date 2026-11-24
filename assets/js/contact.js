import {recordCustomAction} from "./visitor-tracker.js?v=20261118v7";

const ADMIN_EMAIL="mdqmichael@gmail.com";

function buildMessagePayload(){
  const nome=(document.getElementById("nome")?.value||"").trim()||"Não informado";
  const email=(document.getElementById("email")?.value||"").trim()||"Não informado";
  const assunto=(document.getElementById("assunto")?.value||"Contato RigorAtlas").trim();
  const mensagem=(document.getElementById("mensagem")?.value||"").trim();
  const canal=document.querySelector('input[name="contact-channel"]:checked')?.value||"gmail";
  const subject=`[RigorAtlas] ${assunto}`;
  const body=[
    "Mensagem enviada pelo portal RigorAtlas:",
    `Assunto: ${assunto}`,
    `Nome: ${nome}`,
    `E-mail para resposta: ${email}`,
    "",
    "Mensagem:",
    mensagem,
    "",
    `Página de origem: ${location.href}`
  ].join("\n");

  const gmailUrl=`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(ADMIN_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const mailtoUrl=`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return {nome,email,assunto,mensagem,canal,subject,body,gmailUrl,mailtoUrl};
}

function showFeedback(payload){
  const box=document.getElementById("contact-feedback");
  if(!box)return;
  box.hidden=false;
  const gmailLink=document.getElementById("contact-gmail-link");
  const mailtoLink=document.getElementById("contact-mailto-link");
  const status=document.getElementById("contact-status-text");
  if(gmailLink)gmailLink.href=payload.gmailUrl;
  if(mailtoLink)mailtoLink.href=payload.mailtoUrl;
  if(status){
    status.textContent=payload.canal==="copy"
      ?"Mensagem preparada e copiada abaixo. Cole no seu e-mail ou envie pelos botões ao lado para "+ADMIN_EMAIL+"."
      :"Mensagem preparada para "+ADMIN_EMAIL+". Caso a janela de e-mail não tenha aberto automaticamente, use os botões diretos abaixo.";
  }
}

function setupContactForm(){
  const form=document.getElementById("suggest-form");
  if(!form)return;
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const msgEl=document.getElementById("mensagem");
    if(msgEl&&!msgEl.value.trim()){
      msgEl.focus();
      return;
    }
    const payload=buildMessagePayload();
    showFeedback(payload);
    recordCustomAction(`Contato preparado (${payload.assunto})`);

    if(payload.canal==="gmail"){
      window.open(payload.gmailUrl,"_blank","noopener,noreferrer");
    }else if(payload.canal==="mailto"){
      window.location.href=payload.mailtoUrl;
    }else if(navigator.clipboard?.writeText){
      try{
        await navigator.clipboard.writeText(`Para: ${ADMIN_EMAIL}\nAssunto: ${payload.subject}\n\n${payload.body}`);
      }catch{}
    }
  });

  document.getElementById("contact-copy-btn")?.addEventListener("click",async()=>{
    const payload=buildMessagePayload();
    const full=`Para: ${ADMIN_EMAIL}\nAssunto: ${payload.subject}\n\n${payload.body}`;
    if(navigator.clipboard?.writeText){
      try{
        await navigator.clipboard.writeText(full);
        const st=document.getElementById("contact-status-text");
        if(st)st.textContent="Texto copiado para a área de transferência ("+ADMIN_EMAIL+").";
      }catch{}
    }
  });
}

setupContactForm();
