import {evaluateJournal,expectedPublication} from './eligibility.js';
import {metrics,numeric} from './criteria.js';
const labels={pass:'Critérios informados atendidos',pending:'Informações a conferir',fail:'Há critério não atendido'};
const status={pass:'Atende',pending:'A confirmar',fail:'Não atende'};
export function apcText(r){return r.apcOriginal==null?'APC não documentada':typeof r.apcOriginal==='number'?(r.moedaApc||'Moeda não informada')+' '+r.apcOriginal.toLocaleString('pt-BR')+' (acesso aberto; antes de impostos)':String(r.apcOriginal)}
export function comparisonHTML(records,esc){
 const missing='Sem dado documentado';
 const value=v=>v==null||v===''?missing:v===true?'Sim':v===false?'Não':String(v);
 const evidence=(r,k,url)=>{const e=r.evidenciasMetricas?.[k]||{};url=url||e.url;return /^https?:\/\//.test(url||'')?' <small><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Fonte</a>'+esc(e.consultadoEm?' · consulta '+e.consultadoEm:r.consultaEditorial?' · consulta '+r.consultaEditorial:'')+'</small>':''};
 const cell=(r,k,v,url)=>esc(value(v===undefined?r[k]:v))+evidence(r,k,url);
 const rows=[
 ['Área e escopo',r=>esc(value(r.escopo||r.alinhamento||r.area))],
 ['Editora',r=>cell(r,'editora')],['ISSN',r=>cell(r,'issn')],['Idioma',r=>cell(r,'idioma')],
 ['Indexação Scopus',r=>cell(r,'indexacaoScopus',undefined,r.scopusSourceId?'https://www.scopus.com/sourceid/'+r.scopusSourceId:null)],
 ['Indexação Web of Science',r=>cell(r,'indexacaoWos',r.colecaoWos||r.indexacaoWos)],
 ['CiteScore (pontuação)',r=>cell(r,'citescore',r.citescore==null?null:r.citescore+' · '+(r.anoCiteScore||'ano não documentado'))],
 ['Percentis CiteScore por categoria',r=>cell(r,'percentilCiteScore',r.percentisCiteScorePorCategoria?.length?r.percentisCiteScorePorCategoria.map(c=>c.percentil+'% · '+c.categoria+' · posição '+c.posicao+'/'+c.total+' ('+c.ano+')').join('; '):r.percentilCiteScore==null?null:r.percentilCiteScore+'%')],
 ['Maior percentil disponível',r=>esc(metrics(r).maiorPercentil==null?missing:metrics(r).maiorPercentil+'%')],
 ['Fator de impacto JIF (pontuação)',r=>cell(r,'fatorImpacto',r.fatorImpacto==null?null:r.fatorImpacto+' · '+(r.anoFatorImpacto||r.evidenciasMetricas?.fatorImpacto?.anoIndicador||'ano não documentado'),r.fonteEditorial)],
 ['Quartil SJR informado',r=>cell(r,'sjr')],
 ['Modelo de publicação',r=>cell(r,'modeloPublicacao',undefined,r.fonteEditorial)],
 ['APC de acesso aberto (moeda original)',r=>cell(r,'apcOriginal',apcText(r),r.fonteAPC)],
 ['Publicação por assinatura / custo informado',r=>esc(value(r.taxaRotaAssinatura||r.custo))+evidence(r,'apcOriginal',r.fonteAPC)],
 ['Primeira decisão (não é publicação)',r=>cell(r,'prazoPrimeiraDecisaoDias',r.prazoPrimeiraDecisao||(r.prazoPrimeiraDecisaoDias!=null?r.prazoPrimeiraDecisaoDias+' dias (mediana)':null),r.fonteEditorial)],
 ['Decisão após revisão',r=>cell(r,'prazoDecisaoAposRevisao',undefined,r.fonteEditorial)],
 ['Submissão até aceite',r=>cell(r,'prazoAceite',undefined,r.fonteEditorial)],
 ['Aceite até publicação online',r=>cell(r,'prazoAceitePublicacao',undefined,r.fonteEditorial)],
 ['Prazo total de publicação',r=>cell(r,'prazoPublicacaoDias',r.prazoPublicacaoDias==null?(r.notaPrazos||missing):r.prazoPublicacaoDias+' dias')],
 ['Participação no acordo CAPES',r=>cell(r,'acordoCapes',r.acordoCapes===true?'Título incluído; cobertura depende da elegibilidade do autor, instituição e artigo':r.acordoCapes===false?'Não incluído conforme cadastro':'Participação não documentada')],
 ['Percentil JIF',r=>cell(r,'percentilJif')],['Percentil H',r=>cell(r,'percentilH')],['Estrato informado',r=>cell(r,'estrato')],
 ['Instruções aos autores',r=>evidence(r,'urlInstrucoes',r.urlInstrucoes)||missing]
 ];
 return '<p>Valores com fonte e data disponíveis no cadastro. APC refere-se à opção de acesso aberto; primeira decisão não equivale a publicação. Campos sem evidência permanecem identificados.</p><table><caption class="sr-only">Comparação das revistas selecionadas</caption><thead><tr><th scope="col">Indicador</th>'+records.map(r=>'<th scope="col">'+esc(r.titulo)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(([label,render])=>'<tr><th scope="row">'+label+'</th>'+records.map(r=>'<td>'+render(r)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
}
export function journalCriteriaHTML(r,esc){
 const source=(key)=>{const e=r.evidenciasMetricas?.[key];if(!e||!/^https?:\/\//.test(e.url||''))return '';const label=/scopus\.com\/sourceid\//.test(e.url)?'Página oficial na Scopus ↗':'Fonte ↗';return ' <small>'+esc([e.anoIndicador,e.categoria].filter(Boolean).join(' · '))+' <a href="'+esc(e.url)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>'+(e.urlArquivo?' · <a href="'+esc(e.urlArquivo)+'" target="_blank" rel="noopener noreferrer">Planilha CiteScore</a>':'')+'</small>'};
 const review=evaluateJournal(r);
 const indexes=['indexacaoScopus','indexacaoWos'].filter(k=>r[k]===true&&r.evidenciasMetricas?.[k]);
 const indexed=indexes.length?indexes.map(k=>(k==='indexacaoScopus'?'Scopus — CiteScore '+(numeric(r.citescore)===null?'não disponível':r.citescore.toLocaleString('pt-BR')):'Web of Science')+source(k)).join('; '):'Não localizada nas fontes consultadas';
 const ranks=['percentilCiteScore','percentilJif'].filter(k=>typeof r[k]==='number'&&r.evidenciasMetricas?.[k]);
 const ranked=ranks.length?ranks.map(k=>(k==='percentilCiteScore'?'CiteScore':'JIF')+': '+r[k]+'% — '+(r[k]>=50?'atende ≥ 50':'abaixo de 50')+source(k)).join('; '):'Percentil não disponível nas fontes consultadas';
 const h=review.checks[2].state==='pending'?'Não disponível na fonte consultada':r.percentilH+'% — '+status[review.checks[2].state]+source('percentilH');
 const scopusUrl=r.scopusSourceId?'https://www.scopus.com/sourceid/'+encodeURIComponent(r.scopusSourceId):'';
 const cats=Array.isArray(r.percentisCiteScorePorCategoria)&&r.percentisCiteScorePorCategoria.length?'<li><strong>Notas na Scopus por categoria ('+esc(r.anoCiteScore||2025)+')</strong>: '+r.percentisCiteScorePorCategoria.map(c=>esc(c.categoria)+': <b>'+esc(c.percentil)+'%</b> ('+esc(c.posicao)+'º de '+esc(c.total)+')').join('; ')+(scopusUrl?' · <a href="'+esc(scopusUrl)+'" target="_blank" rel="noopener noreferrer">Ver notas na Scopus ↗</a>':'')+'</li>':'';
 return '<ul class="journal-criteria"><li><strong>Indexação Scopus ou WoS</strong>: '+indexed+'</li><li><strong>Percentil CiteScore/JIF ≥ 50</strong>: '+ranked+'</li>'+cats+'<li><strong>Percentil H > 50</strong>: '+h+'</li></ul>';
}
export function journalAssessmentHTML(r,esc,start='',target=''){
 const review=evaluateJournal(r),p=metrics(r).maiorPercentil,eta=expectedPublication(r.prazoPublicacaoDias,start,target);
 const cost=numeric(r.apcBRL)===null?apcText(r):r.apcBRL.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 return '<details class="journal-assessment"><summary><span class="criteria-state '+review.state+'">'+labels[review.state]+'</span></summary><p>Verificação do roteiro da equipe; não certifica elegibilidade pelo PPGAD. Escopo, autoria e condições individuais exigem validação.</p>'+journalCriteriaHTML(r,esc)+'<ul>'+review.checks.slice(3).map(c=>'<li><strong>'+esc(c.label)+'</strong>: '+status[c.state]+'</li>').join('')+'</ul><p><strong>Posição na área:</strong> '+(p===null?'percentil a confirmar':p+'%')+'</p>'+(p===null?'':'<div class="percentile-scale" aria-label="Percentil informado '+p+' de 100; referências em 50 e 80"><div style="width:'+p+'%"></div><span class="mark-50">50</span><span class="mark-80">80</span></div>')+'<p><strong>Quanto posso pagar?</strong> APC: '+esc(cost)+'. '+esc(r.custo||'Consulte as taxas com a revista.')+'</p><p>Acordo CAPES: '+(r.acordoCapes===true?'informado; confirme sua elegibilidade':r.acordoCapes===false?'não informado como disponível':'a confirmar')+'. Taxas extras e cobertura não foram descontadas automaticamente.</p><p><strong>Cabe no meu prazo?</strong> '+(eta?'Publicação estimada: '+eta.date.split('-').reverse().join('/')+(eta.late?' — após sua data desejada.':'.'):'Prazo total a confirmar; escolha uma data de envio para estimar quando houver dias cadastrados.')+'</p>'+(r.prazoPublicacaoPlanilha?'<p>Informação da planilha: '+esc(r.prazoPublicacaoPlanilha)+'</p>':'')+'<p>Estimativa, sem garantia de aceite ou publicação. Confirme o ano, a categoria e a fonte na ficha completa.</p><a href="checklist.html?revista='+encodeURIComponent(r.id)+'">Preparar submissão no checklist →</a></details>';
}
