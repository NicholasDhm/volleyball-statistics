import type { Match, Player, Position } from "@/lib/types"
import { POSITION_STATS, RALLY_STAT } from "@/lib/stats"
import { COMPETITIONS, DEFAULT_ROSTER, OPPONENTS } from "./roster"

/** Deterministic PRNG so the demo season looks the same on every load. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const id = (p: string, n: number) => `${p}_${n.toString(36)}`

/**
 * Peso relativo de cada posição em cada fundamento. Define quem recebe o quê
 * quando um total do time é distribuído entre os jogadores em quadra.
 */
type W = Partial<Record<Position, number>>
const WEIGHTS: Record<string, W> = {
  ataque_certo:    { ponta: 1, oposto: 1.15, central: 0.55 },
  ataque_errado:   { ponta: 1, oposto: 1.15, central: 0.55 },
  block_contra:    { ponta: 1, oposto: 1.15, central: 0.5 },
  def_contra:      { ponta: 1, oposto: 1.1, central: 0.5 },
  largada:         { ponta: 1, oposto: 0.9, central: 0.6, levantador: 0.5 },
  block_pro:       { central: 1.6, oposto: 1, ponta: 0.7, levantador: 0.35 },
  saque_certo:     { ponta: 1, oposto: 1, central: 0.9, levantador: 0.9 },
  saque_errado:    { ponta: 1, oposto: 1, central: 0.9, levantador: 0.9 },
  passe_certo:     { ponta: 1 },
  passe_errado:    { ponta: 1, libero: 0.6 },
  passe_a:         { libero: 1 },
  passe_b:         { libero: 1 },
  passe_c:         { libero: 1 },
  def_certa:       { libero: 1.8, ponta: 1, levantador: 0.8, oposto: 0.7, central: 0.4 },
  cobertura:       { libero: 1.3, ponta: 1, oposto: 1, central: 1, levantador: 1 },
  quinou:          { ponta: 1, libero: 1 },
  fintado:         { central: 1 },
  buraco_no_block: { central: 1 },
  set_ponta:       { levantador: 1 },
  set_saida:       { levantador: 1 },
  set_central:     { levantador: 1 },
  set_pipe:        { levantador: 1 },
}

/** Distribui um total inteiro por pesos, preservando a soma (maior resto). */
function allocate(total: number, weights: { id: string; w: number }[]): Record<string, number> {
  const out: Record<string, number> = {}
  const sum = weights.reduce((s, x) => s + x.w, 0)
  if (total <= 0 || sum <= 0) return out
  const exact = weights.map((x) => ({ id: x.id, v: (x.w / sum) * total }))
  let used = 0
  for (const e of exact) {
    const floor = Math.floor(e.v)
    out[e.id] = floor
    used += floor
  }
  const rest = exact
    .map((e) => ({ id: e.id, frac: e.v - Math.floor(e.v) }))
    .sort((a, b) => b.frac - a.frac)
  for (let i = 0; i < total - used; i++) out[rest[i % rest.length].id] += 1
  return out
}

export function buildDemoSeason(): { players: Player[]; matches: Match[] } {
  const rand = rng(20260901)
  const players: Player[] = DEFAULT_ROSTER.map((p, i) => ({ ...p, id: id("p", i + 1) }))
  const jitter = (base: number, spread: number) => base + (rand() - 0.5) * spread

  /** Multiplicador de qualidade por jogador — faz as comparações significarem algo. */
  const skill = new Map(players.map((p, i) => [p.id, 0.78 + ((i * 7) % 10) / 22]))

  const matches: Match[] = []
  const start = new Date("2026-03-08T00:00:00")

  for (let g = 0; g < 12; g++) {
    const date = new Date(start)
    date.setDate(start.getDate() + g * 7)

    // ---- placar ----
    const bestOf5 = rand() > 0.45
    const ourEdge = rand()
    const sets: Match["sets"] = []
    let usWon = 0
    let themWon = 0
    const target = bestOf5 ? 3 : 2
    while (usWon < target && themWon < target) {
      const weWin = rand() < 0.36 + ourEdge * 0.4
      const decider = bestOf5 && usWon === 2 && themWon === 2
      const cap = decider ? 15 : 25
      const loser = Math.floor(cap - 6 + rand() * 6)
      if (weWin) { sets.push({ us: cap, them: loser }); usWon++ }
      else { sets.push({ us: loser, them: cap }); themWon++ }
    }

    const nossos = sets.reduce((s, x) => s + x.us, 0)
    const deles = sets.reduce((s, x) => s + x.them, 0)
    const rallies = nossos + deles

    // ---- quem jogou e quanto ----
    const bench = new Set<string>()
    if (rand() > 0.5) bench.add(players[(g * 3) % players.length].id)
    if (rand() > 0.75) bench.add(players[(g * 5 + 2) % players.length].id)
    const inCourt = players.filter((p) => !bench.has(p.id))

    const starters = new Set<string>()
    for (const pos of ["levantador", "oposto", "ponta", "libero", "central"] as const) {
      const group = inCourt.filter((p) => p.position === pos)
      const howMany = pos === "ponta" ? 2 : 1
      for (let i = 0; i < Math.min(howMany, group.length); i++) {
        starters.add(group[(g + i) % group.length].id)
      }
    }
    const share = new Map(
      inCourt.map((p) => [p.id, starters.has(p.id) ? jitter(0.9, 0.18) : jitter(0.28, 0.3)]),
    )

    // ---- totais do time, derivados do placar ----
    // parte dos nossos pontos que veio de ação nossa; o resto foi erro do adversário
    const conquistados = Math.round(nossos * jitter(0.66, 0.12))
    // parte dos pontos do adversário que veio de erro nosso
    const errosTime = Math.round(deles * jitter(0.34, 0.14))

    const pAtaque = jitter(0.73, 0.06)
    const pBloqueio = jitter(0.13, 0.04)

    const ataquePontos = Math.round(conquistados * pAtaque)
    const blockPro = Math.round(conquistados * pBloqueio)
    const aces = Math.max(0, conquistados - ataquePontos - blockPro)
    const largadas = Math.round(ataquePontos * jitter(0.22, 0.1))
    const ataqueCerto = ataquePontos - largadas

    const ataqueErrado = Math.round(errosTime * jitter(0.46, 0.1))
    const saqueErrado = Math.round(errosTime * jitter(0.29, 0.08))
    const passeErrado = Math.round(errosTime * jitter(0.18, 0.06))
    const quinou = Math.max(0, errosTime - ataqueErrado - saqueErrado - passeErrado)

    const blockContra = Math.round(rallies * jitter(0.055, 0.03))
    const defContra = Math.round(rallies * jitter(0.1, 0.04))
    const ataquesTotais = ataquePontos + ataqueErrado + blockContra + defContra

    const totals: Record<string, number> = {
      ataque_certo: ataqueCerto,
      largada: largadas,
      block_pro: blockPro,
      saque_certo: aces,
      ataque_errado: ataqueErrado,
      saque_errado: saqueErrado,
      passe_errado: passeErrado,
      quinou,
      block_contra: blockContra,
      def_contra: defContra,
      def_certa: Math.round(rallies * jitter(0.24, 0.08)),
      cobertura: Math.round(rallies * jitter(0.09, 0.04)),
      passe_certo: Math.round(rallies * jitter(0.17, 0.06)),
      passe_a: Math.round(rallies * jitter(0.12, 0.04)),
      passe_b: Math.round(rallies * jitter(0.07, 0.03)),
      passe_c: Math.round(rallies * jitter(0.03, 0.02)),
      fintado: Math.round(rallies * jitter(0.02, 0.015)),
      buraco_no_block: Math.round(rallies * jitter(0.02, 0.015)),
      // o levantador toca quase todo ataque nosso
      set_ponta: Math.round(ataquesTotais * jitter(0.4, 0.06)),
      set_saida: Math.round(ataquesTotais * jitter(0.28, 0.06)),
      set_central: Math.round(ataquesTotais * jitter(0.21, 0.05)),
      set_pipe: Math.round(ataquesTotais * jitter(0.11, 0.05)),
    }

    // ---- distribuir cada total entre quem estava em quadra ----
    const stats: Match["stats"] = {}
    for (const p of inCourt) {
      stats[p.id] = { [RALLY_STAT]: Math.max(1, Math.round(rallies * (share.get(p.id) ?? 0))) }
    }

    for (const [key, total] of Object.entries(totals)) {
      const isBad =
        key.includes("errado") || key.includes("contra") || key === "quinou" ||
        key === "fintado" || key === "buraco_no_block" || key === "passe_c"
      const weights = inCourt
        .filter((p) => POSITION_STATS[p.position].includes(key))
        .map((p) => {
          const base = WEIGHTS[key]?.[p.position] ?? 0
          const s = skill.get(p.id) ?? 1
          // quem joga melhor pontua mais e erra menos
          return { id: p.id, w: base * (share.get(p.id) ?? 0) * (isBad ? 2 - s : s) }
        })
        .filter((x) => x.w > 0)
      const spread = allocate(Math.max(0, total), weights)
      for (const [pid, v] of Object.entries(spread)) {
        if (v > 0) stats[pid][key] = v
      }
    }

    matches.push({
      id: id("m", g + 1),
      date: date.toISOString().slice(0, 10),
      opponent: OPPONENTS[g % OPPONENTS.length],
      competition: COMPETITIONS[g % COMPETITIONS.length],
      location: g % 2 === 0 ? "casa" : "fora",
      sets,
      lineup: inCourt.map((p) => p.id),
      stats,
    })
  }

  return { players, matches: matches.reverse() }
}
