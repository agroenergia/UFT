export const statuses={'pending':'Não iniciado','doing':'Em andamento','done':'Concluído','na':'Não se aplica'};
export function cleanState(raw,items){
 if(!raw||raw.version!==1||typeof raw.entries!=='object'||raw.entries===null)throw Error('Arquivo de checklist incompatível.');
 const text=(x,n=200)=>typeof x==='string'?x.slice(0,n):'';
 const state={version:1,title:text(raw.title),journal:text(raw.journal),target:/^\d{4}-\d{2}-\d{2}$/.test(raw.target||'')?raw.target:'',entries:{},updatedAt:text(raw.updatedAt)};
 for(const item of items){const entry=raw.entries[item.id]||{};let status=Object.hasOwn(statuses,entry.status)?entry.status:'pending';if(status==='na'&&!item.optional)status='pending';state.entries[item.id]={status,note:text(entry.note,1000)}}return state;
}
export function summary(state,items){
 const before=items.filter(i=>i.phase==='before');
 const complete=i=>state.entries[i.id]?.status==='done'||(i.optional&&state.entries[i.id]?.status==='na'&&!!state.entries[i.id]?.note.trim());
 const done=before.filter(complete).length;return {done,total:before.length,percent:Math.round(done/before.length*100),remaining:before.filter(i=>!complete(i)),afterDone:items.filter(i=>i.phase==='after'&&complete(i)).length};
}
export function checklistCSV(state,items){
 const cell=v=>'"'+(/^[\s]*[=+@-]/.test(String(v??''))?"'":'')+String(v??'').replaceAll('"','""')+'"';
 const rows=[['Marca','Artigo','Revista','Meta de envio','Etapa','Item','Orientação','Situação','Observações','Atualizado em'],...items.map(i=>['RigorAtlas',state.title,state.journal,state.target,i.group,i.title,i.help,statuses[state.entries[i.id]?.status]||statuses.pending,state.entries[i.id]?.note||'',state.updatedAt])];return '\ufeff'+rows.map(r=>r.map(cell).join(';')).join('\r\n');
}
