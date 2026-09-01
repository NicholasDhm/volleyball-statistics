import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Match, Player, Position } from "@/lib/types"
import type { Snapshot } from "@/lib/sync"

const uid = () => Math.random().toString(36).slice(2, 10)

interface TeamState {
  teamName: string
  players: Player[]
  matches: Match[]
  /** Cópia do que foi gravado no repositório da última vez — base para saber o que está pendente. */
  lastSaved: Snapshot | null
  /** SHA do arquivo no GitHub, para detectar que alguém salvou antes de nós. */
  remoteSha: string | null

  setTeamName: (name: string) => void
  addPlayer: (p: Omit<Player, "id">) => string
  /** Cria outra ficha (outra posição) para a mesma pessoa. */
  addPositionToPlayer: (playerId: string, position: Player["position"], number?: number) => string
  /** Desvincula uma ficha: ela vira uma pessoa separada. */
  unlinkPlayer: (playerId: string) => void
  updatePlayer: (id: string, patch: Partial<Player>) => void
  removePlayer: (id: string) => void

  addMatch: (m: Omit<Match, "id" | "stats" | "lineup"> & Partial<Pick<Match, "stats" | "lineup">>) => string
  updateMatch: (id: string, patch: Partial<Match>) => void
  removeMatch: (id: string) => void

  setStat: (matchId: string, playerId: string, key: string, value: number) => void
  bumpStat: (matchId: string, playerId: string, key: string, delta: number) => void
  toggleLineup: (matchId: string, playerId: string) => void

  /** Registra que o estado atual foi publicado. */
  markSaved: (snapshot: Snapshot, sha: string | null) => void
  /** Substitui tudo pelo que veio do repositório. */
  adoptRemote: (snapshot: Snapshot, sha: string | null) => void

  resetAll: () => void
  importState: (data: { teamName?: string; players: Player[]; matches: Match[] }) => void
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set) => ({
      teamName: "Meu Time",
      players: [],
      matches: [],
      lastSaved: null,
      remoteSha: null,

      setTeamName: (teamName) => set({ teamName }),

      addPlayer: (p) => {
        const id = uid()
        set((s) => ({ players: [...s.players, { ...p, id }] }))
        return id
      },
      addPositionToPlayer: (playerId, position, number) => {
        const id = uid()
        set((s) => {
          const base = s.players.find((p) => p.id === playerId)
          if (!base) return s
          const personId = base.personId ?? base.id
          // a ficha original passa a carregar o personId explicitamente
          const players = s.players.map((p) => (p.id === base.id ? { ...p, personId } : p))
          return {
            players: [
              ...players,
              { id, name: base.name, position, number: number ?? base.number, active: true, personId },
            ],
          }
        })
        return id
      },

      unlinkPlayer: (playerId) =>
        set((s) => ({
          players: s.players.map((p) => (p.id === playerId ? { ...p, personId: undefined } : p)),
        })),

      updatePlayer: (id, patch) =>
        set((s) => ({ players: s.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      removePlayer: (id) =>
        set((s) => ({
          players: s.players.filter((p) => p.id !== id),
          matches: s.matches.map((m) => {
            const { [id]: _drop, ...rest } = m.stats
            return { ...m, stats: rest, lineup: m.lineup.filter((x) => x !== id) }
          }),
        })),

      addMatch: (m) => {
        const id = uid()
        set((s) => ({
          matches: [{ stats: {}, lineup: [], ...m, id }, ...s.matches].sort((a, b) =>
            b.date.localeCompare(a.date),
          ),
        }))
        return id
      },
      updateMatch: (id, patch) =>
        set((s) => ({
          matches: s.matches
            .map((m) => (m.id === id ? { ...m, ...patch } : m))
            .sort((a, b) => b.date.localeCompare(a.date)),
        })),
      removeMatch: (id) => set((s) => ({ matches: s.matches.filter((m) => m.id !== id) })),

      setStat: (matchId, playerId, key, value) =>
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m
            const row = { ...(m.stats[playerId] ?? {}) }
            const v = Math.max(0, Math.round(value) || 0)
            if (v === 0) delete row[key]
            else row[key] = v
            const lineup = m.lineup.includes(playerId) ? m.lineup : [...m.lineup, playerId]
            return { ...m, stats: { ...m.stats, [playerId]: row }, lineup }
          }),
        })),

      bumpStat: (matchId, playerId, key, delta) =>
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m
            const row = { ...(m.stats[playerId] ?? {}) }
            const v = Math.max(0, (row[key] ?? 0) + delta)
            if (v === 0) delete row[key]
            else row[key] = v
            const lineup = m.lineup.includes(playerId) ? m.lineup : [...m.lineup, playerId]
            return { ...m, stats: { ...m.stats, [playerId]: row }, lineup }
          }),
        })),

      toggleLineup: (matchId, playerId) =>
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === matchId
              ? {
                  ...m,
                  lineup: m.lineup.includes(playerId)
                    ? m.lineup.filter((x) => x !== playerId)
                    : [...m.lineup, playerId],
                }
              : m,
          ),
        })),

      markSaved: (snapshot, sha) =>
        set({ lastSaved: structuredClone(snapshot), remoteSha: sha }),

      adoptRemote: (snapshot, sha) => {
        // defensivo de propósito: um arquivo remoto malformado não pode derrubar o app
        const safe: Snapshot = {
          teamName: snapshot?.teamName ?? "Meu Time",
          players: Array.isArray(snapshot?.players) ? snapshot.players : [],
          matches: Array.isArray(snapshot?.matches) ? snapshot.matches : [],
        }
        set({
          ...safe,
          matches: [...safe.matches].sort((a, b) => b.date.localeCompare(a.date)),
          lastSaved: structuredClone(safe),
          remoteSha: sha,
        })
      },

      resetAll: () => set({ players: [], matches: [], teamName: "Meu Time" }),
      importState: (data) =>
        set({
          teamName: data.teamName ?? "Meu Time",
          players: data.players ?? [],
          matches: data.matches ?? [],
        }),
    }),
    {
      name: "volei-stats-v1",
      version: 3,
      // versões antigas guardavam uma temporada de demonstração; hoje o app começa vazio
      // e só recebe dados reais, então migrar é apenas preservar o que o time já lançou.
      migrate: (persisted) => persisted,
    },
  ),
)

/** Selectors */
export const usePlayers = () => useTeamStore((s) => s.players)
export const useMatches = () => useTeamStore((s) => s.matches)
export const usePlayer = (id?: string) =>
  useTeamStore((s) => s.players.find((p) => p.id === id))
export const useMatch = (id?: string) => useTeamStore((s) => s.matches.find((m) => m.id === id))
export const usePlayersByPosition = (pos: Position) =>
  useTeamStore((s) => s.players.filter((p) => p.position === pos))
