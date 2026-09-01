export type Position =
  | "levantador"
  | "oposto"
  | "ponta"
  | "libero"
  | "central"

export interface Player {
  id: string
  name: string
  position: Position
  number?: number
  active: boolean
  /**
   * Fichas da MESMA pessoa em posições diferentes compartilham este id. Cada ficha
   * pontua separado (é assim que se compara ponta com ponta), mas a página do jogador
   * sabe juntar tudo. Ausente = a pessoa tem uma ficha só.
   */
  personId?: string
}

export interface MatchSet {
  us: number
  them: number
}

export interface Match {
  id: string
  date: string // ISO yyyy-mm-dd
  opponent: string
  competition?: string
  location?: "casa" | "fora"
  sets: MatchSet[]
  notes?: string
  /** playerId -> statKey -> count */
  stats: Record<string, Record<string, number>>
  /** playerIds that took the court */
  lineup: string[]
}

export type StatGroup =
  | "participacao"
  | "ataque"
  | "saque"
  | "passe"
  | "defesa"
  | "bloqueio"
  | "levantamento"

export interface StatDef {
  key: string
  label: string
  short: string
  group: StatGroup
  /** positive = good action, negative = error, neutral = distribution/volume */
  polarity: "positive" | "negative" | "neutral"
  help: string
}
