import {percentile,numeric} from './criteria.js';
export function evidence(r,key){const e=r.evidenciasMetricas?.[key];return !!(e&&/^https?:\/\//.test(e.url||'')&&/^\d{4}-\d{2}-\d{2}/.test(e.consultadoEm||''));}
function rankEvidence(r,key){const e=r.evidenciasMetricas?.[key];return evidence(r,key)&&Number.isInteger(Number(e.anoIndicador))&&Number(e.anoIndicador)>1900&&!!e.categoria;}
export function evaluateJournal(r){
 const indexKeys=['indexacaoScopus','indexacaoWos'];const verified=indexKeys.filter(k=>evidence(r,k));
 const indexed=verified.some(k=>r[k]===true)?'pass':verified.length===2&&verified.every(k=>r[k]===false)?'fail':'pending';
 const percentKeys=['percentilCiteScore','percentilJif'];const p=percentKeys.filter(k=>rankEvidence(r,k)&&percentile(r[k])!==null).map(k=>r[k]);
 const percent=p.some(v=>v>=50)?'pass':p.length===2?'fail':'pending';
 const h=rankEvidence(r,'percentilH')&&percentile(r.percentilH)!==null?(r.percentilH>50?'pass':'fail'):'pending';
 const anti=evidence(r,'analiseEditorial')&&['revisada_sem_alerta_grave','alerta_grave'].includes(r.analiseEditorial)?r.analiseEditorial==='alerta_grave'?'fail':'pass':'pending';
 const checks=[{label:'Indexação Scopus ou WoS',state:indexed},{label:'Percentil CiteScore/JIF ≥ 50',state:percent},{label:'Percentil H > 50',state:h},{label:'Revisão humana dos alertas editoriais',state:anti}];
 return {state:checks.some(c=>c.state==='fail')?'fail':checks.every(c=>c.state==='pass')?'pass':'pending',checks};
}
export function expectedPublication(days,startDate,targetDate){if(numeric(days)===null||!Number.isInteger(days)||!/^\d{4}-\d{2}-\d{2}$/.test(startDate||''))return null;const start=new Date(startDate+'T12:00:00Z');if(!Number.isFinite(start.getTime())||start.toISOString().slice(0,10)!==startDate)return null;start.setUTCDate(start.getUTCDate()+days);if(!Number.isFinite(start.getTime()))return null;const date=start.toISOString().slice(0,10);return {date,late:!!targetDate&&date>targetDate};}
