import type { Match, Player } from "./types"
import { RALLY_STAT, STATS, positionMeta, statLabel } from "./stats"
import { kpis } from "./analytics"

/**
 * Serialize rows to CSV using `;` as the separator (Brazilian Excel default).
 * Numbers are stringified as-is; any field containing the separator, a quote
 * or a newline is wrapped in quotes with quotes doubled.
 */
export function toCsv(rows: (string | number)[][]): string {
  const field = (v: string | number): string => {
    const s = typeof v === "number" ? String(v) : v
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map((row) => row.map(field).join(";")).join("\n")
}

/** Trigger a browser download of `content` as a file named `filename`. */
export function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** One row per player per match — the digital equivalent of the season sheet. */
export function exportSeasonCsv(players: Player[], matches: Match[]): string {
  const statKeys = Object.keys(STATS).filter((k) => k !== RALLY_STAT)
  const header = [
    "Data",
    "Adversário",
    "Jogador",
    "Posição",
    "Pontos Disputados",
    ...statKeys.map((k) => statLabel(k)),
    "Pontos",
    "Erros",
  ]
  const rows: (string | number)[][] = [header]

  for (const m of matches) {
    for (const p of players) {
      const totals = m.stats[p.id] ?? {}
      const played = m.lineup.includes(p.id) || Object.keys(totals).length > 0
      if (!played) continue
      const k = kpis(totals)
      rows.push([
        m.date,
        m.opponent,
        p.name,
        positionMeta(p.position).label,
        totals[RALLY_STAT] ?? 0,
        ...statKeys.map((key) => totals[key] ?? 0),
        k.pontos,
        k.erros,
      ])
    }
  }

  return toCsv(rows)
}

/** Full season snapshot as pretty-printed JSON. */
export function exportJson(state: { teamName: string; players: Player[]; matches: Match[] }): string {
  return JSON.stringify(
    { teamName: state.teamName, players: state.players, matches: state.matches },
    null,
    2,
  )
}

function isPlayerShape(v: unknown): v is Player {
  if (typeof v !== "object" || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.id === "string" && typeof o.name === "string" && typeof o.position === "string"
}

function isMatchShape(v: unknown): v is Match {
  if (typeof v !== "object" || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === "string" &&
    typeof o.date === "string" &&
    typeof o.opponent === "string" &&
    Array.isArray(o.sets) &&
    typeof o.stats === "object" &&
    o.stats !== null
  )
}

/** Parse and validate a previously exported season JSON. Throws a descriptive Error on any shape mismatch. */
export function parseImportedJson(text: string): { teamName?: string; players: Player[]; matches: Match[] } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("Arquivo inválido: o conteúdo não é um JSON válido.")
  }

  if (typeof data !== "object" || data === null) {
    throw new Error("Arquivo inválido: esperado um objeto JSON no topo do arquivo.")
  }
  const obj = data as Record<string, unknown>

  if (!Array.isArray(obj.players)) {
    throw new Error("Arquivo inválido: 'players' deve ser uma lista de jogadores.")
  }
  if (!obj.players.every(isPlayerShape)) {
    throw new Error("Arquivo inválido: cada jogador precisa de 'id', 'name' e 'position'.")
  }

  if (!Array.isArray(obj.matches)) {
    throw new Error("Arquivo inválido: 'matches' deve ser uma lista de partidas.")
  }
  if (!obj.matches.every(isMatchShape)) {
    throw new Error("Arquivo inválido: cada partida precisa de 'id', 'date', 'opponent', 'sets' e 'stats'.")
  }

  return {
    teamName: typeof obj.teamName === "string" ? obj.teamName : undefined,
    players: obj.players,
    matches: obj.matches,
  }
}
