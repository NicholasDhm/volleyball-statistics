import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { MoreVertical, Pencil, PersonStanding, Trash2, UserPlus, Users } from "lucide-react"
import { EmptyState, PageHeader, PositionBadge } from "@/components/kit"
import { Legend, seriesColor } from "@/components/charts/chart-kit"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { PlayerFormDialog } from "@/components/PlayerFormDialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  byPerson,
  fmtNum,
  fmtPct,
  kpis,
  participacao,
  personCards,
  playerMatches,
  playerTotals,
  type Kpis,
} from "@/lib/analytics"
import { POSITIONS, positionMeta } from "@/lib/stats"
import type { Match, Player, Position } from "@/lib/types"
import { useMatches, usePlayers, useTeamStore } from "@/store/useTeamStore"
import { toast } from "sonner"

type Filter = Position | "todos"
type SortOption = "pontos" | "pontosPor25" | "emQuadra" | "nome"

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: "pontos", label: "Pontos" },
  { key: "pontosPor25", label: "Pontos/25" },
  { key: "emQuadra", label: "Em quadra" },
  { key: "nome", label: "Nome" },
]

function headlineMetric(position: Position, k: Kpis) {
  if (position === "levantador") return { label: "Levant.", value: String(k.levantamentos) }
  if (position === "libero") return { label: "Passe", value: fmtNum(k.passeNota, 0) }
  return { label: "Ataque %", value: fmtPct(k.ataqueEficiencia, 0) }
}

/** Sort value for a player, or null when the option needs rally data the player doesn't have. */
function sortValue(sort: SortOption, k: Kpis, partic: number | null): number | null {
  if (sort === "pontos") return k.pontos
  if (sort === "pontosPor25") return k.pontosJogados > 0 ? k.pontosPor25 : null
  return partic
}

export default function Roster() {
  const players = usePlayers()
  const matches = useMatches()
  const removePlayer = useTeamStore((s) => s.removePlayer)
  const [filter, setFilter] = useState<Filter>("todos")
  const [sort, setSort] = useState<SortOption>("pontos")

  const people = useMemo(() => byPerson(players), [players])
  const activePeople = people.filter((g) => g.some((c) => c.active)).length
  const rosterSubtitle =
    players.length !== people.length
      ? `${people.length} jogadores · ${players.length} fichas · ${activePeople} em atividade`
      : `${people.length} jogadores · ${activePeople} em atividade`

  const playerStats = useMemo(() => {
    const map = new Map<string, { k: Kpis; participacao: number | null }>()
    for (const p of players) {
      const pm = playerMatches(matches, p.id)
      map.set(p.id, { k: kpis(playerTotals(pm, p.id)), participacao: participacao(matches, p.id) })
    }
    return map
  }, [players, matches])

  const groups = useMemo(() => {
    const filtered = filter === "todos" ? players : players.filter((p) => p.position === filter)
    return POSITIONS.filter((pm) => filter === "todos" || pm.key === filter)
      .map((pm) => ({
        meta: pm,
        players: filtered
          .filter((p) => p.position === pm.key)
          .slice()
          .sort((a, b) => {
            if (sort === "nome") return a.name.localeCompare(b.name, "pt-BR")
            const sa = playerStats.get(a.id)!
            const sb = playerStats.get(b.id)!
            const av = sortValue(sort, sa.k, sa.participacao)
            const bv = sortValue(sort, sb.k, sb.participacao)
            if (av == null && bv == null) return a.name.localeCompare(b.name, "pt-BR")
            if (av == null) return 1
            if (bv == null) return -1
            return bv - av
          }),
      }))
      .filter((g) => g.players.length > 0)
  }, [players, filter, sort, playerStats])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Elenco"
        subtitle={rosterSubtitle}
        actions={
          <PlayerFormDialog
            trigger={
              <Button>
                <UserPlus /> Novo jogador
              </Button>
            }
          />
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          value={filter}
          onValueChange={(v) => v && setFilter(v as Filter)}
          className="flex-wrap"
        >
          <ToggleGroupItem value="todos">Todos</ToggleGroupItem>
          {POSITIONS.map((p) => (
            <ToggleGroupItem key={p.key} value={p.key} className="gap-1.5">
              <span className="size-2 shrink-0 rounded-[3px]" style={{ background: p.color }} />
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Ordenar por</span>
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {players.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum jogador no elenco"
          description="Adicione jogadores para começar a registrar estatísticas."
          action={
            <PlayerFormDialog
              trigger={
                <Button>
                  <UserPlus /> Novo jogador
                </Button>
              }
            />
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum jogador nessa posição"
          description="Ajuste o filtro ou adicione um jogador para essa posição."
        />
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.meta.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: g.meta.color }} />
                <h2 className="text-sm font-semibold">{g.meta.plural}</h2>
                <span className="num text-xs text-muted-foreground">{g.players.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.players.map((p) => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    players={players}
                    matches={matches}
                    onRemove={removePlayer}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function PlayerCard({
  player,
  players,
  matches,
  onRemove,
}: {
  player: Player
  players: Player[]
  matches: Match[]
  onRemove: (id: string) => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const pm = playerMatches(matches, player.id)
  const k = kpis(playerTotals(pm, player.id))
  const headline = headlineMetric(player.position, k)
  const partic = participacao(matches, player.id)

  const otherCards = personCards(players, player).filter((c) => c.id !== player.id)
  const otherPositionLabels = otherCards.map((c) => positionMeta(c.position).abbr).join(", ")

  const ataque = k.ataquePontos
  const aces = k.saqueAces
  const blocks = k.blocks
  const contribTotal = ataque + aces + blocks

  return (
    <>
      <Link
        to={`/jogador/${player.id}`}
        className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-border/90"
      >
        <div className="flex items-center gap-2.5">
          <PlayerAvatar player={player} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 truncate text-sm font-semibold">
              {player.name}
              {player.number != null ? (
                <span className="num font-normal text-muted-foreground">#{player.number}</span>
              ) : null}
              {otherCards.length > 0 ? (
                <span
                  className="truncate text-xs font-normal text-muted-foreground"
                  title={`Também joga como ${otherCards.map((c) => positionMeta(c.position).label).join(", ")}`}
                >
                  também {otherPositionLabels}
                </span>
              ) : null}
            </div>
          </div>
          <PositionBadge position={player.position} />
          <div
            className="shrink-0"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <PersonStanding /> Adicionar posição
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                  <Trash2 /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <MiniStat label="Jogos" value={pm.length} />
          <MiniStat label="Pontos" value={k.pontos} />
          <MiniStat label="Em quadra" value={partic != null ? fmtPct(partic) : "—"} />
          <MiniStat label={headline.label} value={headline.value} />
        </div>

        {partic != null && (
          <div className="space-y-1">
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${partic * 100}%`, background: positionMeta(player.position).color }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">{`${k.pontosJogados} pontos disputados`}</p>
          </div>
        )}

        <div className="space-y-1.5">
          {contribTotal > 0 ? (
            <>
              <div className="flex h-1.5 gap-[2px] overflow-hidden rounded-full bg-card">
                {ataque > 0 && (
                  <div
                    style={{ width: `${(ataque / contribTotal) * 100}%`, background: seriesColor(0) }}
                  />
                )}
                {aces > 0 && (
                  <div
                    style={{ width: `${(aces / contribTotal) * 100}%`, background: seriesColor(1) }}
                  />
                )}
                {blocks > 0 && (
                  <div
                    style={{ width: `${(blocks / contribTotal) * 100}%`, background: seriesColor(2) }}
                  />
                )}
              </div>
              <Legend
                items={[
                  { label: "Ataque", color: seriesColor(0) },
                  { label: "Aces", color: seriesColor(1) },
                  { label: "Bloqueios", color: seriesColor(2) },
                ]}
              />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Sem dados</p>
          )}
        </div>
      </Link>

      <PlayerFormDialog player={player} open={editOpen} onOpenChange={setEditOpen} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir jogador</DialogTitle>
            <DialogDescription>
              {otherCards.length > 0
                ? `Remover só esta ficha (${positionMeta(player.position).label}) de ${player.name}? As estatísticas dela nas partidas registradas também serão apagadas. A pessoa continua no elenco nas outras posições.`
                : `Remover ${player.name} do elenco? As estatísticas dele nas partidas registradas também serão apagadas.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onRemove(player.id)
                toast.success(`${player.name} removido do elenco`)
                setDeleteOpen(false)
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
      <div className="num text-sm font-semibold tabular-nums">{value}</div>
      <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground" title={label}>
        {label}
      </div>
    </div>
  )
}
