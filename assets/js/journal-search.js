const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function findJournalsByName(rows,query){
 const q=normalize(query);if(!q)return [];
 const exact=rows.filter(r=>normalize(r.titulo)===q);if(exact.length)return exact;
 return rows.filter(r=>{const title=normalize(r.titulo);return (' '+q+' ').includes(' '+title+' ')||(q.length>=4&&title.includes(q));});
}
