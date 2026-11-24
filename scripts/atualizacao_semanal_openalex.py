"""Ampliação e enriquecimento semanal automatizado da base RigorAtlas via API REST OpenAlex."""
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
OPENALEX_API_KEY = os.environ.get("OPENALEX_API_KEY", "").strip()
HEADERS = {"User-Agent": "RigorAtlas-WeeklyUpdater/1.1 (mailto:mdqmichael@gmail.com)"}
OPENALEX_BLOCKED = False

CAPES_PUBLISHERS = (
    ("elsevier", "Elsevier"),
    ("springer", "Springer Nature"),
    ("biomed central", "Springer Nature (BMC)"),
    ("nature portfolio", "Springer Nature"),
    ("wiley", "Wiley"),
    ("american chemical society", "American Chemical Society (ACS)"),
    ("ieee", "IEEE"),
    ("institute of electrical and electronics engineers", "IEEE"),
    ("association for computing machinery", "ACM"),
    ("royal society", "Royal Society Publishing"),
)

WEEKLY_QUERIES = [
    ("Bioenergia e biocombustíveis", "bioenergy OR biofuel OR biomass conversion"),
    ("Agricultura digital e tecnologias", "precision agriculture OR digital farming OR agricultural sensor"),
    ("Sustentabilidade e agroecologia", "sustainable agriculture OR agroecology OR circular bioeconomy"),
    ("Energia renovável e solar", "renewable energy OR solar photovoltaic OR green hydrogen"),
    ("Biotecnologia industrial", "industrial biotechnology OR fermentation OR bioprocess"),
    ("Ambiente, água e carbono", "carbon sequestration OR water management OR remote sensing environment"),
]


def norm_text(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s or "").strip().lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"\([^)]*\)", " ", s).replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def norm_issn(s: str) -> list[str]:
    return [x.upper() for x in re.findall(r"\b\d{4}-\d{3}[\dXx]\b", str(s or ""))]


def fetch_json(url: str):
    global OPENALEX_BLOCKED
    if "api.openalex.org" in url:
        if OPENALEX_BLOCKED:
            return None
        sep = "&" if "?" in url else "?"
        if "mailto=" not in url:
            url = f"{url}{sep}mailto=mdqmichael@gmail.com"
            sep = "&"
        if OPENALEX_API_KEY and "api_key=" not in url:
            url = f"{url}{sep}api_key={urllib.parse.quote(OPENALEX_API_KEY)}"

    for attempt in range(2):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            if err.code == 429:
                body = err.read().decode("utf-8", "ignore")
                if "daily_budget" in body or "api.openalex.org" in url:
                    OPENALEX_BLOCKED = True
                    return None
                time.sleep(1.0 * (attempt + 1))
                continue
            if err.code in (502, 503, 504):
                time.sleep(0.8 * (attempt + 1))
                continue
            return None
        except Exception:
            return None
    return None


def match_capes_publisher(publisher: str | None) -> str | None:
    p = norm_text(publisher or "")
    if not p:
        return None
    for needle, label in CAPES_PUBLISHERS:
        if needle in p:
            return label
    return None


def detect_language(source_id: str) -> str | None:
    sid = source_id.rsplit("/", 1)[-1]
    w = fetch_json(
        f"https://api.openalex.org/works?filter=primary_location.source.id:{sid},publication_year:>2020&group_by=language"
    )
    if not w:
        return None
    groups = w.get("group_by") or []
    total = sum(g.get("count", 0) for g in groups)
    if total < 20:
        return None
    counts = {g["key"].rsplit("/", 1)[-1]: g["count"] for g in groups if g.get("key")}
    en = counts.get("en", 0)
    pt = counts.get("pt", 0)
    if pt >= 5 and (pt / total) >= 0.04:
        return "Português/Inglês" if (en / total) >= 0.08 else "Português"
    if en / total >= 0.78:
        return "Inglês"
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
    parser = argparse.ArgumentParser(description="Ampliação semanal automática de revistas via OpenAlex.")
    parser.add_argument("--max-add", type=int, default=8, help="Máximo de novas revistas candidatas por execução semanal.")
    parser.add_argument("--dry-run", action="store_true", help="Executa sem gravar arquivos em disco.")
    args = parser.parse_args()

    with open(REVISTAS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    rows = data.get("revistas", [])

    known_titles = {norm_text(r.get("titulo", "")) for r in rows if r.get("titulo")}
    known_issns = set()
    for r in rows:
        known_issns.update(norm_issn(r.get("issn", "")))

    today = dt.date.today().isoformat()
    enriched_count = 0
    added_titles: list[str] = []

    # 1. Enriquecer até 20 registros existentes que ainda tenham idioma/ISSN pendentes
    pending = [r for r in rows if not r.get("issn") or not r.get("idioma")][:20]
    for rec in pending:
        issns = norm_issn(rec.get("issn", ""))
        src = None
        for issn in issns:
            src = fetch_json(f"https://api.openalex.org/sources/issn:{issn}")
            if src and src.get("id"):
                break
        if src is None and rec.get("titulo"):
            q = re.sub(r"\([^)]*\)", "", rec["titulo"]).strip()
            res = fetch_json("https://api.openalex.org/sources?search=" + urllib.parse.quote(q) + "&per-page=5")
            nt = norm_text(rec["titulo"])
            if res:
                for cand in res.get("results", []):
                    if norm_text(cand.get("display_name", "")) == nt:
                        src = cand
                        break
        if not src:
            continue
        changed = False
        if not rec.get("issn"):
            chosen_issn = src.get("issn_l") or ((src.get("issn") or [None])[0])
            if chosen_issn:
                rec["issn"] = chosen_issn
                known_issns.update(norm_issn(chosen_issn))
                changed = True
        if not rec.get("idioma") and src.get("id"):
            lang = detect_language(src["id"])
            if lang:
                rec["idioma"] = lang
                changed = True
        if changed:
            enriched_count += 1
        time.sleep(0.1)

    # 2. Descobrir novas revistas candidatas em periódicos ativos no OpenAlex
    for area_label, query in WEEKLY_QUERIES:
        if len(added_titles) >= args.max_add:
            break
        url = (
            "https://api.openalex.org/sources?"
            + urllib.parse.urlencode(
                {
                    "search": query,
                    "filter": "type:journal,works_count:>300",
                    "sort": "cited_by_count:desc",
                    "per-page": "12",
                }
            )
        )
        res = fetch_json(url)
        if not res:
            continue
        for src in res.get("results", []):
            if len(added_titles) >= args.max_add:
                break
            title = (src.get("display_name") or "").strip()
            nt = norm_text(title)
            src_issns = [i.upper() for i in (src.get("issn") or [])]
            if not title or nt in known_titles or any(i in known_issns for i in src_issns):
                continue

            stats = src.get("summary_stats") or {}
            mean_2yr = float(stats.get("2yr_mean_citedness") or 0)
            h_idx = int(stats.get("h_index") or 0)
            if mean_2yr < 2.2 or h_idx < 30:
                continue

            issn_l = src.get("issn_l") or (src_issns[0] if src_issns else "")
            if not issn_l:
                continue
            homepage = (src.get("homepage_url") or "").strip()
            if homepage and not homepage.startswith(("https://", "http://")):
                homepage = ""
            if not homepage:
                homepage = src.get("id", "")

            publisher = (src.get("host_organization_name") or "").strip() or "Editora a confirmar"
            capes_pub = match_capes_publisher(publisher)
            is_oa = bool(src.get("is_oa"))
            oa_id = src.get("id", "").rsplit("/", 1)[-1]
            lang = detect_language(src["id"]) or "Inglês"

            new_entry = {
                "id": f"openalex-{oa_id.lower()}",
                "titulo": title,
                "area": area_label,
                "sjr": None,
                "idioma": lang,
                "custo": (
                    f"Editora conveniada CAPES ({capes_pub}); confirmar título e cota vigente no Portal CAPES."
                    if capes_pub
                    else ("Acesso aberto informado no OpenAlex; confirmar eventual APC no site da revista." if is_oa else "Confirmar modelo de publicação e eventual APC nas instruções aos autores.")
                ),
                "alinhamento": f"Candidata descoberta automaticamente na busca semanal OpenAlex ({area_label}); validar aderência de escopo e métricas oficiais antes de submeter.",
                "url": homepage,
                "tier": None,
                "citescore": None,
                "fatorImpacto": None,
                "editora": publisher,
                "origem": "Ampliação semanal automática (OpenAlex)",
                "origemCadastro": "Ampliação semanal automática (OpenAlex)",
                "statusConferencia": "Em conferência",
                "observacoes": f"Descoberta via OpenAlex API em {today} (média de citações 2 anos: {mean_2yr:.2f}; índice H OpenAlex: {h_idx}). Conferir CiteScore Scopus e JIF WoS oficiais.",
                "criterioPlanilha": {"status": "confirmar", "criterio": "Candidata automática OpenAlex aguardando auditoria Scopus/WoS"},
                "enquadramento": "Em conferência",
                "modeloCusto": "confirmar",
                "escopo": f"Periódico científico indexado no OpenAlex ({area_label}).",
                "issn": issn_l,
                "atualizadoEm": today,
                "indexacaoScopus": None,
                "indexacaoWos": None,
                "percentilCiteScore": None,
                "percentilJif": None,
                "maiorPercentil": None,
                "acordoCapes": None,
                "capesEditoraConveniada": capes_pub,
                "conferenciasOnline": [f"OpenAlex API (ampliação semanal automática · {today})"],
                "openAlexId": oa_id,
            }
            rows.append(new_entry)
            known_titles.add(nt)
            known_issns.update(src_issns)
            added_titles.append(title)
            time.sleep(0.1)

    # 3. Fallback auditado via DOAJ API (revistas com revisão por pares validada e proteção contra predatórias)
    if len(added_titles) < args.max_add:
        doaj_queries = [
            ("Bioenergia e biocombustíveis", "bioenergy"),
            ("Agroenergia e agronomia", "agroecology"),
            ("Biotecnologia industrial", "fermentation"),
            ("Energia renovável e solar", "photovoltaic"),
            ("Sustentabilidade e clima", "soil water"),
            ("Agricultura digital e sensores", "precision agriculture"),
        ]
        major_publishers = (
            "wiley", "springer", "elsevier", "frontiers", "oxford", "cambridge",
            "plos", "ieee", "acs", "taylor", "mdpi", "scielo", "embrapa", "royal society", "nature"
        )
        candidates = []
        seen_cands = set()
        for area_label, dquery in doaj_queries:
            doaj_url = f"https://doaj.org/api/search/journals/{urllib.parse.quote(dquery)}?pageSize=10"
            dj = fetch_json(doaj_url)
            if not dj:
                continue
            for item in dj.get("results", []):
                bib = item.get("bibjson") or {}
                title = (bib.get("title") or "").strip()
                nt = norm_text(title)
                issns = [i.upper() for i in (bib.get("eissn"), bib.get("pissn")) if i and re.match(r"^\d{4}-\d{3}[\dXx]$", str(i))]
                langs_raw = [str(l).upper() for l in (bib.get("language") or [])]
                if not any(l in ("EN", "PT", "ES") for l in langs_raw):
                    continue
                review_proc = (bib.get("editorial") or {}).get("review_process") or []
                if not title or not issns or not review_proc or nt in known_titles or nt in seen_cands or any(i in known_issns for i in issns):
                    continue
                publisher = ((bib.get("publisher") or {}).get("name") or "Editora a confirmar").strip()
                p_norm = norm_text(publisher)
                capes_pub = match_capes_publisher(publisher)
                if not (capes_pub or any(mp in p_norm for mp in major_publishers)):
                    continue
                seen_cands.add(nt)
                prio = (2 if capes_pub else 1, 1 if "PT" in langs_raw else 0)
                candidates.append((prio, area_label, bib, issns, langs_raw, review_proc, publisher, capes_pub))

        candidates.sort(key=lambda x: (-x[0][0], -x[0][1], norm_text(x[2].get("title", ""))))
        for _, area_label, bib, issns, langs_raw, review_proc, publisher, capes_pub in candidates[: max(0, args.max_add - len(added_titles))]:
            title = (bib.get("title") or "").strip()
            nt = norm_text(title)
            issn_l = issns[0]
            refs = bib.get("ref") or {}
            homepage = (refs.get("journal") or f"https://doaj.org/toc/{issn_l}").strip()
            instr_url = (refs.get("author_instructions") or "").strip()
            apc_info = bib.get("apc") or {}
            has_apc = apc_info.get("has_apc")
            if capes_pub:
                custo_txt = f"Editora conveniada CAPES ({capes_pub}); confirmar cobertura do título e cota vigente no Portal CAPES."
                mod_custo = "acordo"
            elif has_apc is False:
                custo_txt = "Sem cobrança de taxa (Sem APC) segundo registro auditado no DOAJ."
                mod_custo = "sem_taxa"
            else:
                max_list = apc_info.get("max") or []
                val_str = f" (até {max_list[0].get('price')} {max_list[0].get('currency')})" if max_list else ""
                custo_txt = f"Acesso aberto com APC informado no DOAJ{val_str}; confirmar eventual isenção."
                mod_custo = "com_taxa"

            has_pt = "PT" in langs_raw
            has_en = "EN" in langs_raw
            lang = "Português/Inglês" if (has_pt and has_en) else ("Português" if has_pt else "Inglês")
            slug = re.sub(r"[^a-z0-9]+", "-", issn_l.lower()).strip("-")

            new_entry = {
                "id": f"doaj-{slug}",
                "titulo": title,
                "area": area_label,
                "sjr": None,
                "idioma": lang,
                "custo": custo_txt,
                "alinhamento": f"Candidata auditada pelo DOAJ descoberta na rotina semanal automática ({area_label}); validar aderência ao seu programa de pós-graduação e métricas Scopus/WoS.",
                "url": homepage,
                "urlInstrucoes": instr_url or None,
                "tier": None,
                "citescore": None,
                "fatorImpacto": None,
                "editora": publisher,
                "origem": "Ampliação semanal automática (OpenAlex/DOAJ)",
                "origemCadastro": "Ampliação semanal automática (OpenAlex/DOAJ)",
                "statusConferencia": "Em conferência",
                "observacoes": f"Indexada no DOAJ ({', '.join(review_proc)}) em {today}. Conferir CiteScore Scopus e JIF WoS oficiais.",
                "criterioPlanilha": {"status": "confirmar", "criterio": "Candidata automática DOAJ/OpenAlex aguardando auditoria Scopus/WoS"},
                "enquadramento": "Em conferência",
                "modeloCusto": mod_custo,
                "escopo": f"Periódico auditado pelo DOAJ ({area_label}).",
                "issn": issn_l,
                "atualizadoEm": today,
                "indexacaoScopus": None,
                "indexacaoWos": None,
                "percentilCiteScore": None,
                "percentilJif": None,
                "maiorPercentil": None,
                "acordoCapes": None,
                "capesEditoraConveniada": capes_pub,
                "conferenciasOnline": [f"DOAJ Auditado via rotina semanal automática ({today})"],
            }
            rows.append(new_entry)
            known_titles.add(nt)
            known_issns.update(issns)
            added_titles.append(title)
            time.sleep(0.04)

    data["atualizadoEm"] = today
    log = load_log()
    log["ultimaAtualizacaoSemanal"] = today
    log["fonteSemanal"] = "DOAJ API (revistas auditadas · fallback OpenAlex)" if OPENALEX_BLOCKED else "OpenAlex REST API"
    log["totaisAtuais"] = {
        "totalRevistas": len(rows),
        "comScopus": sum(1 for r in rows if r.get("indexacaoScopus") is True),
        "comWos": sum(1 for r in rows if r.get("indexacaoWos") is True),
        "comAcordoCapes": sum(1 for r in rows if r.get("acordoCapes") is True),
    }
    log.setdefault("historico", []).insert(
        0,
        {
            "tipo": "semanal_openalex",
            "data": today,
            "fonte": log["fonteSemanal"],
            "enriquecidas": enriched_count,
            "novasAdicionadas": len(added_titles),
            "exemplosAdicionados": added_titles,
        },
    )
    log["historico"] = log["historico"][:30]

    if not args.dry_run:
        with open(REVISTAS_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        with open(LOG_PATH, "w", encoding="utf-8") as f:
            json.dump(log, f, ensure_ascii=False, indent=2)

    print(f"[Semanal OpenAlex] Enriquecidas: {enriched_count} | Novas candidatas: {len(added_titles)} -> {added_titles}")
    print(f"Total na base: {len(rows)}")


if __name__ == "__main__":
    main()
