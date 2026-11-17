import {evaluateJournal,expectedPublication} from './eligibility.js';
import {metrics,numeric} from './criteria.js';
const labels={pass:'Critérios informados atendidos',pending:'Informações a conferir',fail:'Há critério não atendido'};
const status={pass:'Conferido',pending:'A confirmar',fail:'Não atende'};
export function journalCriteriaHTML(r,esc){
 const source=(key)=>{const e=r.evidenciasMetricas?.[key];if(!e||!/^https?:\/\//.test(e.url||''))return '';return ' <small>'+esc([e.anoIndicador,e.categoria].filter(Boolean).join(' · '))+' <a href="'+esc(e.url)+'" target="_blank" rel="noopener noreferrer">Fonte</a>'+(e.urlArquivo?' · <a href="'+esc(e.urlArquivo)+'" target="_blank" rel="noopener noreferrer">Dados consultados</a>':'')+'</small>'};
 const review=evaluateJournal(r);
 const indexes=['indexacaoScopus','indexacaoWos'].filter(k=>r[k]===true&&r.evidenciasMetricas?.[k]);
 const indexed=indexes.length?indexes.map(k=>(k==='indexacaoScopus'?'Scopus':'Web of Science')+source(k)).join('; '):'Não localizada nas fontes consultadas';
 const ranks=['percentilCiteScore','percentilJif'].filter(k=>typeof r[k]==='number'&&r.evidenciasMetricas?.[k]);
 const ranked=ranks.length?ranks.map(k=>(k==='percentilCiteScore'?'CiteScore':'JIF')+': '+r[k]+'% — '+(r[k]>=50?'atende ≥ 50':'abaixo de 50')+source(k)).join('; '):'Percentil não disponível nas fontes consultadas';
 const h=review.checks[2].state==='pending'?'Não disponível na fonte consultada':r.percentilH+'% — '+status[review.checks[2].state]+source('percentilH');
 return '<ul class="journal-criteria"><li><strong>Indexação Scopus ou WoS</strong>: '+indexed+'</li><li><strong>Percentil CiteScore/JIF ≥ 50</strong>: '+ranked+'</li><li><strong>Percentil H > 50</strong>: '+h+'</li></ul>';
}
export function journalAssessmentHTML(r,esc,start='',target=''){
 const review=evaluateJournal(r),p=metrics(r).maiorPercentil,eta=expectedPublication(r.prazoPublicacaoDias,start,target);
 const cost=numeric(r.apcBRL)===null?'Valor em reais a confirmar':r.apcBRL.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 return '<details class="journal-assessment"><summary><span class="criteria-state '+review.state+'">'+labels[review.state]+'</span></summary><p>Verificação do roteiro da equipe; não certifica elegibilidade pelo PPGAD. Escopo, autoria e condições individuais exigem validação.</p><ul>'+review.checks.map(c=>'<li><strong>'+esc(c.label)+'</strong>: '+status[c.state]+'</li>').join('')+'</ul><p><strong>Posição na área:</strong> '+(p===null?'percentil a confirmar':p+'%')+'</p>'+(p===null?'':'<div class="percentile-scale" aria-label="Percentil informado '+p+' de 100; referências em 50 e 80"><div style="width:'+p+'%"></div><span class="mark-50">50</span><span class="mark-80">80</span></div>')+'<p><strong>Quanto posso pagar?</strong> APC: '+esc(cost)+'. '+esc(r.custo||'Consulte as taxas com a revista.')+'</p><p>Acordo CAPES: '+(r.acordoCapes===true?'informado; confirme sua elegibilidade':r.acordoCapes===false?'não informado como disponível':'a confirmar')+'. Taxas extras e cobertura não foram descontadas automaticamente.</p><p><strong>Cabe no meu prazo?</strong> '+(eta?'Publicação estimada: '+eta.date.split('-').reverse().join('/')+(eta.late?' — após sua data desejada.':'.'):'Prazo total a confirmar; escolha uma data de envio para estimar quando houver dias cadastrados.')+'</p>'+(r.prazoPublicacaoPlanilha?'<p>Informação da planilha: '+esc(r.prazoPublicacaoPlanilha)+'</p>':'')+'<p>Estimativa, sem garantia de aceite ou publicação. Confirme o ano, a categoria e a fonte na ficha completa.</p><a href="checklist.html?revista='+encodeURIComponent(r.id)+'">Preparar submissão no checklist →</a></details>';
}
