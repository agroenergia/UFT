# RigorAtlas — Portal independente de apoio à publicação científica

Projeto estático, independente e sem fins lucrativos voltado para pesquisadores e estudantes consultarem, filtrarem e compararem periódicos científicos em regime **exclusivamente online (downloads desativados)**.

**Desenvolvimento e pesquisa:** Michael Oliveira (`mdqmichael@gmail.com`) e Neiber Garcia  
**Orientação acadêmica:** Prof. Dr. Guilherme Benko Siqueira

> **Independência institucional:** o RigorAtlas não possui vínculo institucional, representação oficial, patrocínio ou endosso de universidades, programas de pós-graduação, órgãos públicos ou editoras científicas.

## Objetivo
Organizar informações referenciais sobre periódicos científicos (escopo, idioma, custos/APC, Acordos CAPES, indicadores Scopus® e Web of Science™ e sinais antipredatórios), permitindo busca, filtros, comparação lado a lado e checklist interativo online.

## Estrutura
- `index.html` — interface principal com busca, navegação horizontal, catálogo, comparador e documentação jurídica fixa.
- `privacidade.html` — Política de Segurança, Independência Institucional, Direitos, Regras de Uso, APIs, IA, Scopus®, Web of Science™ e LGPD.
- `ficha-revista.html` — ficha detalhada individual de cada periódico.
- `checklist.html` — checklist interativo online de 29 etapas antes da submissão.
- `sobre.html` — metodologia editorial, fontes de indicadores e governança.
- `assets/css/style.css` — identidade visual científica limpa, responsividade e modos de acessibilidade.
- `assets/js/` — busca local, filtros, comparação, acessibilidade e assistente integrado às APIs abertas (Crossref, OpenAlex, ORCID e NCBI PubMed).
- `assets/data/revistas.json` — catálogo editorial de consulta online.
- `scripts/` — rotinas automatizadas de ampliação semanal (OpenAlex/DOAJ) e auditoria trimestral de Acordos CAPES.
- `tests/` — suíte automatizada de testes (`node --test tests/*.test.mjs`) incluindo auditoria de conformidade e independência.

## Segurança, APIs e LGPD
- **Regime somente consulta online:** todas as opções de download e exportação em massa (XLS, CSV, PDF, JSON, TXT e MP4) estão desativadas.
- **APIs públicas abertas:** Crossref REST API (com `mailto`), OpenAlex (CC0 1.0), DOAJ (CC0 1.0), ORCID Public API (CC0/ToS) e NCBI PubMed E-utilities (`tool=RigorAtlas`).
- **Sem envio a IA generativa externa:** busca assistida e síntese de voz rodam localmente no navegador.
- Nunca coloque senhas, tokens ou chaves de API diretamente no repositório.

## GitHub Pages e Testes
O projeto usa HTML, CSS e JavaScript estáticos compatíveis com GitHub Pages. Para validar todas as regras antes de publicar:

```bash
node --test tests/*.test.mjs
```
