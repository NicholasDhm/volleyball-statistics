import type { Position, StatDef } from "./types"

export const POSITIONS: { key: Position; label: string; plural: string; abbr: string; color: string }[] = [
  { key: "levantador", label: "Levantador", plural: "Levantadores", abbr: "LEV", color: "var(--chart-1)" },
  { key: "oposto", label: "Oposto", plural: "Opostos", abbr: "OPO", color: "var(--chart-2)" },
  { key: "ponta", label: "Ponta", plural: "Pontas", abbr: "PON", color: "var(--chart-3)" },
  { key: "libero", label: "Líbero", plural: "Líberos", abbr: "LIB", color: "var(--chart-4)" },
  { key: "central", label: "Central", plural: "Centrais", abbr: "CEN", color: "var(--chart-5)" },
]

export const positionMeta = (p: Position) => POSITIONS.find((x) => x.key === p)!

/**
 * Quantos pontos o jogador disputou em quadra. Não é um fundamento: é o denominador
 * que dá escala a todos os outros números — 5 aces em 5 pontos ≠ 5 aces em 25 pontos.
 */
export const RALLY_STAT = "pontos_jogados"

/** Every countable action, mirroring the team's spreadsheet vocabulary. */
export const STATS: Record<string, StatDef> = {
  pontos_jogados: { key: "pontos_jogados", label: "Pontos disputados", short: "Disp.", group: "participacao", polarity: "neutral", help: "Pontos que o jogador disputou em quadra — o denominador de todas as médias" },

  // levantamento (distribuição do levantador)
  set_ponta:   { key: "set_ponta",   label: "Ponta",   short: "Ponta",  group: "levantamento", polarity: "neutral",  help: "Bola levantada para a ponta (zona 4)" },
  set_saida:   { key: "set_saida",   label: "Saída",   short: "Saída",  group: "levantamento", polarity: "neutral",  help: "Bola levantada para a saída de rede (zona 2)" },
  set_central: { key: "set_central", label: "Central", short: "Central",group: "levantamento", polarity: "neutral",  help: "Bola levantada para o central (zona 3)" },
  set_pipe:    { key: "set_pipe",    label: "Pipe",    short: "Pipe",   group: "levantamento", polarity: "neutral",  help: "Bola levantada de pipe (fundo, zona 6)" },

  // ataque
  ataque_certo:  { key: "ataque_certo",  label: "Ataque Ponto",  short: "Atq pt", group: "ataque", polarity: "positive", help: "A bola caiu: o ataque virou ponto. Se o adversário defendeu, lance em Defesa Contra; se pegou no bloqueio, em Block Contra." },
  ataque_errado: { key: "ataque_errado", label: "Ataque Errado", short: "Atq ✗", group: "ataque", polarity: "negative", help: "Ataque na rede, fora ou invasão — ponto direto para o adversário" },
  largada:       { key: "largada",       label: "Largadas",      short: "Larg",  group: "ataque", polarity: "positive", help: "Largada ou pingo que caiu — também é ponto, só que sem força" },
  block_contra:  { key: "block_contra",  label: "Block Contra",  short: "Blq ✗", group: "ataque", polarity: "negative", help: "O bloqueio adversário parou o ataque e a bola caiu do nosso lado — ponto para eles" },
  def_contra:    { key: "def_contra",    label: "Defesa Contra", short: "Def ✗", group: "ataque", polarity: "neutral",  help: "O adversário defendeu e o rally continuou — não foi ponto nem erro, mas conta como tentativa de ataque" },

  // saque
  saque_certo:  { key: "saque_certo",  label: "Saque Ponto",  short: "Sq pt", group: "saque", polarity: "positive", help: "Ace: o saque virou ponto direto. Saque que entrou e o adversário recebeu normalmente não se lança aqui." },
  saque_errado: { key: "saque_errado", label: "Saque Errado", short: "Sq ✗", group: "saque", polarity: "negative", help: "Saque na rede ou fora" },

  // passe / recepção
  passe_certo:  { key: "passe_certo",  label: "Passe Certo",  short: "Ps ✓", group: "passe", polarity: "positive", help: "Recepção que deixou o levantador jogar — não é ponto, é o que viabiliza o ataque" },
  passe_errado: { key: "passe_errado", label: "Passe Errado", short: "Ps ✗", group: "passe", polarity: "negative", help: "Recepção que resultou em ponto adversário" },
  passe_a:      { key: "passe_a",      label: "Passe A",      short: "Ps A", group: "passe", polarity: "positive", help: "Recepção perfeita — levantador com todas as opções" },
  passe_b:      { key: "passe_b",      label: "Passe B",      short: "Ps B", group: "passe", polarity: "neutral",  help: "Recepção boa — jogada limitada" },
  passe_c:      { key: "passe_c",      label: "Passe C",      short: "Ps C", group: "passe", polarity: "negative", help: "Recepção ruim — sem ataque estruturado" },

  // defesa
  def_certa:  { key: "def_certa",  label: "Defesa Certa", short: "Def ✓", group: "defesa", polarity: "positive", help: "Defendeu o ataque adversário e manteve a bola viva — não é ponto, é continuidade" },
  cobertura:  { key: "cobertura",  label: "Cobertura",    short: "Cob",   group: "defesa", polarity: "positive", help: "Cobertura de ataque do próprio time" },
  quinou:     { key: "quinou",     label: "Quinou",       short: "Qn",    group: "defesa", polarity: "negative", help: "Bola caiu sem tentativa de defesa" },

  // bloqueio
  block_pro:       { key: "block_pro",       label: "Block Ponto",     short: "Blq pt", group: "bloqueio", polarity: "positive", help: "O bloqueio derrubou a bola do lado deles — ponto nosso" },
  fintado:         { key: "fintado",         label: "Fintado",         short: "Fint",  group: "bloqueio", polarity: "negative", help: "Enganado pelo levantador adversário" },
  buraco_no_block: { key: "buraco_no_block", label: "Buraco no Block", short: "Bur",   group: "bloqueio", polarity: "negative", help: "Espaço aberto no bloqueio" },
}

/** Which actions each position records — exactly the columns of the team sheet. */
export const POSITION_STATS: Record<Position, string[]> = {
  levantador: [
    "set_ponta", "set_saida", "set_central", "set_pipe",
    "def_certa", "cobertura", "largada",
    "saque_certo", "saque_errado",
    "block_pro",
  ],
  oposto: [
    "ataque_certo", "ataque_errado", "largada",
    "block_contra", "def_contra",
    "saque_certo", "saque_errado",
    "def_certa", "cobertura",
    "block_pro",
  ],
  ponta: [
    "ataque_certo", "ataque_errado", "largada",
    "block_contra", "def_contra",
    "saque_certo", "saque_errado",
    "passe_certo", "passe_errado",
    "def_certa", "cobertura", "quinou",
    "block_pro",
  ],
  libero: [
    "def_certa", "cobertura", "quinou",
    "passe_a", "passe_b", "passe_c", "passe_errado",
  ],
  central: [
    "ataque_certo", "ataque_errado", "largada",
    "block_contra",
    "saque_certo", "saque_errado",
    "cobertura",
    "block_pro", "fintado", "buraco_no_block",
  ],
}

export const STAT_GROUP_LABEL: Record<string, string> = {
  participacao: "Participação",
  levantamento: "Levantamento",
  ataque: "Ataque",
  saque: "Saque",
  passe: "Passe",
  defesa: "Defesa",
  bloqueio: "Bloqueio",
}

export const statDef = (key: string) => STATS[key]
export const statLabel = (key: string) => STATS[key]?.label ?? key
