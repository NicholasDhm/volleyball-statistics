import type { Player } from "@/lib/types"

export const DEFAULT_ROSTER: Omit<Player, "id">[] = [
  { name: "Henrique", position: "levantador", number: 1, active: true },
  { name: "Mikael", position: "levantador", number: 6, active: true },
  { name: "Pedrinho", position: "oposto", number: 9, active: true },
  { name: "Daniel", position: "oposto", number: 12, active: true },
  { name: "Arthur", position: "ponta", number: 4, active: true },
  { name: "Nick", position: "ponta", number: 7, active: true },
  { name: "João", position: "ponta", number: 10, active: true },
  { name: "Verroy", position: "ponta", number: 14, active: true },
  { name: "Marcos", position: "libero", number: 3, active: true },
  { name: "Nicolas", position: "central", number: 5, active: true },
  { name: "Othavio", position: "central", number: 8, active: true },
]

export const OPPONENTS = [
  "Vôlei Vila Nova",
  "AABB",
  "Sesc Pinheiros B",
  "Clube Paineiras",
  "Atlético Sorocaba",
  "Liga Norte",
  "Praia Grande VC",
  "Unifesp",
  "São Caetano",
  "Guarulhos Vôlei",
  "Time da Casa",
  "Osasco Amadores",
]

export const COMPETITIONS = ["Campeonato Municipal", "Copa Regional", "Amistoso", "Liga de Verão"]
