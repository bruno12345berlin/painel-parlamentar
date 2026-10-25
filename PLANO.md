# Plano de projeto — Painel Parlamentar (nome provisório)

Este documento é a especificação completa do projeto. Ele foi escrito para ser executado pelo Claude Code, fase por fase. Leia o documento inteiro antes de começar e siga as "Instruções de trabalho" no final.

---

## 1. Visão geral

**O que é:** um site que mostra o perfil completo de cada deputado federal e senador desde 2019: quanto gastou da cota parlamentar, como votou, de quantas votações participou e quais projetos apresentou. Tudo em linguagem simples, para o cidadão comum.

**Objetivo:** portfólio e impacto cívico. Sem anúncios, sem contas de usuário, sem coleta de dados pessoais dos visitantes.

**Princípios (valem para todas as decisões):**

1. **Neutralidade.** O site mostra dados, não opiniões. Nenhum adjetivo valorativo ("gastão", "faltoso", "bom", "ruim"). Todos os parlamentares e partidos recebem o mesmo tratamento visual e textual.
2. **Transparência de método.** Todo número tem uma explicação acessível (página de metodologia) e um link para a fonte oficial.
3. **Simplicidade.** O visitante deve entender a página de um parlamentar em 30 segundos. Detalhes ficam em seções expansíveis ou páginas secundárias.
4. **Estático e barato.** Site 100% estático, gerado a partir de dados pré-processados. Custo de hospedagem zero.
5. **Dados verificados, nunca inventados.** Se um campo ou endpoint não existir ou não funcionar como descrito aqui, documente e adapte; nunca preencha com suposições.

---

## 2. Decisões tomadas

| Tema | Decisão |
|---|---|
| Foco | Perfil completo do parlamentar (gastos + votos + participação + projetos) |
| Casas | Câmara dos Deputados e Senado Federal, desde o lançamento |
| Histórico | Desde 2019: legislaturas 56 (2019–2023) e 57 (2023–2027) |
| Público | Cidadão comum: simples e visual |
| Funcionalidades além do perfil | Busca por estado ("meus representantes"), comparador lado a lado, rankings, download dos dados agregados (CSV/JSON); o detalhe linha a linha fica no backlog |
| Objetivo | Portfólio / impacto, sem monetização |
| Estilo visual | Sóbrio e institucional |
| Nome | Provisório ("Painel Parlamentar"), configurável em um único lugar |
| Código | Público no GitHub (open source, licença MIT) |
| Dados derivados | Licença CC BY 4.0, com atribuição às fontes oficiais (separada da MIT do código) |
| Idioma | Português do Brasil |

---

## 3. Stack e estrutura

**Stack:**

- **Astro** (geração estática) + **TypeScript** (modo strict)
- **Tailwind CSS**
- **Node.js** para o pipeline de dados (scripts em TypeScript, executados com `tsx`)
- **zod** para validar todos os dados externos
- **Vitest** para testes
- **Busca por nome:** índice JSON leve (todos os parlamentares, ~1.300 nomes, poucas dezenas de KB) carregado no cliente, com busca sem acentos. Pagefind só se um dia for preciso buscar em texto completo; se usado, restringir a indexação ao cabeçalho do perfil (`data-pagefind-body`), nunca à página inteira
- Gráficos renderizados como **SVG no build** (componentes Astro), sem biblioteca de gráficos no cliente. JavaScript no cliente só onde for indispensável (comparador, filtros de ranking), em ilhas pequenas.
- Fontes auto-hospedadas via `@fontsource` (sem Google Fonts, por privacidade)
- **Fotos dos parlamentares baixadas e redimensionadas no pipeline** e servidas pelo próprio site (sem hotlink para camara.leg.br / senado.leg.br: enquadramento uniforme, sem risco de bloqueio e sem expor o IP do visitante a outro servidor)
- Hospedagem: **Cloudflare Pages**, com deploy por upload direto (`wrangler pages deploy`) a partir do GitHub Actions, não pela integração Git (ver seção 9). Automação: **GitHub Actions**.
- **Versões fixadas** no `package.json` (Astro 5.x, Tailwind 4.x: a configuração da v4 é diferente da v3; registrar a escolha no `CLAUDE.md`). Agregados carregados no site via content collections do Astro; os JSONs anuais por parlamentar (carregados sob demanda pelo navegador) são copiados para `public/json/` no build.

**Local do projeto (Mac do Bruno):** `~/Documents/AI Workspace/Apps and Websites/Painel Parlamentar/`

**Estrutura de pastas sugerida:**

```
Painel Parlamentar/
├── PLANO.md                  # este documento
├── CLAUDE.md                 # decisões e convenções atualizadas durante o projeto
├── README.md
├── LICENSE                   # MIT
├── site.config.ts            # nome do site, URL, textos globais (nome provisório aqui)
├── pipeline/
│   ├── sources/              # um coletor por fonte (camara/, senado/)
│   ├── normalize/            # conversão para o modelo unificado
│   ├── metrics/              # cálculo de métricas e rankings
│   ├── schemas/              # schemas zod
│   ├── fotos.ts              # baixa e redimensiona fotos
│   ├── collect.ts            # CLI: baixa dados brutos
│   └── build-data.ts         # CLI: gera dados processados
├── data/
│   ├── raw/                  # downloads brutos (no .gitignore; snapshot arquivado fora do git, ver seção 9)
│   ├── samples/              # amostras pequenas para testes (versionadas)
│   ├── manual/               # tabelas mantidas à mão: limites de cota por UF e ano, exceções de nomes, slugs fixos, mapeamento partido→federação (versionadas)
│   ├── fotos/                # fotos originais baixadas (no .gitignore)
│   └── processed/
│       ├── agregados/        # resumos por parlamentar, rankings, índice de busca (versionados, pequenos)
│       └── detalhe/          # JSON anual por parlamentar com votos, despesas e projetos (no .gitignore; gerado no build)
├── docs/
│   ├── FONTES.md             # resultado da Fase 0: fontes verificadas
│   └── VERIFICACAO.md        # conferência manual por amostragem
├── src/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   └── lib/
├── public/
│   ├── dados/                # arquivos para download (gerados no build)
│   ├── json/                 # JSONs anuais por parlamentar para o navegador (copiados de data/processed/detalhe no build)
│   └── fotos/                # fotos redimensionadas (geradas por data:photos)
├── tests/
└── .github/workflows/
```

---

## 4. Fontes de dados

**Atenção:** a tabela abaixo é o ponto de partida, não a verdade final. Formatos e endpoints dessas APIs mudam sem aviso (por exemplo, o endpoint legado de votações do Senado foi desativado em 01/02/2026). A Fase 0 existe para verificar cada linha.

### Câmara dos Deputados

Documentação: https://dadosabertos.camara.leg.br/swagger/api.html
API base: `https://dadosabertos.camara.leg.br/api/v2`

| Dado | Fonte provável | Observações |
|---|---|---|
| Lista de deputados (leg. 56 e 57) | `/deputados?idLegislatura=56` e `=57`, ou arquivo em lote `deputados` | Inclui suplentes que exerceram mandato |
| Perfil (foto, partido, UF, contato, redes) | `/deputados/{id}` | Campo `redeSocial` muitas vezes vazio |
| Histórico de exercício (posse, licença, afastamento, suplente) | `/deputados/{id}/historico` (a verificar) | Necessário para o denominador de participação e para a cota proporcional. Se não servir, procurar alternativa no arquivo em lote de deputados |
| Despesas da cota (CEAP) | Arquivo anual em lote: `https://www.camara.leg.br/cotas/Ano-{ano}.csv.zip` | Preferir o lote: projetos anteriores relataram que `/deputados/{id}/despesas` voltou vazio. Cuidados: usar o **valor líquido** (documento menos glosa); há **valores negativos** (bilhetes de compensação, devoluções) que entram na soma; há **linhas de lideranças partidárias** sem id de deputado, que devem ser excluídas dos perfis |
| Votações nominais | Arquivos em lote por ano em `https://dadosabertos.camara.leg.br/arquivos/` (votacoes, votacoesVotos, votacoesOrientacoes) | O endpoint de votos da API tem limite de taxa; preferir lote. Os arquivos incluem votações em **comissões** (campo do órgão): guardar o órgão para filtrar só Plenário. O arquivo de votos traz o **partido do deputado na data do voto**: usar esse, não o partido atual. Orientações vêm por partido, federação, bloco, "Maioria", "Minoria", "Governo", "Oposição" e "Liberado" |
| Proposições e autores | Arquivos em lote por ano (proposicoes, proposicoesAutores) | Separar autor principal de coautor |
| Limite mensal da cota por UF | A localizar (ato da Mesa / página de transparência) | Varia por UF **e por ano** (reajustes). Se não houver versão legível por máquina, criar tabela manual UF × ano em `data/manual/` com link da fonte. Verificar também se o saldo mensal não usado acumula dentro do ano (isso define se o % é calculado por ano, não por mês) |
| Fotos | URL em `/deputados/{id}` (`ultimoStatus.urlFoto`) | Baixar no pipeline, não hotlinkar |

### Senado Federal

Documentação: https://legis.senado.leg.br/dadosabertos/docs/
API base: `https://legis.senado.leg.br/dadosabertos`
Portal: https://www12.senado.leg.br/dados-abertos

| Dado | Fonte provável | Observações |
|---|---|---|
| Lista de senadores | `/senador/lista/legislatura/{leg}` (56 e 57) | A UF vem de `Mandatos.Mandato.UfParlamentar`; o campo em `IdentificacaoParlamentar` costuma vir vazio |
| Perfil | `/senador/{codigo}` | Pedir JSON via header `Accept: application/json` |
| Autorias | `/senador/{codigo}/autorias` | Idem |
| Licenças e afastamentos | Endpoint a localizar (há recursos por senador, ex.: licenças, mandatos com suplentes) | Necessário para o denominador de participação. As siglas de voto (MIS, LS, LAP, LP) já informam parte disso |
| Votações nominais | `/votacao` (endpoint atual) | Resposta é um array na raiz com `votos[]` embutidos. Totais (`totalVotosSim` etc.) vêm `null`: calcular por conta própria. `siglaVotoParlamentar` mistura Sim/Não/Abstenção com siglas (AP, P-NRV, MIS, LS, LAP, LP, Presidente…): criar tabela de tradução documentada. Verificar se inclui votações em comissões (filtrar só Plenário) e votações secretas (sem votos nominais, excluir). **O Senado não publica orientação de bancada**: a métrica de alinhamento não existe para senadores (ver seção 6) |
| Despesas da cota (CEAPS) | CSV anual: `https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_{ano}.csv` | Latin-1, separador `;`, vírgula decimal, **primeira linha é metadado** (pular). Só traz o nome do senador: casar com o código por nome normalizado (sem acentos, minúsculas) + tabela manual de exceções |
| Limite da cota por UF | A localizar | A CEAPS soma R$ 15.000 a cinco trechos aéreos Brasília–capital do estado, então varia por UF e, com reajustes, por ano. Tabela manual UF × ano em `data/manual/` |
| Fotos | URL em `/senador/{codigo}` | Baixar no pipeline, não hotlinkar |
| API administrativa (gabinete, remunerações) | `https://adm.senado.gov.br/adm-dadosabertos/api/v1/` | Fora do escopo do lançamento (backlog) |
| Vetos | Conjuntos listados em `https://www12.senado.leg.br/dados-abertos/legislativo/projetos-e-materias/vetos` | Fora do escopo do lançamento (backlog) |

---

## 5. Modelo de dados unificado

As duas casas usam formatos e identificadores diferentes. O pipeline converte tudo para um modelo único. Esboço (ajustar após a Fase 0):

```ts
type Casa = "camara" | "senado";

interface Parlamentar {
  slug: string;              // ex.: "joao-silva-sp" (único, estável, ver regra abaixo)
  casa: Casa;
  idOrigem: string;          // id da Câmara ou código do Senado
  nome: string;              // nome parlamentar
  nomeCivil?: string;
  partidoAtual: string;
  uf: string;
  fotoUrl?: string;          // URL oficial (auditoria); o site usa a cópia local
  fotoLocal?: string;        // caminho da foto redimensionada no site
  emExercicio: boolean;
  legislaturas: number[];    // [56], [57] ou [56, 57]
  mandatos: { inicio: string; fim?: string; titular: boolean }[];
  exercicio: { inicio: string; fim?: string; motivoFim?: string }[]; // períodos efetivos em exercício (descontando licenças/afastamentos); base da participação e da cota proporcional. Se a fonte não informar afastamentos, igual a mandatos, e a metodologia declara a limitação
  contato?: { email?: string; telefone?: string; redes?: string[] };
  fonteUrl: string;          // página oficial
}

interface Despesa {
  parlamentarSlug: string;
  data: string;              // ISO
  ano: number; mes: number;
  categoria: string;         // categoria normalizada (ver metodologia)
  categoriaOriginal: string;
  fornecedor: string;
  documentoFornecedor: string; // CNPJ completo; CPF MASCARADO
  valorDocumento: number;    // em reais, ponto decimal
  valorGlosa: number;        // Câmara; no Senado (CEAPS só traz o valor reembolsado) é 0
  valorLiquido: number;      // o que entra nas somas; pode ser negativo (devoluções, bilhetes de compensação)
}

interface Votacao {
  id: string; casa: Casa; data: string;
  orgao: string;             // "PLEN" ou sigla da comissão; só Plenário entra nas métricas
  descricaoOficial: string;  // texto da fonte, sem reescrita
  ementaProposicao?: string; // ementa oficial da proposição votada, quando houver
  tipoObjeto: string;        // ex.: "proposicao", "requerimento", "destaque", "emenda" (derivado dos dados)
  procedimental: boolean;    // true para requerimentos, destaques e similares; derivado de tipoObjeto, regra documentada
  proposicao?: { sigla: string; numero: number; ano: number };
  resultado?: string;
  orientacoes?: Record<string, string>; // bancada (partido, federação, bloco, Governo...) -> orientação; só Câmara
}

interface Voto {
  votacaoId: string; parlamentarSlug: string;
  voto: "sim" | "nao" | "abstencao" | "obstrucao" | "ausente" | "presidiu" | "outro";
  votoOriginal: string;      // sigla original, para auditoria
  partidoNoVoto: string;     // partido do parlamentar na data da votação (não o atual)
}

interface Proposicao {
  id: string; casa: Casa;
  sigla: string; numero: number; ano: number;
  ementa: string; dataApresentacao: string;
  autores: { parlamentarSlug?: string; nome: string; principal: boolean }[];
  situacao?: string; url: string;
}
```

**Regras:**

- **Slug:** derivado do nome parlamentar + UF. Em caso de colisão, adicionar a casa. Uma vez publicado, um slug não muda: manter `data/manual/slugs.json` chaveado por `casa + idOrigem` (nunca por nome, que muda entre legislaturas).
- **Datas:** sempre a data civil de Brasília (`AAAA-MM-DD`), sem conversão de fuso horário.
- **Fotos:** baixadas uma vez por parlamentar, redimensionadas para um tamanho único (ex.: 320 px, formato WebP) e servidas pelo site. Guardar a URL oficial para auditoria.
- **Parlamentar nas duas casas** (ex.: deputado em 2019, senador em 2023): perfis separados por casa no lançamento, com link cruzado se for possível casar com segurança (nome civil + data de nascimento). Se não for seguro, não ligar.
- **CPF de fornecedor pessoa física:** sempre mascarado (ex.: `***.456.789-**`), inclusive nos arquivos de download. CNPJ pode aparecer completo.
- **Saída do pipeline:** em `agregados/`, um JSON resumido por parlamentar (para o perfil e o comparador), um JSON por ranking (por casa e legislatura/ano), um índice geral leve (nomes para a busca) e os arquivos de download; em `detalhe/`, um JSON por parlamentar e ano com votos, despesas e projetos. **Tudo particionado por ano**: assim, nas atualizações diárias, só mudam os arquivos do ano corrente (e do anterior, enquanto ele ainda recebe correções).

---

## 6. Métricas e metodologia

Cada métrica abaixo precisa ter uma seção correspondente na página `/metodologia`, em linguagem simples.

**Gastos da cota**
- Total gasto por ano e por legislatura; por categoria; por mês. "Gasto" é sempre o **valor líquido** (documento menos glosa), incluindo valores negativos (devoluções).
- **% da cota disponível utilizada.** É a métrica principal de ranking, porque o limite da cota varia por UF (passagens aéreas). Ranking por valor absoluto existe, mas sempre com aviso de que não é comparável entre estados.
- A cota disponível é calculada com o limite **da UF e do ano** (tabela `data/manual/`), **proporcional aos meses em exercício** no período (suplente que assumiu em junho tem cota de 7 meses, não 12). Se o saldo mensal não usado acumular dentro do ano (verificar na Fase 0), o % é calculado por ano, nunca por mês.
- Se não houver tabela confiável de limites por UF e ano para alguma casa ou período, o ranking em % não é publicado para esse caso, e a página explica o motivo.
- **Exercício mínimo para entrar em rankings:** 3 meses no período considerado. Quem ficou menos aparece no perfil normalmente, mas fora do ranking, com a regra declarada na metodologia. Evita que quem serviu semanas distorça as pontas.
- Categorias das duas casas são mapeadas para um conjunto pequeno e comum (ex.: passagens, combustível, escritório, divulgação, alimentação/hospedagem, consultorias, outros), com o mapeamento documentado.

**Participação em votações**
- Definição única para as duas casas: **votações nominais do Plenário em que o parlamentar registrou voto ÷ votações nominais do Plenário ocorridas enquanto ele estava em exercício.**
- **Só Plenário.** Votações em comissões ficam fora, porque um parlamentar só vota nas comissões de que é membro.
- **Obstrução conta como participação** (é voto registrado). "Presidiu" (quem presidia a sessão: "Art. 17" na Câmara, "Presidente" no Senado) **não conta nem no numerador nem no denominador**; sem isso, os presidentes das casas apareceriam com participação próxima de zero.
- O denominador usa os períodos de `exercicio` (seção 5): licenças, afastamentos (ex.: para ministério) e períodos de suplência são descontados. Nunca chamar de "faltas". Quando a fonte não informar o afastamento, explicar a limitação na metodologia.
- Mostrar o número absoluto junto do percentual (ex.: "votou em 412 de 450 votações").

**Alinhamento com o partido** (só Câmara: o Senado não publica orientação de bancada)
- % das votações do Plenário em que o voto coincidiu com a orientação da bancada do parlamentar **na data da votação** (`partidoNoVoto`, não o partido atual: a janela partidária de 2022 trocou muitos de partido).
- Orientações vêm por partido, federação ou bloco: manter em `data/manual/` o mapeamento partido → federação/bloco por período. Orientação "Liberado", votações sem orientação para a bancada e votações em que o parlamentar não votou **saem do denominador**.
- No perfil de senadores, o cartão de alinhamento mostra "não disponível" com link para a explicação na metodologia. Não substituir por outra métrica, para que os quatro cartões sejam comparáveis entre casas. Esse é o padrão; o Bruno confirma ao ver as opções de layout na Fase 3.
- Apresentado como dado, sem juízo de valor.

**Votações no perfil**
- Mostrar a **descrição oficial** e a **ementa oficial** da proposição, sem reescrever (reescrever seria editorial e viola o princípio 5). O campo `procedimental` (derivado do tipo do objeto: requerimento, destaque, emenda) permite filtrar as votações de mérito, com a regra de classificação publicada na metodologia.

**Períodos de comparação**
- Rankings e comparações usam **legislatura** ou **ano**, nunca "mandato": mandatos de senador duram 8 anos e começam em 2015, 2019 ou 2023, enquanto os dados começam em 2019.

**Projetos apresentados**
- Contagem por tipo (PL, PEC, PLP, PDL etc.), separando **autor principal** de **coautor**.
- Ranking por quantidade sempre acompanhado do aviso: quantidade não mede qualidade nem relevância.
- Lista dos projetos com ementa e link oficial.

**Atualização**
- Toda página exibe "Dados atualizados em DD/MM/AAAA" e a data de referência de cada fonte.
- Se a última atualização bem-sucedida tiver mais de 7 dias, todas as páginas mostram um aviso visível ("os dados podem estar desatualizados"). Sem isso, uma falha prolongada do pipeline passaria despercebida pelo visitante.

---

## 7. Páginas e funcionalidades

| Rota | Conteúdo |
|---|---|
| `/` | Busca por nome (índice JSON, sem acentos), seletor de estado, atalhos para rankings e comparador, explicação curta do site |
| `/estado/[uf]` | "Seus representantes": deputados e senadores do estado, em exercício e anteriores (desde 2019). 27 páginas |
| `/parlamentar/[slug]` | **Página principal.** Cabeçalho (foto, nome, partido, UF, casa, mandatos) → resumo em 4 cartões (gasto da cota, participação, alinhamento, projetos; no Senado o cartão de alinhamento mostra "não disponível") → seções: Gastos (gráfico mensal, por categoria, maiores fornecedores), Votações (as mais recentes do Plenário com voto e orientação da bancada, filtro por ano e "só mérito"), Projetos (lista), Contato e fontes. Botão "comparar com…". **O HTML traz só as listas recentes** (ex.: 50 votações, 50 projetos); o restante vem do JSON anual do parlamentar, carregado sob demanda. Parlamentares prolíficos têm milhares de votos e centenas de projetos, e a página precisa continuar leve |
| `/deputados` e `/senadores` | Listagens filtráveis por UF, partido, legislatura e "em exercício" |
| `/rankings` e `/rankings/[metrica]` | Rankings de gasto (% da cota e absoluto), participação, projetos. Filtros: casa, **legislatura ou ano** (nunca "mandato"), UF, partido. Cada ranking com aviso metodológico no topo e com a regra de exercício mínimo |
| `/comparar` | Escolher 2 (até 4) parlamentares e ver as métricas lado a lado, no mesmo período (legislatura ou ano). Estado na URL (`?p=slug1,slug2`) para compartilhar |
| `/dados` | Downloads em CSV e JSON **dos agregados**: resumo por parlamentar (métricas por ano), rankings, votações do Plenário (uma linha por votação, com resultado) e proposições com autores. São arquivos pequenos, que cabem no Pages. O detalhe linha a linha (cada despesa, cada voto individual) **não é redistribuído**: a página explica e linka os arquivos oficiais de onde vieram. Dicionário de campos, licença (CC BY 4.0) e atribuição das fontes. Decisão tomada (25/10/2026): o detalhe completo fica no backlog. |
| `/metodologia` | Explicação de cada métrica, tratamento de casos especiais, tabelas de mapeamento |
| `/sobre` | O que é o projeto, quem faz, que é independente e apartidário, link do GitHub, como reportar erro (GitHub Issues) |

**Detalhes de comportamento:**
- O comparador e os filtros de ranking carregam os JSONs resumidos no cliente (um por casa e período, para não baixar tudo de uma vez). Todo o resto é HTML estático.
- Rankings também têm versão estática padrão (casa + legislatura atual) para funcionar sem JavaScript e para SEO.
- **Orçamento de arquivos:** o deploy inteiro (páginas, JSONs, fotos, imagens Open Graph) precisa ficar bem abaixo do limite de arquivos do Cloudflare Pages (seção 9). Por isso não há uma página HTML por parlamentar × ano: o filtro por ano usa os JSONs anuais.
- Toda página de parlamentar tem link "Encontrou um erro?" que abre uma issue pré-preenchida no GitHub.

---

## 8. Design

**Direção: sóbrio e institucional.** Referência de tom: site de órgão de controle bem feito, não site de campanha.

- **Paleta:** neutros (grafite, cinzas, branco) + **uma** cor de destaque fria (ex.: azul-petróleo) para a interface. Para os gráficos, uma **paleta categórica neutra** de até 7 tons (necessária para o comparador, com até 4 séries, e para o gráfico por categoria de gasto), definida em variáveis CSS para funcionar no modo escuro também dentro dos SVGs. **Não usar** cores de partidos, nem vermelho/verde para indicar "bom/ruim". Cor de alerta só para avisos metodológicos.
- **Tipografia:** uma sans-serif de boa legibilidade em números (ex.: Inter ou Source Sans 3, com algarismos tabulares nas tabelas).
- **Gráficos:** simples (barras e linhas), rótulos diretos, sem 3D, sem pizza com muitas fatias. Sempre com o número escrito, não só a forma.
- **Fotos:** mesmo tamanho e enquadramento para todos (garantido pelo redimensionamento no pipeline).
- **Processo:** antes de construir a página de parlamentar e a home, apresentar 3 ou 4 opções de layout lado a lado, com dados reais de um deputado e de um senador (inclusive casos extremos: nome longo, sem foto, sem alinhamento, zero projetos), com recomendação. Construir só depois da escolha. Registrar no `CLAUDE.md` a opção escolhida e as rejeitadas.
- **Mobile first.** A maioria dos visitantes virá do celular.
- **Acessibilidade:** WCAG 2.1 AA (contraste, navegação por teclado, textos alternativos, tabelas com cabeçalhos corretos, gráficos com alternativa em tabela).
- **Modo escuro:** suportar via `prefers-color-scheme`.

---

## 9. Pipeline e automação

**Comandos:**
- `npm run data:collect` baixa os dados brutos para `data/raw/`. **O ano atual e o ano anterior são sempre baixados** (despesas do ano anterior continuam mudando por meses: notas entregues com atraso, glosas; arquivos de votações recebem correções). Anos mais antigos são baixados se não existirem localmente, uma vez por mês (`--refresh-closed`, que o workflow passa no primeiro dia de cada mês) ou com `--force`.
- `npm run data:build` valida (zod), normaliza, calcula métricas e grava `data/processed/agregados/` e `data/processed/detalhe/`, particionados por ano. Leitura dos CSVs em **streaming** (são milhões de linhas; não carregar tudo na memória).
- `npm run data:photos` baixa e redimensiona as fotos que ainda não existem.
- `npm run build` gera o site (copia `detalhe/` para `public/json/` e gera os arquivos de `/public/dados/`).

**Robustez:**
- Validar cada fonte: colunas esperadas presentes, número mínimo de linhas, tipos corretos. Se a validação falhar, o pipeline **para com erro claro** e não sobrescreve os dados processados anteriores.
- Requisições com timeout, retentativas com espera exponencial e limite de concorrência baixo (ser educado com as APIs públicas). User-Agent identificando o projeto e o link do GitHub.
- Gravar hash dos dados processados. Se nada mudou, não gerar commit nem deploy.
- **Snapshot dos dados brutos fora do git:** as fontes podem remover arquivos antigos, e o cache do Actions é apagado após dias sem uso e tem teto de tamanho. Guardar uma cópia dos brutos de cada ano fechado em um GitHub Release (ou R2) e usar essa cópia como fallback no `data:collect`.

**O que vai para o git:** só `data/processed/agregados/` (resumos por parlamentar, rankings, índice). `data/processed/detalhe/`, `data/raw/` e as fotos ficam no `.gitignore`: são regenerados em cada execução do workflow a partir dos brutos (cache ou snapshot). Commits diários de JSONs grandes inchariam o repositório para sempre.

**GitHub Actions:**
- Workflow `atualizar-dados.yml`: cron diário (madrugada, horário de Brasília) + disparo manual. Executa `data:collect`, `data:build`, `data:photos`, `build` e o deploy. Se houver mudança nos agregados, faz commit em `data/processed/agregados/`. Usar cache do Actions para `data/raw/` e para as fotos, com o snapshot do Release como fallback.
- **Deploy por upload direto** (`wrangler pages deploy dist/`) com `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` em segredos do repositório, em vez da integração Git. Motivo: controle do tempo de build (o plano gratuito do Pages tem limite de minutos por build e de builds por mês) e nenhuma dependência do build do Cloudflare.
- Workflow de CI em pull requests: lint, typecheck, testes, build.
- Falha do workflow diário gera notificação por e-mail do GitHub; o site mostra o aviso de dados desatualizados (seção 6).

**Limites a respeitar (Cloudflare Pages, plano gratuito; confirmar os valores atuais na Fase 0):**

| Limite | Valor conhecido |
|---|---|
| Arquivos por deploy | 20.000 |
| Tamanho por arquivo | 25 MiB |
| Builds por mês (só com a integração Git) | 500 |
| Tempo por build (só com a integração Git) | 20 min |

Na Fase 0, **medir** o tamanho real dos dados processados e estimar a contagem de arquivos do deploy (páginas + JSONs anuais + fotos + imagens Open Graph) antes de fechar a estratégia de partição.

---

## 10. SEO

Mesmo sem monetização, o site precisa ser encontrado.

- Título das páginas de perfil no formato: "Nome (PARTIDO-UF): gastos, votações e projetos | Nome do site".
- Meta description gerada a partir dos dados (ex.: "Veja quanto Fulano gastou da cota parlamentar, em quantas votações participou e quais projetos apresentou.").
- Páginas de estado com títulos como "Deputados federais e senadores de São Paulo".
- Dados estruturados JSON-LD (`Person` com cargo e afiliação; `Dataset` na página de dados).
- `sitemap.xml`, `robots.txt`, URLs canônicas, imagens Open Graph geradas no build para cada parlamentar (foto + nome + 3 números).
- Lighthouse acima de 90 em performance, acessibilidade e SEO.
- Analytics: nenhum por padrão. Se for adicionado, só Cloudflare Web Analytics (sem cookies).

---

## 11. Qualidade e testes

- Testes unitários dos parsers com as amostras em `data/samples/` (incluindo o CSV da CEAPS com primeira linha de metadado, latin-1 e vírgula decimal).
- Testes das métricas com casos construídos à mão (parlamentar que assumiu no meio da legislatura, suplente, licença, troca de partido, quem presidiu a sessão, orientação "Liberado", votação em comissão excluída, despesa com valor negativo e com glosa, linha de liderança partidária ignorada, cota proporcional por meses em exercício).
- Teste de regressão (snapshot) das métricas de um ano de amostra: qualquer mudança de número precisa ser intencional e explicada no commit.
- Teste de casamento de nomes da CEAPS: relatório de nomes não casados gerado a cada build; build falha se houver nome não casado sem entrada na tabela de exceções.
- Verificação manual por amostragem: para 5 parlamentares de cada casa, conferir 3 números contra o site oficial e registrar em `docs/VERIFICACAO.md`.

---

## 12. Fases de execução

Cada fase termina com: testes passando, build funcionando, resumo do que foi feito e **pausa para aprovação** antes da próxima.

### Fase 0 — Reconhecimento das fontes
- Script que consulta cada fonte da seção 4, salva amostras pequenas em `data/samples/` e lista os campos reais.
- Escrever `docs/FONTES.md`: para cada fonte, URL verificada, formato, campos usados, problemas encontrados, alternativa se não funcionou.
- Localizar as tabelas de limite de cota por UF **e por ano** (Câmara e Senado) e verificar a regra de acúmulo do saldo mensal.
- Localizar as fontes de histórico de exercício (licenças, afastamentos, suplências) nas duas casas.
- Confirmar se os arquivos de votação incluem comissões e votações secretas, e como aparece quem presidiu a sessão.
- **Medir volumes:** linhas e tamanho por ano de despesas, votos e proposições; estimar a contagem de arquivos do deploy; confirmar os limites atuais do Cloudflare Pages.
- **Critério de aceite:** toda linha da seção 4 marcada como verificada, substituída ou descartada com justificativa; volumes medidos; estratégia de partição confirmada com o Bruno. Ajustar este plano se necessário.

### Fase 1 — Esqueleto do projeto
- Astro + TypeScript strict + Tailwind + Vitest + ESLint/Prettier.
- `site.config.ts` com o nome provisório. Layout base, cabeçalho, rodapé (fontes, atualização, links), páginas `/sobre` e `/metodologia` com conteúdo inicial.
- README, LICENSE (MIT), `.gitignore`, `CLAUDE.md` (já no formato de log de decisões, ver seção 14).
- **Criar o repositório no GitHub e o workflow de CI já nesta fase** (com permissão do Bruno, conforme seção 14): backup e testes desde o primeiro commit, em vez de só na Fase 6.
- **Critério de aceite:** `npm run dev` e `npm run build` funcionando; CI verde no repositório.

### Fase 2 — Pipeline de dados
- **Começar por uma fatia vertical:** pipeline e um perfil mínimo (sem polimento, descartável; o layout definitivo é escolhido na Fase 3) para **um deputado e um senador**, com dados reais de um ano. Serve para validar o modelo, o tamanho de página e as suposições de design antes de investir no pipeline completo. Pausa para o Bruno olhar.
- Depois: coletores completos, schemas zod, normalização para o modelo unificado, períodos de exercício, cálculo das métricas, fotos, geração de `data/processed/agregados/` e `data/processed/detalhe/` particionados por ano.
- **Critério de aceite:** pipeline completo rodando localmente para 2019–hoje; testes passando; relatório de nomes não casados zerado ou resolvido; tamanho dos processados dentro do orçamento medido na Fase 0; tempo total de execução registrado no `CLAUDE.md` (precisa caber com folga no limite de um job do Actions).

### Fase 3 — Perfis e estados
- Primeiro, as opções de layout lado a lado (seção 8, "Processo") e a escolha do Bruno.
- `/parlamentar/[slug]`, `/estado/[uf]`, `/deputados`, `/senadores`, busca por nome com índice JSON.
- Componentes de gráfico em SVG com a paleta categórica.
- **Critério de aceite:** todas as páginas geradas; verificação manual por amostragem feita; contagem de arquivos do build dentro do orçamento; página de parlamentar mais pesada abaixo de um tamanho combinado (ex.: 300 KB de HTML).

### Fase 4 — Rankings, comparador e downloads
- `/rankings` (por legislatura e ano, com exercício mínimo), `/comparar`, `/dados` com os agregados e o dicionário de campos.
- **Critério de aceite:** comparador funciona com URL compartilhável; downloads abrem corretamente no Excel/LibreOffice (UTF-8 com BOM no CSV); nenhum arquivo acima do limite por arquivo do Pages.

### Fase 5 — Polimento
- SEO completo (seção 10), imagens Open Graph, acessibilidade, modo escuro, desempenho.
- **Critério de aceite:** Lighthouse > 90 nas páginas principais; auditoria de acessibilidade sem erros graves.

### Fase 6 — Automação e publicação
- Workflow diário de dados com deploy por upload direto; snapshot dos brutos em Release; aviso de dados desatualizados. Instruções passo a passo para o Bruno criar o projeto no Cloudflare Pages, gerar o token de deploy e cadastrar os dois segredos no repositório.
- **Critério de aceite:** uma execução agendada atualiza dados e publica o site sem intervenção; uma falha simulada do pipeline não sobrescreve os dados anteriores e gera notificação.

### Backlog (depois do lançamento)
- Votações de vetos no perfil (sessões do Congresso).
- Dados de gabinete do Senado (API administrativa) e da Câmara.
- Ligação automática de quem passou pelas duas casas.
- Legislaturas anteriores a 2019.
- Download do detalhe completo (cada despesa, cada voto), hospedado fora do Pages, se houver demanda.
- Páginas por partido (`/partido/[sigla]`).
- Alertas por e-mail (exigiria backend; reavaliar stack).

---

## 13. Riscos e cuidados

- **Mudança nas fontes:** mitigado por validação estrita e alerta de falha (e-mail automático do GitHub Actions).
- **Pipeline parado por muito tempo sem ninguém notar:** mitigado pelo aviso de dados desatualizados visível no site.
- **Fonte remove arquivos antigos:** mitigado pelo snapshot dos dados brutos fora do git.
- **Números injustos por detalhe de cálculo** (presidente da casa com participação zero, suplente com cota cheia, votação de comissão no denominador): mitigado pelas regras da seção 6 e pelos testes de métrica com casos construídos à mão.
- **Interpretação injusta dos números:** mitigado por métricas normalizadas, avisos nos rankings, linguagem neutra e página de metodologia.
- **Erros nos dados:** link "Encontrou um erro?" em toda página, verificação por amostragem, histórico de correções no repositório.
- **Dados pessoais de terceiros:** CPF de fornecedores mascarado. Não publicar dados de servidores de gabinete no lançamento.
- **Período eleitoral (2026):** o site é informativo e neutro, mas manter atenção redobrada à neutralidade de textos e destaques; não destacar candidatos.

---

## 14. Instruções de trabalho para o Claude Code

1. Leia este plano inteiro e o `CLAUDE.md` (se existir) antes de qualquer ação.
2. Execute **uma fase por vez**. Ao final de cada fase: rode testes e build, resuma o que foi feito, liste dúvidas e decisões tomadas, e **espere aprovação** antes de seguir.
3. **Verifique antes de confiar:** nenhum endpoint, campo ou formato deste plano é garantido. Se algo diferir, documente em `docs/FONTES.md` e adapte.
4. Nunca invente dados, campos ou valores. Na dúvida, pergunte.
5. Registre decisões e convenções no `CLAUDE.md` à medida que forem tomadas, como **log de decisões**: o que foi escolhido, o que foi rejeitado e por quê, a data, e o status (**acordado** ou **construído**). Rejeições registradas evitam que a mesma opção volte à mesa.
6. **Peça permissão antes de:** criar o repositório no GitHub, fazer push, configurar o Cloudflare, adicionar dependências pesadas ou serviços pagos.
7. Commits pequenos e descritivos, em português.
8. O ambiente do Bruno é um Mac: rode `npm install` no Mac antes do primeiro `npm run dev` se dependências tiverem sido instaladas em outro sistema.
9. Ao terminar uma sessão, deixe o estado claro no `CLAUDE.md`: o que está decidido, construído, pendente e não verificado. Nunca reporte algo como "pronto" sem ter olhado o resultado no navegador.
