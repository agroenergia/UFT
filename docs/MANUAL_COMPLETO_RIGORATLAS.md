# Manual Completo do Portal RigorAtlas — PPGAD / UFT

**Portal:** `https://agroenergia.github.io/UFT/`  
**Programa:** Programa de Pós-Graduação em Agroenergia Digital (PPGAD) — Universidade Federal do Tocantins (UFT)  
**Equipe:** Michael Oliveira e Neiber Garcia (Desenvolvimento e Pesquisa) · Prof. Dr. Guilherme Benko Siqueira (Orientação Acadêmica)  
**Atualização deste manual:** 18/11/2026

---

## 1. Visão Geral do Sistema

O **RigorAtlas** é um portal acadêmico de apoio à decisão para estudantes e pesquisadores selecionarem periódicos científicos alinhados às exigências da pós-graduação e às políticas da CAPES, reunindo catálogo curado, indicadores internacionais (**Scopus** e **Web of Science**), cruzamento dos **Acordos de Leitura e Publicação (CAPES Read & Publish)**, assistente conversacional integrado à **API OpenAlex**, recursos avançados de **acessibilidade** e **rotinas automatizadas** de atualização semanal e trimestral.

### Páginas Principais do Portal

| Arquivo / Rota | Finalidade | Acesso |
| --- | --- | --- |
| `index.html` | Portal principal: Vídeo Hero (5 min), destaques >50% Scopus, Radar OpenAlex/CAPES, Vídeo-Checklist (7 requisitos), catálogo filtrável, comparação lado a lado, FAQ, prevenção anti-predatórias, contato e Planilha XLS | Público |
| `base-planilha.html` | Visualização tabular completa e download direto de toda a base de revistas em Excel (`.xls`) ou `.csv` | Público |
| `ficha-revista.html?id=...` | Ficha detalhada individual do periódico com métricas Scopus, Web of Science, classificador JCR, APC, CAPES e links oficiais | Público |
| `checklist.html` | Checklist completo interativo com 29 etapas de preparação e exportação CSV/JSON/Excel antes da submissão | Público |
| `sobre.html` | Metodologia editorial, fontes de indicadores e equipe | Público |
| `privacidade.html` | Aviso de privacidade, armazenamento local e conformidade LGPD | Público |
| `catalogo-pdf.html` | Versão formatada para impressão / geração de PDF | Público |
| `acesso.html` | Área técnica restrita (login administrativo + painel de auditoria de visitas `.txt` / `.json` + sincronização Google Sheets) | Somente por URL direta (invisível na navegação pública) |

---

## 2. Vídeo de Apresentação (Hero) e Vídeo-Checklist de Elegibilidade

### 2.1 Vídeo Hero de Apresentação (`#apresentacao`)
- **Arquivo:** `assets/video/apresentacao-rigoratlas.mp4` (`~26,9 MB`, 5 min 11 s) com legendas em Português (`assets/video/apresentacao-rigoratlas.vtt`).
- **Botão Hero ("▶ Assistir ao vídeo agora")** e **6 capítulos navegáveis:** Visão geral (`0:00`), Pesquisa (`0:34`), Comparar (`1:24`), PPGAD & CAPES (`2:08`), Predatórias (`3:21`) e Contato (`4:20`).
- **Integração com acessibilidade:** quando o vídeo inicia, qualquer leitura por voz ativa (`Web Speech API`) é pausada automaticamente para evitar sobreposição sonora.

### 2.2 Vídeo-Checklist de Requisitos para Publicação (`#requisitos-publicacao`)
- **Arquivo:** `assets/video/checklist-requisitos.mp4` (`99 s`) com legendas `assets/video/checklist-requisitos.vtt` e pôster `assets/img/checklist-video-poster.jpg`.
- **Painel Interativo 0/7 → 7/7:** ao lado do vídeo, o pesquisador marca os **7 requisitos essenciais** para verificar se o artigo pode ser publicado na revista escolhida:
  1. **Escopo e alinhamento editorial** (aderência temática e publicações recentes)
  2. **Indexação Scopus, WoS e percentil ≥ 50** (CiteScore `sourceid` e Quartil/Percentil JIF no JCR)
  3. **Cobertura CAPES (Read & Publish) ou rota sem taxa** (autor correspondente UFT / assinatura gratuita)
  4. **Idioma aceito e categoria do artigo** (Português/Inglês, original, revisão ou nota técnica)
  5. **Prazo de primeira decisão e revisão por pares** (cronograma compatível com defesa/bolsa)
  6. **Verificação anti-predatórias** (ISSN oficial, DOAJ, conselho editorial e políticas COPE)
  7. **Normas, aprovação ética (CEP/CEUA) e ORCID** (dados abertos, CRediT e ORCID CAPES)
- As marcações ficam salvas em `localStorage` (`rigoratlas_req_checklist_v1`) e dão acesso direto ao Checklist completo de 29 etapas (`checklist.html`).

---

## 3. Janela Flutuante de Bate-Papo IA (`Artigos & Onde Publicar`)

Implementada em `assets/js/openalex-chat.js`, fica disponível no botão flutuante inferior direito (**`Artigos & Onde Publicar`** — *"Busque estudos e onde foram publicados"*) e pelos atalhos da página principal (`Busque Artigos e Onde Publicar`).

### Como funciona a busca inteligente no Chat
1. O usuário digita em linguagem natural um **tema de pesquisa**, **artigo de interesse**, **autor** (ex.: `"guilherme benko"`) ou **nome da revista**.
2. O módulo executa busca paralela e agregada com remoção de duplicidades por DOI/título:
   - **Autores / Pesquisadores (ORCID + Crossref):** identifica automaticamente pesquisadores no registro público do **ORCID** (exibindo cartão do pesquisador com filiação institucional e vínculo UFT) e recupera toda a lista de artigos publicados sem misturar homônimos;
   - **Pesquisas temáticas (OpenAlex + Crossref Works + Crossref Journals + PubMed E-utilities + Base Local):** expande termos técnicos PT → EN (`expandSearchTerms`), agrega até **25+ artigos** por busca com paginação progressiva (**"Mostrar mais artigos"**) e cruza cada periódico encontrado contra os **Acordos CAPES / rede nacional SciELO-IES**.
3. Para cada artigo científico encontrado, o assistente exibe:
   - Título clicável com link direto para o DOI;
   - **Aonde foi publicado** (revista, editora, ano, citações e ISSN);
   - **Verificação automática de Acordo CAPES / Rede Nacional:**
     - `✓ Faz parte do Acordo CAPES (gratuidade para autor UFT)` — vínculo confirmado no catálogo com link para a ficha completa;
     - `◐ Editora com Acordo CAPES (...)` — editora conveniada na Portaria CAPES (Elsevier, Springer Nature, Wiley, ACS, IEEE, ACM, Royal Society);
     - `★ Periódico institucional / rede nacional (SciELO / IES)` — periódicos universitários e redes abertas nacionais como SciELO e UFT;
     - `✓ Revista já avaliada no RigorAtlas` ou `○ Sem vínculo CAPES identificado`.
4. **Experiência limpa para o usuário e chave opcional OpenAlex:** nenhuma mensagem técnica de bloqueio de IP ou erro de cota é exibida na interface de chat. Caso deseje conectar uma chave gratuita própria do OpenAlex no navegador de testes, é possível passá-la via parâmetro `?openalex_key=SUA_CHAVE` ou no console (`window.setRigorAtlasOpenAlexKey(...)`), ficando armazenada apenas no `localStorage`.

---

## 4. Pesquisa Principal, Filtros, WoS, Comparação e Planilha XLS

### 4.1 Busca Superior + Destaques >50% Scopus
- A barra superior busca **primeiro** na base local (`revistas.json`) com correspondência semântica por área/tema (`"glicose"`, `"bioenergia"`, etc.) e apresenta resultados complementares do **Crossref** para consulta exploratória.
- Botões de dúvida no topo (**Aceita português?**, **Tem opção sem taxa?**, **Meu artigo combina?**) levam diretamente ao FAQ correspondente.
- O bloco **5 revistas em destaque (> 50% na Scopus)** seleciona dinamicamente títulos verificados na Scopus: 1 na faixa >50%, 1 no patamar de 75% e 3 de alto nível (99%).

### 4.2 Classificadores Scopus & Web of Science (WoS)
- **Scopus:** `CiteScore 2025`, notas por categoria, `Percentil CiteScore` e link oficial `https://www.scopus.com/sourceid/{id}`.
- **Web of Science (`SCIE`, `SSCI`, `ESCI`):** pontuação `JIF`, **Quartil JIF (Q1–Q4)** e **Percentil JIF por categoria no JCR** apontados como o principal classificador oficial de ranqueamento na WoS.

### 4.3 Comparação e Planilha XLS
- Marque **Comparar** em até 4 periódicos para gerar tabela comparativa completa em `#comparar`.
- A página `base-planilha.html` e os módulos `assets/js/xls-export.js` + `assets/js/base-planilha.js` permitem filtrar e baixar toda a base atualizada em formato **Excel (`.xls`)** ou **CSV (`.csv`)**.

---

## 5. Acessibilidade Avançada (Autismo, Modo Foco e Leitor em Áudio)

Implementada em `assets/js/accessibility.js` e sincronizada entre todas as páginas via `localStorage` (`rigoratlas_a11y_v1`):
- **Conforto Visual (Autismo · `Alt+C`):** paleta neutra cálida de baixo brilho, remoção de transições/animações bruscas e espaçamento relaxado.
- **Modo Foco (`Alt+F`):** atenua elementos periféricos (`opacity: 0.74`) e destaca o cartão ou item focado/em leitura.
- **Alto Contraste** e **Escala de Fonte (`A-` / `A+`)** até `125%`.
- **Leitor Automático em Áudio (`Alt+L` / `Alt+P`):** síntese em português (`pt-BR`) via `Web Speech API` com seletor de velocidade (`0.9x` a `1.3x`) e pausa automática ao reproduzir os vídeos do portal.

---

## 6. Rotinas Automatizadas de Atualização (Semanal & Trimestral CAPES)

O portal conta com dois workflows no **GitHub Actions** + scripts Python auditáveis:

### 6.1 Ampliação Semanal Automatizada (Toda segunda-feira às 06:00 UTC)
- **Workflow:** `.github/workflows/atualizacao-semanal-revistas.yml`
- **Script:** `scripts/atualizacao_semanal_openalex.py`
- **Funcionamento:**
  1. Enriquece ISSNs e idiomas pendentes no catálogo via **OpenAlex REST API** (lendo `OPENALEX_API_KEY` do GitHub Secrets quando configurado).
  2. Descobre novos periódicos científicos ativos nas áreas do PPGAD/UFT (bioenergia, agricultura digital, agroecologia, renováveis, biotecnologia, água e carbono).
  3. Aplica trava de proteção contra periódicos predatórios: caso o OpenAlex atinja cota sem chave ou como reforço editorial, utiliza apenas periódicos com revisão por pares validada na **DOAJ API** e editoras acadêmicas confiáveis (Wiley, Springer, Elsevier, Frontiers, Oxford, IEEE, ACS, etc.).
  4. Novos registros entram marcados explicitamente como `"Em conferência"` (sem jamais inventar CiteScore ou JIF) e atualizam `assets/data/atualizacoes-log.json`.

### 6.2 Auditoria Trimestral CAPES & Universidades Federais (A cada 3 meses — dia 1 às 07:00 UTC)
- **Workflow:** `.github/workflows/atualizacao-trimestral-capes.yml`
- **Script:** `scripts/atualizacao_trimestral_capes.py`
- **Funcionamento:**
  1. Analisa todas as editoras do catálogo em face aos acordos vigentes da **Portaria CAPES nº 120/2024 / PADICT Read & Publish** (Elsevier, Springer Nature/BMC, Wiley, ACS, IEEE, ACM, Royal Society Publishing).
  2. Verifica editoras via OpenAlex/Crossref (quando `--verify-online` ativo), preenche metadados em `painelCapesTrimestral` respeitando os requisitos de elegibilidade UFT (autor correspondente vinculado, ORCID em `meusdados.capes.gov.br` e e-mail institucional `@uft.edu.br`).
  3. Gera o relatório auditável `assets/data/capes-relatorio-trimestral.json` e alimenta os cartões ao vivo do painel `#tech-telemetry` via `assets/js/tech-status.js`.

> **Importante sobre GitHub Actions:** Para que o robô semanal e trimestral use sua cota dedicada da OpenAlex (`$1/dia`), adicione a secret `OPENALEX_API_KEY` em **Settings → Secrets and variables → Actions** no repositório `agroenergia/UFT`.

---

## 7. Contato Direto, Registro de Visitas Invisível e Área Técnica

- **Contato (`assets/js/contact.js`):** o formulário **Fale com o administrador** envia via **Gmail Web pré-preenchido**, aplicativo de e-mail padrão (`mailto:`) ou botão **Copiar mensagem** diretamente para `mdqmichael@gmail.com`.
- **Rastreio e Área Técnica Invisíveis ao Público:**
  - Não existe nenhum link, menu ou contador visível nas páginas públicas (`index.html`, `privacidade.html`, etc.) apontando para `acesso.html` ou exibindo visitas na tela.
  - O módulo silencioso `assets/js/visitor-tracker.js` grava logs técnicos locais (`rigoratlas_visits_v1`, data/hora, página, dispositivo, resolução e ações) e oferece sincronização opcional HTTPS para uma planilha Google Sheets (via Google Apps Script Web App).
  - Administradores autorizados acessam `https://agroenergia.github.io/UFT/acesso.html` diretamente pela URL para exportar logs em `.txt` / `.json` ou gerenciar o catálogo (autenticação com hash SHA-256).

---

## 8. Como Publicar Atualizações no GitHub

Na pasta raiz do projeto (`uft-main`), basta executar o script de publicação no Windows:
1. Abra o repositório local e execute `Subir_para_GitHub.bat` (envia o branch atual ao GitHub após revisar).
2. Quando mesclado no branch `main`, o workflow `.github/workflows/pages.yml` publica automaticamente o portal em `https://agroenergia.github.io/UFT/`.
