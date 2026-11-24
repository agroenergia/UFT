"""Auditoria trimestral automatizada de revistas elegíveis aos Acordos CAPES / Universidades Federais."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REVISTAS_PATH = os.path.join(ROOT, "assets", "data", "revistas.json")
LOG_PATH = os.path.join(ROOT, "assets", "data", "atualizacoes-log.json")
REPORT_PATH = os.path.join(ROOT, "assets", "data", "capes-relatorio-trimestral.json")
OPENALEX_API_KEY = os.environ.get("OPENALEX_API_KEY", "").strip()
HEADERS = {"User-Agent": "RigorAtlas-QuarterlyCAPES/1.1 (mailto:mdqmichael@gmail.com)"}
OPENALEX_BLOCKED = False

# Editoras com contratos vigentes Read & Publish / PADICT (Portaria CAPES nº 120/2024)
CAPES_AGREEMENT_RULES = [
    ("elsevier", "Elsevier", "Acordo CAPES Read & Publish (Elsevier)"),
    ("springer", "Springer Nature", "Acordo CAPES–Springer Nature (PADICT)"),
    ("biomed central", "Springer Nature (BMC)", "Acordo CAPES–Springer Nature / BMC"),
    ("bmc", "Springer Nature (BMC)", "Acordo CAPES–Springer Nature / BMC"),
    ("wiley", "Wiley", "Acordo CAPES–Wiley (acesso aberto em híbridos)"),
    ("american chemical society", "ACS", "Acordo CAPES–ACS (Portaria nº 120/2024)"),
    ("acs", "ACS", "Acordo CAPES–ACS (Portaria nº 120/2024)"),
    ("ieee", "IEEE", "Acordo CAPES–IEEE (híbridos e acesso aberto)"),
    ("institute of electrical", "IEEE", "Acordo CAPES–IEEE"),
    ("association for computing machinery", "ACM", "Acordo CAPES–ACM Open"),
    ("acm", "ACM", "Acordo CAPES–ACM Open"),
    ("royal society", "Royal Society Publishing", "Acordo CAPES–Royal Society Publishing"),
]


def norm_text(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s or "").strip().lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def match_capes_rule(publisher: str | None):
    p = norm_text(publisher or "")
    if not p:
        return None
    for needle, label, desc in CAPES_AGREEMENT_RULES:
        if re.search(rf"\b{re.escape(needle)}\b", p):
            return (label, desc)
    return None


def fetch_openalex_publisher(issn: str) -> dict | None:
    global OPENALEX_BLOCKED
    if not OPENALEX_BLOCKED:
        url = f"https://api.openalex.org/sources/issn:{issn}?mailto=mdqmichael@gmail.com"
        if OPENALEX_API_KEY:
            url += f"&api_key={urllib.parse.quote(OPENALEX_API_KEY)}"
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=12) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            if err.code == 429:
                OPENALEX_BLOCKED = True
        except Exception:
            pass
    try:
        cr_url = f"https://api.crossref.org/journals/{urllib.parse.quote(issn)}?mailto=mdqmichael@gmail.com"
        req = urllib.request.Request(cr_url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as resp:
            msg = json.loads(resp.read().decode("utf-8")).get("message") or {}
            if msg.get("publisher"):
                return {"host_organization_name": msg["publisher"]}
    except Exception:
        pass
    return None


def load_log() -> dict:
    if os.path.exists(LOG_PATH):
        try:
            with open(LOG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"ultimaAtualizacaoSemanal": None, "ultimaAuditoriaTrimestralCapes": None, "historico": []}


def main():
    parser = argparse.ArgumentParser(description="Auditoria trimestral do painel CAPES e Universidades Federais.")
    parser.add_argument("--verify-online", action="store_true", help="Confere editora atual no OpenAlex para registros sem vínculo CAPES.")
    parser.add_argument("--dry-run", action="store_true", help="Simula sem gravar arquivos.")
    args = parser.parse_args()

    with open(REVISTAS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    rows = data.get("revistas", [])
    today = dt.date.today().isoformat()

    by_publisher: dict[str, int] = {}
    confirmed_capes = 0
    flagged_by_publisher = 0
    online_checked = 0

    for rec in rows:
        pub = rec.get("editora") or ""
        rule = match_capes_rule(pub)

        if args.verify_online and rec.get("acordoCapes") is None and online_checked < 40:
            issns = re.findall(r"\b\d{4}-\d{3}[\dXx]\b", str(rec.get("issn") or ""))
            if issns:
                src = fetch_openalex_publisher(issns[0])
                online_checked += 1
                if src and src.get("host_organization_name"):
                    if not pub:
                        rec["editora"] = src["host_organization_name"]
                        pub = rec["editora"]
                    rule = match_capes_rule(src["host_organization_name"]) or rule
                time.sleep(0.08)

        if rule:
            label, desc = rule
            by_publisher[label] = by_publisher.get(label, 0) + 1
            rec["painelCapesTrimestral"] = {
                "editoraConveniada": label,
                "contratoReferencia": desc,
                "ultimaRevisao": today,
                "criterioInstituicaoParticipante": "Exige autor correspondente vinculado a instituição participante, ORCID validado em meusdados.capes.gov.br e e-mail institucional.",
            }
            if rec.get("acordoCapes") is True:
                confirmed_capes += 1
            elif rec.get("acordoCapes") is None:
                # Marca como candidata por editora conveniada sem inventar cobertura individual garantida
                flagged_by_publisher += 1
                notes = rec.setdefault("conferenciasOnline", [])
                note = f"Auditoria trimestral CAPES ({today}): editora {label} conveniada (confirmar título individual e cota)."
                if isinstance(notes, list) and note not in notes:
                    notes.append(note)
        elif rec.get("acordoCapes") is True:
            confirmed_capes += 1
            pub_lbl = pub or "Editora cadastrada"
            by_publisher[pub_lbl] = by_publisher.get(pub_lbl, 0) + 1

    next_quarter = (dt.date.today() + dt.timedelta(days=90)).isoformat()
    report = {
        "dataAuditoria": today,
        "proximaAuditoriaPrevista": next_quarter,
        "normativa": "Portaria CAPES nº 120/2024 · PADICT Read & Publish · Instituições Participantes",
        "totalCatalogo": len(rows),
        "comAcordoCapesConfirmado": confirmed_capes,
        "candidatasEditoraConveniadaCAPES": flagged_by_publisher,
        "verificacoesOnline": online_checked,
        "distribuicaoPorEditoraCAPES": dict(sorted(by_publisher.items(), key=lambda kv: (-kv[1], kv[0]))),
        "requisitosObrigatoriosCAPES": [
            "Identificador ORCID validado e vinculado em meusdados.capes.gov.br",
            "Autor correspondente com vínculo ativo com instituição brasileira participante do acordo CAPES",
            "Uso obrigatório do e-mail institucional oficial da instituição participante na submissão",
            "Aprovação regular por revisão por pares e disponibilidade de cota anual da editora",
        ],
    }

    log = load_log()
    log["ultimaAuditoriaTrimestralCapes"] = today
    log["proximaAuditoriaTrimestralCapes"] = next_quarter
    log["totaisAtuais"] = {
        "totalRevistas": len(rows),
        "comScopus": sum(1 for r in rows if r.get("indexacaoScopus") is True),
        "comWos": sum(1 for r in rows if r.get("indexacaoWos") is True),
        "comAcordoCapes": sum(1 for r in rows if r.get("acordoCapes") is True),
    }
    log.setdefault("historico", []).insert(
        0,
        {
            "tipo": "trimestral_capes",
            "data": today,
            "confirmadasCAPES": confirmed_capes,
            "candidatasEditoraConveniada": flagged_by_publisher,
            "proximaPrevista": next_quarter,
        },
    )
    log["historico"] = log["historico"][:30]

    if not args.dry_run:
        with open(REVISTAS_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        with open(REPORT_PATH, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        with open(LOG_PATH, "w", encoding="utf-8") as f:
            json.dump(log, f, ensure_ascii=False, indent=2)

    print(f"[Trimestral CAPES] Confirmadas={confirmed_capes}, Candidatas por editora={flagged_by_publisher}, Online={online_checked}")
    print("Editoras CAPES:", report["distribuicaoPorEditoraCAPES"])


if __name__ == "__main__":
    main()
