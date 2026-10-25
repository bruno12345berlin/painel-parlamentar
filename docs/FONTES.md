# Fontes verificadas (Fase 0)

Verificado em 25/10/2026. Amostras em `data/samples/`. Status: ✅ verificado · ⚠️ verificado com ressalva · ❓ pendente.

## Câmara dos Deputados

| Fonte | Status | Notas |
|---|---|---|
| `/api/v2/deputados?idLegislatura=56\|57` | ✅ | Campos: id, nome, siglaPartido, siglaUf, idLegislatura, urlFoto, email |
| `/api/v2/deputados/{id}` | ✅ | `ultimoStatus` (situação, condicaoEleitoral, urlFoto), `redeSocial` (lista, muitas vezes vazia). **Retorna `cpf`: não usar nem gravar.** |
| `/api/v2/deputados/{id}/historico` | ✅ | Uma linha por mudança de status (posse, partido, licença etc.) com `dataHora`, `situacao`, `condicaoEleitoral`, `descricaoStatus`. Base do período de exercício. Falta validar a cobertura de licenças/afastamentos em casos reais (fazer na Fase 2). |
| `/api/v2/deputados/{id}/despesas` | ⚠️ | Responde 200 mas veio **vazio** (2024, id 204554, que não era mais deputado em 2024; não é prova definitiva). Usar o lote. |
| CEAP: `camara.leg.br/cotas/Ano-{ano}.csv.zip` | ✅ | UTF-8 com BOM, `;`. Colunas: txNomeParlamentar, cpf, ideCadastro, sgUF, sgPartido, numSubCota, txtDescricao, txtFornecedor, txtCNPJCPF, datEmissao, vlrDocumento, vlrGlosa, vlrLiquido, numMes, numAno, nuDeputadoId, urlDocumento. 2024: 232.918 linhas, ~82 MB descompactado. 19 categorias. 11.737 linhas com valor líquido negativo. **Linhas de liderança** (ex.: "LIDERANÇA DO PT", 903 em 2024) têm `sgUF = NA` e `ideCadastro` vazio (mas `nuDeputadoId` preenchido): excluir por `sgUF=NA`/`ideCadastro` vazio, não por id ausente. Fornecedor pessoa física: 1.843 linhas com 11 dígitos, em formato irregular (ex.: `346.769.613/91  -`): mascarar tudo que tiver ≤ 11 dígitos. A coluna `cpf` do deputado vem preenchida: não gravar. |
| Votações: `arquivos/votacoes/csv/votacoes-{ano}.csv` | ✅ | `siglaOrgao` identifica o órgão. 2024: 10.373 votações, **2.144 em PLEN**, 6.270 KB. |
| Votos: `arquivos/votacoesVotos/csv/votacoesVotos-{ano}.csv` | ✅ | Não tem órgão: cruzar por `idVotacao` com `votacoes`. Traz `deputado_siglaPartido` (partido no voto) e `deputado_idLegislatura`. Valores: Sim, Não, Obstrução, Abstenção, **"Artigo 17"** (quem presidiu). 2024: 116.400 votos. |
| Orientações: `arquivos/votacoesOrientacoes/csv/...` | ✅ | `siglaBancada` (partidos, federações "Fdr PT-PCdoB-PV", blocos "Bl MdbPsdRepPode", Governo, Maioria, Minoria, Oposição) e `orientacao` (Sim, Não, Obstrução, Liberado, vazio). 4.361 linhas em 2024. Nome de bloco vem **truncado** ("Bl UniPpFdrPsdbCid...") → o mapeamento manual partido→bancada por período é indispensável. |
| Proposições: `arquivos/proposicoes/csv/...` | ✅ | siglaTipo, numero, ano, ementa, dataApresentacao, `ultimoStatus_descricaoSituacao`. ~53 MB/ano. |
| Autores: `arquivos/proposicoesAutores/csv/...` | ✅ | `idDeputadoAutor`, `ordemAssinatura`, `proponente`. Inclui autores que não são deputados (órgãos, Senado): tratar. |
| Lista em lote: `arquivos/deputados/csv/deputados.csv` | ✅ | Só traz legislatura inicial/final e dados pessoais (sem partido/UF). **Contém CPF**: não usar. |

### Achado crítico: votação nominal é minoria no Plenário
Em 2024, das 2.144 votações do Plenário, só **273 têm votos individuais**. As demais são simbólicas. O denominador da participação deve contar só as votações com voto nominal registrado. Isso precisa constar na metodologia e muda o sentido de "votações que ocorreram".

## Senado Federal

| Fonte | Status | Notas |
|---|---|---|
| `/senador/lista/legislatura/{56\|57}` | ✅ | 245 na leg. 57. UF em `Mandatos.Mandato[].UfParlamentar`; mandatos trazem Titular e Suplentes. |
| `/senador/{codigo}` | ✅ | JSON com `Accept: application/json`; traz lista de serviços relacionados. |
| `/senador/{codigo}/autorias`, `/licencas`, `/mandatos` | ⚠️ | Respondem 200. Testado só com um senador (5918), sem licenças. Validar com senador que teve licença/suplente (Fase 2). |
| `/votacao?ano={ano}` | ✅ | Funciona para 2019 (195), 2022 (125), 2024 (90). `casaSessao = SF` em tudo (sessões de Plenário, `siglaTipoSessao` DOR/DEX). Totais vêm `null`. Cada item tem `votacaoSecreta` S/N e `votos[]`. |
| Votos do Senado | ✅ | Siglas: Sim, Não, Abstenção, **P-NRV** (presente, não registrou voto), **AP** (atividade parlamentar), **MIS** (missão), **LS** (licença saúde), **LP** (licença particular), **NCom** (não compareceu), **NA** (dispositivo não citado), **Presidente (art. 51 RISF)**, **Votou** (voto secreto: anônimo). |
| Votações secretas | ✅ | Em 2024: **52 de 90 secretas**, todas com "Votou" anônimo: excluir das métricas. Só 38 têm voto nominal aberto. |
| CEAPS: `.../verba/despesa_ceaps_{ano}.csv` | ✅ | Latin-1, `;`, CRLF, **primeira linha é metadado** ("ULTIMA ATUALIZACAO"), segunda é o cabeçalho. Colunas: ANO, MES, SENADOR, TIPO_DESPESA, CNPJ_CPF, FORNECEDOR, DOCUMENTO, DATA, DETALHAMENTO, VALOR_REEMBOLSADO (vírgula decimal), COD_DOCUMENTO. 2024: 21.431 linhas, 88 senadores, 8 tipos (111 linhas com tipo vazio), 58 valores negativos. Sem id do senador: casar por nome. |
| Orientação de bancada | ❌ descartado | Não é publicada (confirmado no plano). |

## Limites da cota (❓ pendente: decisão do Bruno)

Não há tabela legível por máquina nas duas casas; vai para `data/manual/`, preenchida a mão.

- **Câmara:** limites mensais por UF no Anexo Único do Ato da Mesa nº 43/2009, atualizados por atos posteriores. O mais recente achado: [Ato da Mesa nº 244, de 20/02/2026](https://www2.camara.leg.br/legin/int/atomes/2026/atodamesa-244-20-fevereiro-2026-798720-publicacaooriginal-178157-cd-mesa.html) (reajuste pelo IPCA de fev/2023 a dez/2025), mas a página não reproduz os valores. Precisamos dos anexos de cada ato vigente de 2019 a 2026. Regra de acúmulo do saldo não localizada.
- **Senado:** R$ 15.000 + cinco trechos aéreos Brasília–capital pela tabela IATA de tarifa governamental, reajustada por ato da Comissão Diretora (ex.: ato de 28/02/2025, +6,13%). Um veículo de imprensa cita saldo não usado acumulando para o mês seguinte, sem fonte oficial.
- **Impacto:** sem a tabela, o ranking de % da cota não é publicado (seção 6 do plano), só valores absolutos com aviso.

## Histórico de exercício
- Câmara: `/deputados/{id}/historico` (✅, ver acima).
- Senado: `/senador/{codigo}/licencas` e `/mandatos`, mais as siglas de voto (LS, LP, MIS). ⚠️ validar na Fase 2.

## Volumes (Câmara, por ano)
| Ano | CEAP zip | Votos CSV |
|---|---|---|
| 2019 | 9,1 MB | 40 MB |
| 2020 | 5,4 MB | 53 MB |
| 2021 | 6,9 MB | 107 MB |
| 2022 | 6,6 MB | 66 MB |
| 2023 | 7,5 MB | 43 MB |
| 2024 | 7,5 MB | 39 MB |
| 2025 | 6,9 MB | 58 MB |

Brutos 2019–2025 somam aproximadamente 1 GB entre CEAP, votos e proposições: cabe em cache/Release do Actions com folga se o snapshot for compactado. CEAPS do Senado: ~5 MB/ano.

## Cloudflare Pages (plano gratuito, [documentação](https://developers.cloudflare.com/pages/platform/limits/))
20.000 arquivos por site, 25 MiB por arquivo, 500 builds/mês e 20 min/build (estes dois só na integração Git). Confirmado.

**Estimativa de arquivos do deploy:** ~1.300 páginas de perfil + ~1.300 fotos + ~1.300 imagens OG + ~6.000–8.000 JSONs anuais (parlamentar × ano em exercício) + páginas de estado/ranking/dados ≈ **10–13 mil**. Dentro do limite, mas sem folga para dobrar: **não** particionar por mês, e evitar uma OG por ano.

## Estratégia de partição proposta
Como no plano: agregados por parlamentar e rankings no git; detalhe anual por parlamentar em `public/json/{slug}/{ano}.json` (gerado no build). Confirmar com o Bruno.
