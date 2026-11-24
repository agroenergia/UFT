const CHECKLIST_STORAGE_KEY = 'rigoratlas_req_checklist_v1';

const REQUIREMENTS = [
  {
    id: 'escopo',
    num: '01',
    title: 'Escopo e alinhamento editorial',
    tip: 'Confirme nos artigos publicados recentemente se o tema e a metodologia do seu manuscrito combinam com a revista.'
  },
  {
    id: 'metricas',
    num: '02',
    title: 'Indexação Scopus, WoS e percentil ≥ 50',
    tip: 'Confira o CiteScore na Scopus (sourceid) e o Quartil/Percentil JIF no JCR da Web of Science via Portal CAPES.'
  },
  {
    id: 'capes',
    num: '03',
    title: 'Cobertura CAPES (Read & Publish) ou rota sem taxa',
    tip: 'Verifique se a editora possui acordo CAPES ativo para autor correspondente de instituição participante ou opção gratuita por assinatura.'
  },
  {
    id: 'idioma',
    num: '04',
    title: 'Idioma aceito e categoria do artigo',
    tip: 'Confirme se aceita português ou inglês e se recebe o tipo de manuscrito (artigo original, revisão ou nota técnica).'
  },
  {
    id: 'prazos',
    num: '05',
    title: 'Prazo de primeira decisão e revisão por pares',
    tip: 'Compare o tempo médio entre submissão e publicação para adequar ao cronograma da dissertação, tese ou bolsa.'
  },
  {
    id: 'predatoria',
    num: '06',
    title: 'Verificação anti-predatórias (ISSN, DOAJ, COPE)',
    tip: 'Cheque conselho editorial identificável, transparência prévia de taxas e desconfie de aceites imediatos.'
  },
  {
    id: 'etica',
    num: '07',
    title: 'Normas, aprovação ética (CEP/CEUA) e ORCID',
    tip: 'Alinhe formatação de referências, declaração de dados abertos, autoria CRediT e ORCID vinculado à CAPES.'
  }
];

function fmtDateBr(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return 'Agendada';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

async function initTechTelemetry() {
  const totalEl = document.getElementById('telemetry-total');
  if (!totalEl) return;
  try {
    const [revResp, logResp, capesResp] = await Promise.all([
      fetch('./assets/data/revistas.json'),
      fetch('./assets/data/atualizacoes-log.json').catch(() => null),
      fetch('./assets/data/capes-relatorio-trimestral.json').catch(() => null)
    ]);
    const revData = revResp.ok ? await revResp.json() : {};
    const logData = logResp && logResp.ok ? await logResp.json() : {};
    const capesData = capesResp && capesResp.ok ? await capesResp.json() : {};

    const rows = Array.isArray(revData.revistas) ? revData.revistas : [];
    const total = rows.length;
    const scopus = rows.filter(r => r.indexacaoScopus === true).length;
    const wos = rows.filter(r => r.indexacaoWos === true).length;
    const capesConf = capesData.comAcordoCapesConfirmado ?? rows.filter(r => r.acordoCapes === true).length;
    const capesCand = capesData.candidatasEditoraConveniadaCAPES ?? 0;

    totalEl.textContent = String(total);
    const scopusEl = document.getElementById('telemetry-scopus-wos');
    if (scopusEl) scopusEl.textContent = `${scopus} Scopus · ${wos} WoS`;

    const capesEl = document.getElementById('telemetry-capes');
    if (capesEl) {
      capesEl.textContent = capesCand
        ? `${capesConf} confirmadas + ${capesCand} editoras CAPES`
        : `${capesConf} confirmadas`;
    }

    const weeklyEl = document.getElementById('telemetry-weekly');
    if (weeklyEl) {
      weeklyEl.textContent = `Semanal: ${fmtDateBr(logData.ultimaAtualizacaoSemanal || revData.atualizadoEm)}`;
    }

    const quarterEl = document.getElementById('telemetry-quarterly');
    if (quarterEl) {
      quarterEl.textContent = `Próx. CAPES: ${fmtDateBr(logData.proximaAuditoriaTrimestralCapes || capesData.proximaAuditoriaPrevista)}`;
    }
  } catch {}
}

function initRequirementsChecklist() {
  const listEl = document.getElementById('req-checklist-grid');
  const scoreEl = document.getElementById('req-score-text');
  const fillEl = document.getElementById('req-score-fill');
  const statusEl = document.getElementById('req-readiness-badge');
  const resetBtn = document.getElementById('req-checklist-reset');
  if (!listEl) return;

  let checked = {};
  try {
    checked = JSON.parse(localStorage.getItem(CHECKLIST_STORAGE_KEY) || '{}') || {};
  } catch {
    checked = {};
  }

  function saveState() {
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checked));
    } catch {}
  }

  function updateSummary() {
    const done = REQUIREMENTS.filter(item => Boolean(checked[item.id])).length;
    const total = REQUIREMENTS.length;
    const pct = Math.round((done / total) * 100);
    if (scoreEl) scoreEl.textContent = `${done} de ${total} requisitos conferidos (${pct}%)`;
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (statusEl) {
      if (done === total) {
        statusEl.textContent = 'Pronto para prosseguir à submissão';
        statusEl.className = 'req-status-badge req-ready';
      } else if (done >= 4) {
        statusEl.textContent = 'Boa aderência inicial · conclua os itens restantes';
        statusEl.className = 'req-status-badge req-progress';
      } else {
        statusEl.textContent = 'Em verificação prévia';
        statusEl.className = 'req-status-badge req-pending';
      }
    }
  }

  listEl.innerHTML = '';
  REQUIREMENTS.forEach(item => {
    const label = document.createElement('label');
    label.className = 'req-check-item' + (checked[item.id] ? ' is-checked' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = Boolean(checked[item.id]);
    cb.setAttribute('aria-label', `Marcar requisito ${item.num}: ${item.title}`);

    const body = document.createElement('div');
    const head = document.createElement('strong');
    head.textContent = `${item.num}. ${item.title}`;
    const tip = document.createElement('small');
    tip.textContent = item.tip;
    body.append(head, tip);

    cb.addEventListener('change', () => {
      checked[item.id] = cb.checked;
      label.classList.toggle('is-checked', cb.checked);
      saveState();
      updateSummary();
    });

    label.append(cb, body);
    listEl.append(label);
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      checked = {};
      saveState();
      listEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
        cb.closest('.req-check-item')?.classList.remove('is-checked');
      });
      updateSummary();
    });
  }

  updateSummary();
}

function initAll() {
  initTechTelemetry();
  initRequirementsChecklist();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  initAll();
}
