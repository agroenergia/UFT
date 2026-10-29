// Somente valores documentados. Ausência de dados nunca equivale a zero ou aprovação.
export const metricLabels={indexacaoScopus:'Indexação Scopus',indexacaoWos:'Indexação WoS',percentilCiteScore:'Percentil CiteScore (%)',percentilJif:'Percentil JIF (%)',maiorPercentil:'Maior percentil informado (%)',estrato:'Estrato A1–A8 informado',percentilH:'Percentil do índice H (%)',apcBRL:'APC em R$ (sem taxas extras)',acordoCapes:'Acordo CAPES informado',prazoPublicacaoDias:'Submissão até publicação (dias)',prazoPublicacaoPlanilha:'Prazo de publicação na planilha'};
export const filterIds=['indexacao','percentil','estrato','percentilH','apcMax','acordoCapes','prazoMax'];
export function numeric(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null}
export function percentile(v){const n=numeric(v);return n!==null&&n<=100?n:null}
export function metrics(r){const p=[percentile(r.percentilCiteScore),percentile(r.percentilJif)].filter(v=>v!==null);return {...r,maiorPercentil:p.length?Math.max(...p):null}}
export function matchesCriteria(record,f={}){const r=metrics(record);
 if(f.indexacao==='scopus'&&r.indexacaoScopus!==true)return false;
 if(f.indexacao==='wos'&&r.indexacaoWos!==true)return false;
 if(f.indexacao==='either'&&r.indexacaoScopus!==true&&r.indexacaoWos!==true)return false;
 if(f.percentil&&(r.maiorPercentil===null||r.maiorPercentil<Number(f.percentil)))return false;
 if(f.estrato&&r.estrato!==f.estrato)return false;
 if(f.percentilH&&(percentile(r.percentilH)===null||r.percentilH<=50))return false;
 if(f.apcMax!==undefined&&f.apcMax!==''&&(numeric(r.apcBRL)===null||r.apcBRL>Number(f.apcMax)))return false;
 if(f.acordoCapes&&r.acordoCapes!==(f.acordoCapes==='sim'))return false;
 if(f.prazoMax&&(numeric(r.prazoPublicacaoDias)===null||r.prazoPublicacaoDias>Number(f.prazoMax)))return false;
 return true;
}
export function metricText(value){return value===null||value===undefined||value===''?'A confirmar':value===true?'Sim':value===false?'Não':String(value)}
export function csvCell(v){let s=typeof v==='object'&&v!==null?JSON.stringify(v):String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
export const researchPolicy='Use o fluxograma da equipe como critérios de pesquisa, não como certificação CAPES. Confirme Scopus/WoS na base oficial; maior percentil entre CiteScore e JIF >=50 (preferência >=80), com ano, categoria e fonte; percentil H >50 na categoria SJR; análise antipredatória humana; escopo, tipo de artigo e idioma compatíveis; APC e taxas extras, moeda/data e condições de acordo CAPES; prazo da submissão até publicação. Não confunda valor CiteScore/JIF com percentil, quartil com percentil ou primeira decisão com publicação. Não calcule estrato A1–A8 sem tabela oficial validada. Dados ausentes são A CONFIRMAR, nunca zero nem aprovação. Sugestões externas são candidatas a verificar; não afirmar que contam para PPGAD, que são gratuitas ou que serão publicadas em uma data. Recomende validação pelo orientador.';
