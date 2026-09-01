import type { Match, Player, Position } from "./types"
import { POSITION_STATS, RALLY_STAT } from "./stats"

export type Totals = Record<string, number>

export const emptyTotals = (): Totals => ({})

export function addTotals(a: Totals, b: Totals): Totals {
  const out: Totals = { ...a }
  for (const k in b) out[k] = (out[k] ?? 0) + (b[k] ?? 0)
  return out
}

export const t = (x: Totals | undefined, k: string) => x?.[k] ?? 0

const pct = (n: number, d: number) => (d > 0 ? n / d : 0)

/** Per-player derived metrics. All rates are 0..1 (or -1..1 for efficiency). */
export interface Kpis {
  pontos: number
  erros: number
  saldo: number
  ataqueTentativas: number
  ataquePontos: number
  ataqueErros: number
  ataqueAproveitamento: number
  ataqueEficiencia: number
  saqueTotal: number
  saqueAces: number
  saqueErros: number
  saqueEficiencia: number
  passeTotal: number
  passeCertos: number
  passeErros: number
  passeAproveitamento: number
  /** 0..100 — nota de passe estilo A/B/C, só relevante para líbero/ponta */
  passeNota: number
  defesas: number
  coberturas: number
  blocks: number
  levantamentos: number
  /** Pontos que o jogador disputou em quadra — denominador de todas as médias. */
  pontosJogados: number
  /** Volume normalizado por 25 pontos disputados (um set). 0 quando não há participação lançada. */
  pontosPor25: number
  errosPor25: number
  saldoPor25: number
  acesPor25: number
  defesasPor25: number
  blocksPor25: number
  ataquesPor25: number
}

export function kpis(x: Totals): Kpis {
  const ataquePontos = t(x, "ataque_certo") + t(x, "largada")
  const ataqueErros = t(x, "ataque_errado") + t(x, "block_contra")
  const ataqueTentativas = ataquePontos + ataqueErros + t(x, "def_contra")

  const saqueAces = t(x, "saque_certo")
  const saqueErros = t(x, "saque_errado")
  const saqueTotal = saqueAces + saqueErros

  const passeA = t(x, "passe_a")
  const passeB = t(x, "passe_b")
  const passeC = t(x, "passe_c")
  const passeCertos = t(x, "passe_certo") + passeA + passeB
  const passeErros = t(x, "passe_errado") + passeC
  const passeTotal = passeCertos + passeErros

  // graduação A/B/C só existe para quem a registra (líbero). Quem só marca certo/errado
  // cai no aproveitamento simples — antes o "errado" sozinho zerava a nota de todo ponta.
  const graded = passeA + passeB + passeC
  const passeNota =
    graded > 0
      ? ((passeA * 3 + passeB * 2 + passeC * 1) / ((graded + t(x, "passe_errado")) * 3)) * 100
      : pct(passeCertos, passeTotal) * 100

  const blocks = t(x, "block_pro")
  const pontosJogados = t(x, RALLY_STAT)
  const per25 = (n: number) => (pontosJogados > 0 ? (n / pontosJogados) * 25 : 0)
  const pontos = ataquePontos + saqueAces + blocks
  const erros =
    t(x, "ataque_errado") + t(x, "saque_errado") + t(x, "passe_errado") + t(x, "quinou")

  return {
    pontos,
    erros,
    saldo: pontos - erros,
    ataqueTentativas,
    ataquePontos,
    ataqueErros,
    ataqueAproveitamento: pct(ataquePontos, ataqueTentativas),
    ataqueEficiencia: pct(ataquePontos - ataqueErros, ataqueTentativas),
    saqueTotal,
    saqueAces,
    saqueErros,
    saqueEficiencia: pct(saqueAces - saqueErros, Math.max(saqueTotal, 1)),
    passeTotal,
    passeCertos,
    passeErros,
    passeAproveitamento: pct(passeCertos, passeTotal),
    passeNota,
    defesas: t(x, "def_certa"),
    coberturas: t(x, "cobertura"),
    blocks,
    levantamentos:
      t(x, "set_ponta") + t(x, "set_saida") + t(x, "set_central") + t(x, "set_pipe"),
    pontosJogados,
    pontosPor25: per25(pontos),
    errosPor25: per25(erros),
    saldoPor25: per25(pontos - erros),
    acesPor25: per25(saqueAces),
    defesasPor25: per25(t(x, "def_certa")),
    blocksPor25: per25(blocks),
    ataquesPor25: per25(ataqueTentativas),
  }
}

/** Pontos disputados na partida inteira — a soma dos placares de todos os sets. */
export const matchRallies = (m: Match) => m.sets.reduce((s, x) => s + x.us + x.them, 0)

export const totalRallies = (matches: Match[]) => matches.reduce((s, m) => s + matchRallies(m), 0)

/**
 * Fatia dos pontos da partida (ou do recorte) que o jogador disputou, 0..1.
 * Devolve null quando não há participação lançada — melhor omitir do que mentir.
 */
export function participacao(matches: Match[], playerId: string): number | null {
  const played = matches.reduce((s, m) => s + t(m.stats[playerId], RALLY_STAT), 0)
  if (played === 0) return null
  const total = totalRallies(playerMatches(matches, playerId))
  return total > 0 ? Math.min(played / total, 1) : null
}

/** true quando há dados de participação suficientes para mostrar médias por 25 pontos. */
export const hasRallyData = (x: Totals) => t(x, RALLY_STAT) > 0

/** Totals for one player in one match. */
export const playerMatchTotals = (m: Match, playerId: string): Totals => m.stats[playerId] ?? {}

/** Totals for one player across the given matches. */
export function playerTotals(matches: Match[], playerId: string): Totals {
  return matches.reduce<Totals>((acc, m) => addTotals(acc, playerMatchTotals(m, playerId)), {})
}

/** Matches where the player actually recorded something / was in the lineup. */
export function playerMatches(matches: Match[], playerId: string): Match[] {
  return matches.filter(
    (m) => m.lineup.includes(playerId) || Object.keys(m.stats[playerId] ?? {}).length > 0,
  )
}

/** Team totals for one match (sum over all players). */
export function matchTotals(m: Match): Totals {
  return Object.values(m.stats).reduce<Totals>((acc, s) => addTotals(acc, s), {})
}

export function teamTotals(matches: Match[]): Totals {
  return matches.reduce<Totals>((acc, m) => addTotals(acc, matchTotals(m)), {})
}

/** The "GERAL" block of the spreadsheet, computed instead of typed. */
export interface GeralBlock {
  ataquesPonta: number
  ataquesOposto: number
  ataquesCentral: number
  ataquesPipe: number
  ataquesGerais: number
  ataquesCertos: number
  ataquesErrados: number
  largadas: number
  defesasCertas: number
  saquesCertos: number
  saquesErrados: number
  passesCertos: number
  passesErrados: number
  blocksDados: number
  blocksTomados: number
  errosCometidos: number
}

const attemptsOf = (x: Totals) =>
  t(x, "ataque_certo") + t(x, "largada") + t(x, "ataque_errado") + t(x, "block_contra") + t(x, "def_contra")

export function geral(matches: Match[], players: Player[]): GeralBlock {
  const byPos = (pos: Position) =>
    players
      .filter((p) => p.position === pos)
      .reduce((sum, p) => sum + attemptsOf(playerTotals(matches, p.id)), 0)

  const all = teamTotals(matches)
  const k = kpis(all)

  return {
    ataquesPonta: byPos("ponta"),
    ataquesOposto: byPos("oposto"),
    ataquesCentral: byPos("central"),
    ataquesPipe: t(all, "set_pipe"),
    ataquesGerais: k.ataqueTentativas,
    ataquesCertos: t(all, "ataque_certo"),
    ataquesErrados: t(all, "ataque_errado"),
    largadas: t(all, "largada"),
    defesasCertas: t(all, "def_certa"),
    saquesCertos: t(all, "saque_certo"),
    saquesErrados: t(all, "saque_errado"),
    passesCertos: k.passeCertos,
    passesErrados: k.passeErros,
    blocksDados: t(all, "block_pro"),
    blocksTomados: t(all, "block_contra"),
    errosCometidos: k.erros,
  }
}

/**
 * O que aconteceu com cada bola atacada. Responde "ataque certo foi ponto?":
 * sim — `ponto` e `largada` são pontos; `defendido` é rally que continuou;
 * `bloqueado` e `erro` são ponto para o adversário.
 */
export function attackOutcome(x: Totals) {
  const rows = [
    { key: "ponto", label: "Virou ponto", value: t(x, "ataque_certo"), tone: "good" as const },
    { key: "largada", label: "Largada (ponto)", value: t(x, "largada"), tone: "good" as const },
    { key: "defendido", label: "Adversário defendeu", value: t(x, "def_contra"), tone: "neutral" as const },
    { key: "bloqueado", label: "Bloqueado", value: t(x, "block_contra"), tone: "bad" as const },
    { key: "erro", label: "Erro de ataque", value: t(x, "ataque_errado"), tone: "bad" as const },
  ]
  const total = rows.reduce((s, r) => s + r.value, 0)
  return { rows: rows.map((r) => ({ ...r, share: total > 0 ? r.value / total : 0 })), total }
}

/**
 * De onde vieram os pontos do placar. O que sobra depois das nossas ações
 * é, por definição, erro do adversário.
 */
export function pointOrigins(matches: Match[]) {
  const x = teamTotals(matches)
  const placar = totalPontosPlacar(matches)
  const nossas = [
    { key: "ataque", label: "Ataque", value: t(x, "ataque_certo") },
    { key: "largada", label: "Largada", value: t(x, "largada") },
    { key: "saque", label: "Saque (ace)", value: t(x, "saque_certo") },
    { key: "bloqueio", label: "Bloqueio", value: t(x, "block_pro") },
  ]
  const conquistados = nossas.reduce((s, r) => s + r.value, 0)
  const rows = [...nossas, {
    key: "erro_adv",
    label: "Erro do adversário",
    value: Math.max(0, placar - conquistados),
  }]
  const total = Math.max(placar, conquistados)
  return { rows: rows.map((r) => ({ ...r, share: total > 0 ? r.value / total : 0 })), total, conquistados, placar }
}

/** Erros cometidos, por fundamento. */
export function errorBreakdown(x: Totals) {
  const rows = [
    { key: "ataque_errado", label: "Ataque", value: t(x, "ataque_errado") },
    { key: "saque_errado", label: "Saque", value: t(x, "saque_errado") },
    { key: "passe_errado", label: "Passe", value: t(x, "passe_errado") },
    { key: "quinou", label: "Quinou", value: t(x, "quinou") },
  ]
  const total = rows.reduce((s, r) => s + r.value, 0)
  return { rows: rows.map((r) => ({ ...r, share: total > 0 ? r.value / total : 0 })), total }
}

/** Qualidade da recepção: A/B/C quando houver graduação, senão certo/errado. */
export function receptionBreakdown(x: Totals) {
  const graded = t(x, "passe_a") + t(x, "passe_b") + t(x, "passe_c")
  const rows = graded > 0
    ? [
        { key: "passe_a", label: "Passe A", value: t(x, "passe_a") },
        { key: "passe_b", label: "Passe B", value: t(x, "passe_b") },
        { key: "passe_c", label: "Passe C", value: t(x, "passe_c") },
        { key: "passe_errado", label: "Errado", value: t(x, "passe_errado") },
      ]
    : [
        { key: "passe_certo", label: "Certo", value: t(x, "passe_certo") },
        { key: "passe_errado", label: "Errado", value: t(x, "passe_errado") },
      ]
  const total = rows.reduce((s, r) => s + r.value, 0)
  return { rows: rows.map((r) => ({ ...r, share: total > 0 ? r.value / total : 0 })), total, graded: graded > 0 }
}

/**
 * Um time não pode conquistar mais pontos do que marcou no placar. Quando isso
 * acontece, o lançamento (ou o placar) está inconsistente — melhor avisar do que
 * mostrar 172%.
 */
export const scoreIsConsistent = (m: Match) =>
  pontosPlacar(m) === 0 || kpis(matchTotals(m)).pontos <= pontosPlacar(m)

/**
 * Quem recebeu as bolas de cada zona. O lançamento registra só a zona, então os
 * jogadores são derivados: cada zona pertence a uma posição, e o peso de cada atleta
 * é a fatia dele nas tentativas de ataque daquela posição. É estimativa, não lançamento.
 */
export function setTargets(matches: Match[], players: Player[]) {
  const x = teamTotals(matches)
  const attempts = (p: Player) => {
    const pt = playerTotals(matches, p.id)
    return (
      t(pt, "ataque_certo") + t(pt, "largada") + t(pt, "ataque_errado") +
      t(pt, "block_contra") + t(pt, "def_contra")
    )
  }
  const zones: { key: string; label: string; from: Position; hint: string }[] = [
    { key: "set_ponta", label: "Ponta", from: "ponta", hint: "atacando pela zona 4" },
    { key: "set_saida", label: "Saída", from: "oposto", hint: "atacando pela zona 2" },
    { key: "set_central", label: "Central", from: "central", hint: "atacando pelo meio" },
    { key: "set_pipe", label: "Pipe", from: "ponta", hint: "pontas atacando do fundo" },
  ]
  const grand = zones.reduce((s, z) => s + t(x, z.key), 0)

  return zones.map((z) => {
    const value = t(x, z.key)
    const group = players.filter((p) => p.position === z.from)
    const weights = group.map((p) => ({ player: p, w: attempts(p) }))
    const sum = weights.reduce((s, w) => s + w.w, 0)
    return {
      ...z,
      value,
      share: grand > 0 ? value / grand : 0,
      receivers: weights
        .filter((w) => w.w > 0)
        .map((w) => ({
          player: w.player,
          share: sum > 0 ? w.w / sum : 0,
          estimate: sum > 0 ? Math.round((w.w / sum) * value) : 0,
        }))
        .sort((a, b) => b.estimate - a.estimate),
    }
  })
}

/** Distribuição de levantamento do time (ou de um levantador). */
export function setDistribution(x: Totals) {
  const rows = [
    { key: "set_ponta", label: "Ponta", value: t(x, "set_ponta") },
    { key: "set_saida", label: "Saída", value: t(x, "set_saida") },
    { key: "set_central", label: "Central", value: t(x, "set_central") },
    { key: "set_pipe", label: "Pipe", value: t(x, "set_pipe") },
  ]
  const total = rows.reduce((s, r) => s + r.value, 0)
  return rows.map((r) => ({ ...r, share: total > 0 ? r.value / total : 0 }))
}

/** Pontos que marcamos no placar — inclui os que vieram de erro do adversário. */
export const pontosPlacar = (m: Match) => m.sets.reduce((s, x) => s + x.us, 0)
/** Pontos que o adversário marcou no placar — inclui os que vieram de erro nosso. */
export const pontosCedidos = (m: Match) => m.sets.reduce((s, x) => s + x.them, 0)

export const totalPontosPlacar = (ms: Match[]) => ms.reduce((s, m) => s + pontosPlacar(m), 0)
export const totalPontosCedidos = (ms: Match[]) => ms.reduce((s, m) => s + pontosCedidos(m), 0)

/**
 * Fatia dos nossos pontos no placar que veio de ação nossa (ataque, saque, bloqueio)
 * em vez de erro do adversário. 0..1, ou null sem placar lançado.
 */
export function aproveitamentoDoPlacar(matches: Match[]): number | null {
  const placar = totalPontosPlacar(matches)
  if (placar === 0) return null
  return Math.min(kpis(teamTotals(matches)).pontos / placar, 1)
}

/** Identidade da pessoa por trás da ficha — fichas da mesma pessoa devolvem a mesma chave. */
export const personKey = (p: Player) => p.personId ?? p.id

/** Todas as fichas da mesma pessoa, na ordem do elenco (inclui a própria). */
export const personCards = (players: Player[], player: Player) =>
  players.filter((p) => personKey(p) === personKey(player))

/** Agrupa o elenco por pessoa, preservando a ordem. */
export function byPerson(players: Player[]): Player[][] {
  const groups = new Map<string, Player[]>()
  for (const p of players) {
    const k = personKey(p)
    groups.set(k, [...(groups.get(k) ?? []), p])
  }
  return [...groups.values()]
}

/**
 * Totais somando todas as fichas de uma pessoa. Os fundamentos somam direto, mas
 * pontos disputados não: a pessoa não pode ter disputado mais pontos do que a partida teve,
 * mesmo que tenha atuado em duas posições no mesmo jogo.
 */
export function personTotals(matches: Match[], cards: Player[]): Totals {
  const out = cards.reduce<Totals>((acc, c) => addTotals(acc, playerTotals(matches, c.id)), {})
  let rallies = 0
  for (const m of matches) {
    const played = cards.reduce((s, c) => s + t(m.stats[c.id], RALLY_STAT), 0)
    if (played > 0) rallies += Math.min(played, matchRallies(m))
  }
  if (rallies > 0) out[RALLY_STAT] = rallies
  return out
}

export const setsWon = (m: Match) => m.sets.filter((s) => s.us > s.them).length
export const setsLost = (m: Match) => m.sets.filter((s) => s.them > s.us).length
export const isWin = (m: Match) => setsWon(m) > setsLost(m)

export interface TeamRecord { jogos: number; vitorias: number; derrotas: number; setsPro: number; setsContra: number }
export function record(matches: Match[]): TeamRecord {
  return matches.reduce<TeamRecord>(
    (r, m) => ({
      jogos: r.jogos + 1,
      vitorias: r.vitorias + (isWin(m) ? 1 : 0),
      derrotas: r.derrotas + (isWin(m) ? 0 : 1),
      setsPro: r.setsPro + setsWon(m),
      setsContra: r.setsContra + setsLost(m),
    }),
    { jogos: 0, vitorias: 0, derrotas: 0, setsPro: 0, setsContra: 0 },
  )
}

/** Stat keys relevant to a position, filtered to those with data. */
export const relevantStats = (pos: Position, x?: Totals) =>
  POSITION_STATS[pos].filter((k) => !x || t(x, k) > 0)

export const fmtPct = (n: number, digits = 0) =>
  `${(n * 100).toFixed(digits).replace(".", ",")}%`
export const fmtNum = (n: number, digits = 0) => n.toFixed(digits).replace(".", ",")
export const fmtSigned = (n: number) => (n > 0 ? `+${n}` : `${n}`)
