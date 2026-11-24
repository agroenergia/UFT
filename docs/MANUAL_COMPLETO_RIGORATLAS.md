# Manual Completo do Portal RigorAtlas

**Desenvolvimento e pesquisa:** Michael Oliveira (`mdqmichael@gmail.com`) e Neiber Garcia  
**Orientação acadêmica:** Prof. Dr. Guilherme Benko Siqueira  
**Natureza:** Iniciativa independente, pública e sem fins lucrativos de apoio à pesquisa científica (sem vínculo institucional com universidades, órgãos públicos ou editoras)  
**Regime operacional:** Consulta exclusivamente online (downloads e exportações em massa desativados)  
**Atualização deste manual:** 24/11/2026

---

## 1. Visão Geral do Sistema

O **RigorAtlas** é um portal independente de apoio à decisão para estudantes e pesquisadores selecionarem periódicos científicos alinhados às exigências da pós-graduação e às políticas da CAPES, reunindo catálogo curado, indicadores internacionais referenciais (**Scopus®** e **Web of Science™**), cruzamento dos **Acordos de Leitura e Publicação (CAPES Read & Publish)**, assistente de pesquisa integrado às APIs abertas (**OpenAlex**, **Crossref**, **ORCID** e **NCBI PubMed**), recursos avançados de **acessibilidade** e **rotinas automatizadas** de atualização semanal e trimestral.

### Páginas Principais do Portal

| Arquivo / Rota | Finalidade | Acesso |
| --- | --- | --- |
| `index.html` | Portal principal: Guia editorial em 4 etapas, destaques >50% Scopus®, Radar OpenAlex/CAPES, Checklist interativo (7 requisitos), catálogo filtrável, comparação lado a lado, FAQ, prevenção anti-predatórias, contato e documentação jurídica fixa | Público |
| `ficha-revista.html?id=...` | Ficha detalhada individual do periódico com métricas referenciais Scopus®, Web of Science™, classificador JCR™, APC, CAPES e links oficiais | Público |
| `checklist.html` | Checklist completo interativo online com 29 etapas de preparação antes da submissão (salvo localmente no navegador, sem downloads) | Público |
| `sobre.html` | Metodologia editorial, cláusula de independência institucional e fontes dos dados | Público |
| `privacidade.html` | Política de Segurança da Informação, Independência Institucional, Direitos e Regras de Uso (sem downloads), conformidade das APIs/IA/Scopus®/Web of Science™ e LGPD | Público |
| `base-planilha.html` / `catalogo-pdf.html` | Páginas de aviso de desativação de exportações com redirecionamento automático para a consulta online | Público |
| `acesso.html` | Área técnica restrita (revisão local da base editorial e visualização do histórico local de visitas, sem downloads) | Somente por URL direta (invisível na navegação pública) |

---

## 2. Metodologia Editorial (4 Etapas) e Checklist Interativo (7 Requisitos)

### 2.1 Painel Metodológico no Hero (`#apresentacao`)
- Apresenta o roteiro objetivo em **4 etapas**: descobrir pelo tema/nome, avaliar impacto e indexação oficial, comparar custos/prazos/CAPES e validar integridade editorial antes da submissão.

### 2.2 Checklist Interativo de Requisitos para Publicação (`#requisitos-publicacao`)
- **Painel Interativo 0/7 → 7/7:** o pesquisador marca os **7 requisitos essenciais** para verificar se o artigo pode ser publicado na revista escolhida:
  1. **Escopo e alinhamento editorial** (aderência temática e publicações recentes)
  2. **Indexação Scopus®, WoS e percentil ≥ 50** (CiteScore™ `sourceid` e Quartil/Percentil JIF™ no JCR™)
  3. **Cobertura CAPES (Read & Publish) ou rota sem taxa** (autor correspondente vinculado a instituição participante / rota gratuita por assinatura)
  4. **Idioma aceito e categoria do artigo** (Português/Inglês, original, revisão ou nota técnica)
  5. **Prazo de primeira decisão e revisão por pares** (cronograma compatível com defesa/bolsa)
  6. **Verificação anti-predatórias** (ISSN oficial, DOAJ, conselho editorial e políticas COPE)
  7. **Normas, aprovação ética (CEP/CEUA) e ORCID** (dados abertos, CRediT e ORCID CAPES)
- As marcações ficam salvas exclusivamente em `localStorage` (`rigoratlas_req_checklist_v1`) e dão acesso direto ao Checklist completo de 29 etapas (`checklist.html`).

---

## 3. Assistente Flutuante (`Artigos & Onde Publicar`)

Implementado em `assets/js/openalex-chat.js`, fica disponível no botão flutuante inferior direito (**`Artigos & Onde Publicar`**) e pelos atalhos da página principal. Opera estritamente em **regime somente consulta online (sem downloads)**.

### Como funciona a busca inteligente no Chat
1. O usuário digita em linguagem natural um **tema de pesquisa**, **artigo de interesse**, **autor** ou **nome da revista**.
2. O módulo executa busca paralela e agregada com remoção de duplicidades por DOI/título, sem envio de dados a modelos externos de IA generativa (LLMs):
   - **Autores / Pesquisadores (ORCID + Crossref):** identifica pesquisadores no registro público do **ORCID** (CC0 / Termos de Serviço) e recupera a lista de artigos publicados sem misturar homônimos;
   - **Pesquisas temáticas (OpenAlex + Crossref Works + Crossref Journals + PubMed E-utilities + Base Local):** expande termos técnicos PT → EN (`expandSearchTerms`), agrega resultados com paginação progressiva (**"Mostrar mais artigos"**) e cruza cada periódico encontrado contra os **Acordos CAPES / rede nacional SciELO-IES**.
3. Para cada artigo científico encontrado, o assistente exibe:
   - Título clicável com link direto para o DOI;
   - **Aonde foi publicado** (revista, editora, ano, citações e ISSN);
   - Botão **`Acessar periódico online ↗`** (página oficial do periódico ou registro ISSN);
   - **Verificação automática de Acordo CAPES / Rede Nacional:**
     - `✓ Faz parte do Acordo CAPES (confirme elegibilidade institucional)` — vínculo confirmado no catálogo com link para a ficha completa;
     - `◐ Editora com Acordo CAPES (...)` — editora conveniada na Portaria CAPES (Elsevier, Springer Nature, Wiley, ACS, IEEE, ACM, Royal Society);
     - `★ Periódico institucional / rede nacional (SciELO / IES)` — periódicos universitários e redes abertas nacionais;
     - `✓ Revista já avaliada no RigorAtlas` ou `○ Sem vínculo CAPES identificado`.
4. **Conformidade das APIs:** Crossref envia `mailto`, NCBI PubMed envia `tool=RigorAtlas` e `email`, OpenAlex respeita HTTP 429 imediatamente. Chave opcional do OpenAlex pode ser configurada localmente via `?openalex_key=SUA_CHAVE` ou `window.setRigorAtlasOpenAlexKey(...)` (armazenada somente no `localStorage`).

---

## 4. Pesquisa Principal, Navegação Horizontal, Filtros, WoS e Comparação

### 4.1 Busca Superior + Navegação Horizontal Direta + Destaques >50% Scopus®
- A barra superior busca **primeiro** na base local (`revistas.json`) com correspondência semântica por área/tema e apresenta resultados complementares do **Crossref** para consulta exploratória.
- Logo abaixo da barra de pesquisa, os termos clicáveis ficam sempre visíveis em faixa horizontal (`Destaques`, `Passo a passo`, `Radar`, `7 requisitos`, `Catálogo`, `Comparar`, `Antipredatórias`, `Dúvidas`, `Política`, `Contato`).
- O bloco **5 revistas em destaque (> 50% na Scopus®)** seleciona dinamicamente títulos verificados na Scopus®: 1 na faixa >50%, 1 no patamar de 75% e 3 de alto nível (99%).

### 4.2 Classificadores Scopus® & Web of Science™ (WoS)
- **Scopus®:** `CiteScore™ 2025`, notas por categoria, `Percentil CiteScore` e link oficial `https://www.scopus.com/sourceid/{id}`.
- **Web of Science™ (`SCIE`, `SSCI`, `ESCI`):** pontuação `JIF™`, **Quartil JIF (Q1–Q4)** e **Percentil JIF por categoria no JCR™**, direcionando a conferência oficial ao `mjl.clarivate.com` e `jcr.clarivate.com` (via Portal de Periódicos da CAPES / acesso institucional CAFe).

### 4.3 Comparação Online (Sem Downloads)
- Marque **Comparar** em até 4 periódicos para gerar tabela comparativa completa em `#comparar`, diretamente no navegador, sem exportação de arquivos.

---

## 5. Acessibilidade Avançada (Autismo, Modo Foco e Leitor em Áudio)

Implementada em `assets/js/accessibility.js` e sincronizada entre todas as páginas via `localStorage` (`rigoratlas_a11y_v1`):
- **Conforto Visual (`Alt+C`):** paleta neutra cálida de baixo brilho, remoção de transições/animações bruscas e espaçamento relaxado.
- **Modo Foco (`Alt+F`):** atenua elementos periféricos (`opacity: 0.74`) e destaca o cartão ou item focado/em leitura.
- **Alto Contraste** e **Escala de Fonte (`A-` / `A+`)** até `125%`.
- **Leitor Automático em Áudio (`Alt+L` / `Alt+P`):** síntese em português (`pt-BR`) via `Web Speech API` nativa do navegador, sem envio de dados a servidores externos.

---

## 6. Rotinas Automatizadas de Atualização (Semanal & Trimestral CAPES)

O portal conta com dois workflows no **GitHub Actions** + scripts Python auditáveis:

### 6.1 Ampliação Semanal Automatizada (Toda segunda-feira às 06:00 UTC)
- **Workflow:** `.github/workflows/atualizacao-semanal-revistas.yml`
- **Script:** `scripts/atualizacao_semanal_openalex.py`
- **Funcionamento:**
  1. Enriquece ISSNs e idiomas pendentes no catálogo via **OpenAlex REST API** (lendo `OPENALEX_API_KEY` do GitHub Secrets quando configurado).
  2. Descobre novos periódicos científicos ativos em bioenergia, agricultura digital, agroecologia, renováveis, biotecnologia, água e carbono.
  3. Aplica trava de proteção contra periódicos predatórios usando apenas periódicos com revisão por pares validada na **DOAJ API** e editoras acadêmicas confiáveis.
  4. Novos registros entram marcados explicitamente como `"Em conferência"` e atualizam `assets/data/atualizacoes-log.json`.

### 6.2 Auditoria Trimestral CAPES (A cada 3 meses — dia 1 às 07:00 UTC)
- **Workflow:** `.github/workflows/atualizacao-trimestral-capes.yml`
- **Script:** `scripts/atualizacao_trimestral_capes.py`
- **Funcionamento:**
  1. Analisa todas as editoras do catálogo em face aos acordos vigentes da **Portaria CAPES nº 120/2024 / PADICT Read & Publish**.
  2. Verifica editoras via OpenAlex/Crossref (quando `--verify-online` ativo) e preenche `painelCapesTrimestral` respeitando os requisitos CAPES (autor correspondente vinculado a instituição participante, ORCID em `meusdados.capes.gov.br` e e-mail institucional).
  3. Gera o relatório auditável `assets/data/capes-relatorio-trimestral.json` e alimenta os cartões do painel `#tech-telemetry` via `assets/js/tech-status.js`.

> **Importante sobre GitHub Actions:** Para que o robô semanal e trimestral use sua cota dedicada da OpenAlex, adicione a secret `OPENALEX_API_KEY` em **Settings → Secrets and variables → Actions** no repositório do projeto.

---

## 7. Contato Direto, Registro de Visitas Local e Área Técnica

- **Contato (`assets/js/contact.js`):** o formulário **Fale com o administrador** prepara a mensagem para envio voluntário via **Gmail Web**, aplicativo de e-mail padrão (`mailto:`) ou botão **Copiar mensagem** diretamente para `mdqmichael@gmail.com`.
- **Rastreio e Área Técnica Invisíveis ao Público:**
  - Não existe nenhum link, menu ou contador visível nas páginas públicas apontando para `acesso.html`.
  - O módulo `assets/js/visitor-tracker.js` grava logs técnicos exclusivamente no `localStorage` (`rigoratlas_visits_v1`).
  - A área técnica (`acesso.html`) opera em modo somente visualização e rascunho local (downloads desativados), com alterações oficiais aplicadas mediante revisão e commit no GitHub.

---

## 8. Como Publicar Atualizações no GitHub

1. Execute `node --test tests/*.test.mjs` para validar conformidade legal, ausência de downloads e independência institucional.
2. Abra um Pull Request para o branch `main` e, após o merge, o workflow `.github/workflows/pages.yml` publica automaticamente o portal estático via GitHub Pages.
