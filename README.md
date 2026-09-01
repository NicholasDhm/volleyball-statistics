# Estatísticas de Vôlei

Software local para o time lançar estatísticas de cada partida — a planilha do time, mas viva:
lançamento por jogador, KPIs, gráficos, comparação entre atletas e drilldown individual.

## Rodar

```bash
npm install
npm run dev
```

Abre em http://localhost:5173.

## Como funciona

- **Os dados vivem no `localStorage`** do navegador (chave `volei-stats-v1`) e são salvos a
  cada tecla — nada se perde.
- **Para compartilhar com o time**, o app publica a temporada num JSON versionado no próprio
  repositório, pelo botão **Salvar dados**. Veja [DEPLOY.md](DEPLOY.md).
- Também dá para exportar/importar JSON em **Relatório**, sem servidor nenhum.
- **A temporada começa em branco.** Na Visão Geral vazia há um atalho "Ver com dados de exemplo"
  (11 jogadores e 12 partidas fictícias) para conhecer o app; em **Relatório → Zona de dados**
  você recarrega ou apaga tudo.

## Telas

| Rota | O quê |
|---|---|
| `/` | Visão geral do time: campanha, KPIs, evolução por partida, destaques |
| `/partidas` | Lista de partidas, criação e edição |
| `/partidas/:id` | **Lançamento** (grade estilo planilha) + resumo da partida |
| `/elenco` | Elenco agrupado por posição |
| `/jogador/:id` | Drilldown de um jogador ao longo das partidas |
| `/comparar` | Jogadores lado a lado |
| `/relatorio` | Blocos GERAL e INDIVIDUAIS, ranking, exportação |
| `/glossario` | O que cada número quer dizer, e as contas por trás deles |

## O modelo de dados

Cada posição registra só os fundamentos que fazem sentido para ela — exatamente como na planilha:

- **Levantadores** — distribuição (Ponta / Saída / Central / Pipe), defesa, cobertura, largadas, saque, block pro
- **Opostos** — ataque certo/errado, largadas, block contra, defesa contra, saque, defesa, cobertura, block pro
- **Pontas** — o do oposto + passe certo/errado e quinou
- **Líbero** — defesa certa, cobertura, quinou, passe A/B/C, passe errado
- **Centrais** — ataque, largadas, block contra, saque, cobertura, block pro, fintado, buraco no block

Além dos fundamentos, cada jogador registra **pontos disputados** — quantos pontos ele passou
em quadra naquela partida. É o denominador que dá escala a tudo: 5 aces em 5 pontos não é a
mesma coisa que 5 aces em 25. Daí saem as taxas **por 25 pontos disputados** (um set) e a
**participação** de cada atleta.

## Pontos conquistados ≠ pontos do placar

"Pontos conquistados" são as ações que geraram ponto para o time — ataque ponto, largada, ace e
block ponto (a definição de súmula: *Points = Attack + Block + Serve*). Um ataque tem três
desfechos, lançados separados: **virou ponto** (Ataque Ponto / Largadas), **o adversário
defendeu** e o rally continuou (Defesa Contra — nem ponto nem erro), ou **virou ponto para eles**
(Ataque Errado / Block Contra). Não errar não é a mesma coisa que pontuar. O placar é sempre maior,
porque boa parte dos pontos cai por **erro do adversário**, que não é ação nossa. As duas coisas
aparecem lado a lado na Visão Geral e na partida, com a fatia que veio de ação própria.

O bloco **GERAL** nunca é digitado: ele é somado a partir dos lançamentos individuais
(`src/lib/analytics.ts`), então time e jogador nunca divergem.

## Stack

Vite · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Recharts · Zustand (persistido)
