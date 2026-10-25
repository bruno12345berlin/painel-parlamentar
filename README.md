# Painel Parlamentar

Site estático com o perfil de cada deputado federal e senador desde 2019: gastos da cota, votações, participação e projetos. Independente, apartidário, sem anúncios nem coleta de dados dos visitantes.

Especificação: [PLANO.md](PLANO.md). Fontes: [docs/FONTES.md](docs/FONTES.md). Decisões: [CLAUDE.md](CLAUDE.md).

## Desenvolvimento

```bash
npm install
npm run dev        # servidor local
npm run build      # gera dist/
npm run typecheck && npm run lint && npm test
```

## Licenças

Código: MIT ([LICENSE](LICENSE)). Dados derivados: CC BY 4.0, com atribuição à Câmara dos Deputados e ao Senado Federal.
