import type { Match, Player } from "./types"

/** O que vai parar no JSON do repositório. */
export interface SeasonFile {
  version: 1
  savedAt: string
  teamName: string
  players: Player[]
  matches: Match[]
}

export interface RemoteState {
  data: SeasonFile | null
  sha: string | null
}

export class SyncError extends Error {
  status: number
  remote?: RemoteState
  constructor(message: string, status: number, remote?: RemoteState) {
    super(message)
    this.status = status
    this.remote = remote
  }
}

const ENDPOINT = "/api/data"

/**
 * Sem a função serverless (por exemplo em `npm run dev` puro), o servidor devolve o
 * index.html com status 200 para qualquer rota. Aceitar isso como sucesso marcaria os
 * dados como salvos sem terem saído do navegador — então exigimos JSON de verdade.
 */
async function fetchOrThrow(init: RequestInit): Promise<Response> {
  try {
    return await fetch(ENDPOINT, init)
  } catch {
    throw new SyncError("Não consegui falar com a API de sincronização", 0)
  }
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const type = res.headers.get("content-type") ?? ""
  if (!type.includes("application/json")) {
    throw new SyncError("A API de sincronização não está disponível aqui", 0)
  }
  try {
    return await res.json()
  } catch {
    throw new SyncError("Resposta inválida da API de sincronização", 0)
  }
}

export async function fetchRemote(): Promise<RemoteState> {
  const res = await fetch(ENDPOINT, { cache: "no-store" }).catch(() => {
    throw new SyncError("Não consegui falar com a API de sincronização", 0)
  })
  const body = await readJson(res)
  if (!res.ok) throw new SyncError((body.error as string) ?? `Erro ${res.status}`, res.status)
  return { data: (body.data as SeasonFile) ?? null, sha: (body.sha as string) ?? null }
}

export async function pushRemote(args: {
  file: SeasonFile
  sha: string | null
  password: string
  message: string
}): Promise<{ sha: string; commit: string }> {
  const res = await fetchOrThrow({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      password: args.password,
      sha: args.sha,
      message: args.message,
      data: args.file,
    }),
  })
  const body = await readJson(res)
  if (res.status === 409) {
    throw new SyncError("Alguém salvou antes de você", 409, {
      data: (body.remote as SeasonFile) ?? null,
      sha: (body.sha as string) ?? null,
    })
  }
  if (!res.ok) throw new SyncError((body.error as string) ?? `Erro ${res.status}`, res.status)
  if (typeof body.sha !== "string") {
    throw new SyncError("A API não confirmou a gravação", 0)
  }
  return { sha: body.sha, commit: body.commit as string }
}

/** O recorte do estado que é sincronizado — nada de tema ou preferência local. */
export interface Snapshot {
  teamName: string
  players: Player[]
  matches: Match[]
}

export const toFile = (s: Snapshot): SeasonFile => ({
  version: 1,
  savedAt: new Date().toISOString(),
  teamName: s.teamName,
  players: s.players,
  matches: s.matches,
})

export interface Pending {
  players: { added: number; changed: number; removed: number }
  matches: { added: number; changed: number; removed: number }
  teamName: boolean
  total: number
}

function diffById<T extends { id: string }>(before: T[], after: T[]) {
  const b = new Map(before.map((x) => [x.id, x]))
  const a = new Map(after.map((x) => [x.id, x]))
  let added = 0
  let changed = 0
  for (const [id, item] of a) {
    const prev = b.get(id)
    if (!prev) added++
    else if (JSON.stringify(prev) !== JSON.stringify(item)) changed++
  }
  let removed = 0
  for (const id of b.keys()) if (!a.has(id)) removed++
  return { added, changed, removed }
}

/** O que mudou desde o último save — é isso que o botão mostra. */
export function pendingChanges(saved: Snapshot | null, current: Snapshot): Pending {
  const empty = { added: 0, changed: 0, removed: 0 }
  if (!saved) {
    // temporada em branco e nada publicado ainda: não há o que salvar, e é isso que
    // permite o app adotar em silêncio o que estiver no repositório no primeiro acesso
    if (current.players.length === 0 && current.matches.length === 0) {
      return { players: empty, matches: { ...empty }, teamName: false, total: 0 }
    }
    return {
      players: { ...empty, added: current.players.length },
      matches: { ...empty, added: current.matches.length },
      teamName: true,
      total: current.players.length + current.matches.length + 1,
    }
  }
  const players = diffById(saved.players, current.players)
  const matches = diffById(saved.matches, current.matches)
  const teamName = saved.teamName !== current.teamName
  const sum = (d: typeof players) => d.added + d.changed + d.removed
  return {
    players,
    matches,
    teamName,
    total: sum(players) + sum(matches) + (teamName ? 1 : 0),
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Resumo curto para o botão: "2 partidas, 1 jogador". */
export function describePending(p: Pending): string {
  const parts: string[] = []
  const m = p.matches.added + p.matches.changed + p.matches.removed
  const j = p.players.added + p.players.changed + p.players.removed
  if (m) parts.push(plural(m, "partida", "partidas"))
  if (j) parts.push(plural(j, "jogador", "jogadores"))
  if (p.teamName) parts.push("nome do time")
  return parts.join(", ")
}

/** Mensagem do commit — o histórico do repo vira o diário da temporada. */
export function commitMessage(p: Pending, current: Snapshot): string {
  const touched = current.matches.length
  const bits: string[] = []
  if (p.matches.added) bits.push(`+${p.matches.added} partida${p.matches.added > 1 ? "s" : ""}`)
  if (p.matches.changed) bits.push(`${p.matches.changed} partida${p.matches.changed > 1 ? "s" : ""} atualizada${p.matches.changed > 1 ? "s" : ""}`)
  if (p.matches.removed) bits.push(`-${p.matches.removed} partida${p.matches.removed > 1 ? "s" : ""}`)
  if (p.players.added) bits.push(`+${p.players.added} no elenco`)
  if (p.players.changed) bits.push(`${p.players.changed} do elenco atualizado${p.players.changed > 1 ? "s" : ""}`)
  if (p.players.removed) bits.push(`-${p.players.removed} do elenco`)
  if (p.teamName) bits.push(`time: ${current.teamName}`)
  const head = bits.length ? bits.join(" · ") : "Atualiza estatísticas"
  return `${head} (${touched} partidas na temporada)`
}
