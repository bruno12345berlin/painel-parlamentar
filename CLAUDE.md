# CLAUDE.md — Painel Parlamentar

Especificação completa em `PLANO.md`. Fontes verificadas em `docs/FONTES.md`. Trabalhar uma fase por vez, com pausa para aprovação.

## Estado atual (25/10/2026)
- **Fase 0:** construída e **aprovada** (25/10/2026).
- **Fase 1:** construída e **aprovada**, CI verde. Repositório público: https://github.com/bruno12345berlin/painel-parlamentar. Esqueleto Astro funcionando (typecheck, lint, 3 testes e build passam; conferido no navegador em celular e modo escuro).
- **Fase 2: pipeline completo construído, aguardando aprovação.** `npm run data:collect`, `data:build`, `data:photos` rodam do zero a 2026: 1.087 parlamentares (929 deputados, 158 senadores), 60 rankings, 34 testes. Medidas e achados em `docs/FONTES.md`. **Ainda não conferido contra o site oficial:** participação, alinhamento e projetos (só os totais de gasto foram conferidos, por soma independente). Tabela de limites da cota ainda pendente: rankings de % da cota não são gerados.
- Pendente/não verificado: tabelas de limite da cota por UF e ano (Câmara e Senado); regra de acúmulo do saldo mensal; licenças do Senado com um caso real; cobertura de afastamentos no `/historico` da Câmara.
- Repositório criado e primeiro push feito em 25/10/2026 (commits com e-mail noreply do GitHub).
- Links do cabeçalho para /deputados, /senadores, /rankings, /comparar e /dados dão 404 até as Fases 3 e 4. Em /sobre, "quem faz" é `[A DEFINIR]`.

## Log de decisões
| Data | Decisão | Rejeitado / motivo | Status |
|---|---|---|---|
| 25/10/2026 | Detalhe linha a linha fora do lançamento (`/dados` só agregados) | Hospedar tudo no Pages: estoura orçamento | acordado |
| 25/10/2026 | Excluir linhas de liderança do CEAP por `sgUF=NA`/`ideCadastro` vazio | Filtrar por id ausente: não funciona, o id vem preenchido | construído (regra, ainda sem código) |
| 25/10/2026 | Nunca gravar CPF de parlamentares (APIs da Câmara o expõem) | — | acordado |
| 25/10/2026 | Participação conta só votações com voto nominal; Senado exclui votações secretas ("Votou") | Contar todas as votações do Plenário: 2024 teria 2.144 no denominador contra 273 nominais | acordado (a confirmar na metodologia) |
| 25/10/2026 | Astro 5.18.2, Tailwind 4.3.3 (plugin Vite), zod 3.25.76, TypeScript 5.9, ESLint 9, Vitest 4; versões exatas no package.json | Astro 6/TS 7/ESLint 10 existem, mas Astro 5 exige zod 3 e o plano fixa Astro 5.x; TS 7 e ESLint 10 não testados com o ecossistema Astro | construído |
| 25/10/2026 | `build.format: "file"` (gera /sobre.html) e `trailingSlash: "never"` | URLs com pasta (/sobre/index.html): mais arquivos no deploy | construído |
| 25/10/2026 | Cabeçalho/rodapé/base sóbrios, paleta petróleo + neutros, modo escuro por `prefers-color-scheme`, tokens `--cat-1..7` já definidos | — | construído (layout definitivo de home e perfil: opções na Fase 3) |
| 25/10/2026 | Senado: denominador da participação desconta LS, LP, MIS e presidir; **AP (atividade parlamentar), P-NRV e NCom contam como ausência**; a página e a metodologia explicam o cálculo | Descontar AP como licença: o senador não está no Plenário na votação. (Bruno decidiu em 25/10/2026) | construído |
| 25/10/2026 | Contagem de "projetos" usa PL, PLP, PEC, PDL, PRC, PDS, PRS; requerimentos e demais tipos aparecem à parte | Contar tudo no número principal: Alan Rick teria 104 e Abilio 78, dominados por requerimentos. (Bruno confirmou) | construído |
| 25/10/2026 | Alinhamento da fatia usa só orientação com o mesmo nome do partido; federações/blocos exigem a tabela manual | — | construído (parcial) |
| 25/10/2026 | Autoria no Senado via `/processo` (o endpoint de autorias foi descontinuado) | Usar `/senador/{codigo}/autorias`: some em 01/02/2026 | construído |
| 25/10/2026 | `votacao` do Senado coletada por intervalo de datas, nunca por `?ano=` | `?ano=` filtra pela matéria: contaminou números | construído |
| 25/10/2026 | Fornecedor mostra nome, CPF mascarado e se é pessoa física ou jurídica (pelo nº de dígitos do documento) | Esconder o nome de pessoa física: o site mostraria menos que a fonte oficial. (Bruno decidiu) | construído |
| 25/10/2026 | Siglas de voto do Senado traduzidas para texto legível; a sigla original é guardada | Mostrar a sigla crua (P-NRV): incompreensível para o cidadão | construído |
| 25/10/2026 | Exercício dos deputados corrigido pela atividade registrada (votos nominais e meses com despesa), com o histórico da API como ponto de partida | Confiar só no `/historico`: 41 deputados com votos fora do exercício e participação absurda (1,3%) para quem entrou em 2026 | construído |
| 25/10/2026 | Universo de deputados = lista da API + todo id em votos/despesas desde 2019-02 | Só a lista da API: perdia 59 suplentes (R$ 6,8 mi de despesas) | construído |
| 25/10/2026 | Detalhe anual enxuto: despesas agrupadas por mês × categoria × fornecedor, projetos só de tipos legislativos com ementa, requerimentos só em contagens | Detalhe completo: 450 MB; versão enxuta 141 MB | construído |
| 25/10/2026 | Votação da Câmara guarda as proposições vinculadas só quando são até 3 | Guardar todas: 26 MB só nas tabelas de votações | construído |
| 25/10/2026 | `data:build` grava em `data/processed.novo` e só troca se tudo validar (nomes da CEAPS zerados) | Gravar direto: falha no meio apagaria os dados anteriores | construído |
| 25/10/2026 | Rankings exigem 3 meses de exercício no período; % da cota não é gerado (limites por UF/ano pendentes) | — | construído |
| 25/10/2026 | Parlamentar nas duas casas tem perfis separados (ex.: `alan-rick-ac` deputado, `alan-rick-ac-senado`) | Ligar automaticamente: backlog | construído |

## Convenções
- Stack, estrutura e regras de métrica: ver `PLANO.md` (seções 3, 5, 6).
- Samples em `data/samples/` sem dados pessoais (CPF removido).
- Só `data/processed/agregados/` vai para o git; `detalhe`, `raw`, fotos e `public/json` são gerados.
- Slugs nunca mudam: `data/manual/slugs.json`, chave `casa:idOrigem`.
- Regressão: `tests/regressao.test.ts` trava os números conferidos à mão de Abilio Brunini e Alan Rick (2024).
- Limitações a declarar na metodologia (Fase 3/5): presidente da Câmara/Senado tem participação baixa por não votar mesmo sem presidir a sessão; alinhamento só cobre votações em que a bancada do partido é identificável; Senado: participação conta AP, P-NRV e NCom como ausência.
