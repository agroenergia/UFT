const targets=document.querySelectorAll('[data-provenance]');
fetch('./assets/data/revistas.json',{cache:'no-store',signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{
 for(const target of targets){target.replaceChildren();const p=document.createElement('p');p.textContent='Última atualização editorial da base: '+(data.atualizadoEm||'A confirmar')+'. Fontes e anos de referência:';target.append(p);
 const list=document.createElement('ul');for(const source of data.fontesIndicadores||[]){const li=document.createElement('li'),a=document.createElement('a');a.textContent=source.nome;const url=new URL(source.url);if(url.protocol==='https:')a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';li.append(a,document.createTextNode(' — '+source.ano));list.append(li)}target.append(list);
 }
}).catch(()=>targets.forEach(t=>t.textContent='Data e fontes indisponíveis no momento. Atualize a página ou consulte a equipe; não foi possível confirmar a atualização.'));
