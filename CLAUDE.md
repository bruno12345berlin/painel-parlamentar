# CLAUDE.md — Painel Parlamentar

Especificação completa em `PLANO.md`. Fontes verificadas em `docs/FONTES.md`. Trabalhar uma fase por vez, com pausa para aprovação.

## Estado atual (25/10/2026)
- **Fase 0:** construída e **aprovada** (25/10/2026).
- **Fase 1:** construída, CI verde, **aguardando aprovação**. Repositório público: https://github.com/bruno12345berlin/painel-parlamentar. Esqueleto Astro funcionando (typecheck, lint, 3 testes e build passam; conferido no navegador em celular e modo escuro).
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

## Convenções
- Stack, estrutura e regras de métrica: ver `PLANO.md` (seções 3, 5, 6).
- Samples em `data/samples/` sem dados pessoais (CPF removido).
