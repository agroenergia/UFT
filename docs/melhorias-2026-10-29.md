# RigorAtlas — fluxo de pesquisa e Prioridade 1

Implementação baseada no PDF “Fluxograma de escolha da revista e melhorias do site - PPGAD”, seção 4. Os 68 registros e as datas editoriais foram preservados.

## Concluído

- Catálogo, destaques e comparação com estado de falha, tentativa novamente e timeout. Pesquisa e CSV desabilitados quando os dados não carregam.
- CSV UTF-8 com BOM, separador ponto e vírgula, campos novos, marca, nome com data e proteção contra fórmulas.
- Sobre e rodapé com data editorial e referência das bases. Ano ausente é explicitamente pendente, nunca presumido.
- Nome/e-mail opcionais, aviso de uso, página LGPD e retorno do serviço de formulário sem alegar entrega de e-mail não verificada.
- Identidade RigorAtlas; logotipo no catálogo para impressão, título de PDF e nome do CSV com a marca. CSV é texto e não comporta logotipo gráfico. Salvar como PDF depende do diálogo do navegador.
- Filtros manuais de indexação, maior percentil, estrato informado, percentil H, APC, acordo CAPES e prazo total; mesmos critérios alimentam catálogo e contexto do assistente existente.
- Crossref permanece descoberta temática; candidatas externas não têm as métricas verificadas e são identificadas como pendentes. Títulos conhecidos incompatíveis com os filtros não são reintroduzidos como sugestões externas.

## Cadastro dos novos campos

`assets/data/revistas.json`: campos ausentes têm `null`. Não preencher com zero nem falso para significar desconhecido.

- `indexacaoScopus`, `indexacaoWos`, `acordoCapes`: booleano ou null.
- `percentilCiteScore`, `percentilJif`, `percentilH`: número de 0 a 100 ou null.
- `estrato`: A1 a A8, somente com regra/fonte/ano confirmados. Não converter quartil ou outra edição do Qualis.
- `apcBRL`: número não negativo, acompanhado de moeda original, câmbio/data e eventuais taxas extras na evidência. Rota por assinatura não é APC zero.
- `prazoPublicacaoDias`: número não negativo, somente para submissão até publicação. Não usar primeira decisão nem prazo após aceite.
- `evidenciasMetricas`: objeto por nome do campo, com `url`, `fonte`, `anoIndicador`, `categoria`, `consultadoEm`, `observacao`. Acordos precisam também registrar instituição, editora, títulos elegíveis, vigência, autor correspondente e condições; não significam isenção automática.
- `maiorPercentil`: calculado em tempo de execução apenas sobre percentis válidos disponíveis; a ausência de um dos dois continua pendente.

O acervo existente não contém os novos percentis estruturados. Filtros estritos podem retornar zero até a conferência editorial. Isso não indica inexistência de revistas adequadas. O backend do assistente está fora deste repositório; a alteração fornece contexto e instruções pelo contrato existente, não muda seu servidor nem garante obediência do modelo. Não foram criadas credenciais ou integrações pagas.

## Prioridade 2 — aguarda validação de Michael

1. Semáforo dos critérios, com verde apenas com evidências completas, amarelo para pendência, vermelho para critério não atendido; preferir “Atende aos critérios informados” a certificação “Conta para PPGAD”.
2. Régua de percentil com 50/80; faixas de estrato somente após validar regra oficial.
3. Estimativa de custo em R$ com PTAX e data, taxas extras e condições de acordo/isenção.
4. Estimativa de publicação comparada com a defesa, explicitamente não garantida.
5. Atalho para aplicar todos os critérios; não ativar por padrão enquanto métricas faltam.

Nenhum desses cinco recursos foi implementado. Prioridade 3 também permanece fora deste incremento.

## Verificações

`node --test tests/criteria.test.mjs`

Prévia no navegador: carregamento das 68 revistas e 5 destaques, filtro estrito vazio, limpeza, busca textual, comparação com novos campos, download CSV e erro de JSON inválido com botões desabilitados. O envio real do formulário não foi acionado para não enviar mensagens de teste ao administrador.
