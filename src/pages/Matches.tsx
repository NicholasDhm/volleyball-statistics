import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { format, parseISO } from "date-fns"
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { EmptyState, PageHeader, ResultBadge, StatTile } from "@/components/kit"
import { MatchFormDialog } from "@/components/MatchFormDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { fmtPct, isWin, kpis, matchRallies, matchTotals, record, setsLost, setsWon } from "@/lib/analytics"
import type { Match } from "@/lib/types"
import { useMatches, useTeamStore } from "@/store/useTeamStore"

type ResultFilter = "todas" | "vitorias" | "derrotas"
type SortKey = "date" | "disputados" | "pontos" | "ataque"

export default function Matches() {
  const matches = useMatches()
  const removeMatch = useTeamStore((s) => s.removeMatch)
  const navigate = useNavigate()

  const [search, setSearch] = useState("")
  const [competitionFilter, setCompetitionFilter] = useState("todas")
  const [resultFilter, setResultFilter] = useState<ResultFilter>("todas")
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const competitions = useMemo(
    () => Array.from(new Set(matches.map((m) => m.competition).filter((c): c is string => !!c))).sort(),
    [matches],
  )

  const rows = useMemo(
    () =>
      matches.map((m) => {
        const k = kpis(matchTotals(m))
        return { match: m, win: isWin(m), won: setsWon(m), lost: setsLost(m), k, disputados: matchRallies(m) }
      }),
    [matches],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(({ match: m, win }) => {
      if (q && !m.opponent.toLowerCase().includes(q)) return false
      if (competitionFilter !== "todas" && m.competition !== competitionFilter) return false
      if (resultFilter === "vitorias" && !win) return false
      if (resultFilter === "derrotas" && win) return false
      return true
    })
  }, [rows, search, competitionFilter, resultFilter])

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortKey === "date") return a.match.date.localeCompare(b.match.date) * dir
      if (sortKey === "disputados") return (a.disputados - b.disputados) * dir
      if (sortKey === "pontos") return (a.k.pontos - b.k.pontos) * dir
      return (a.k.ataqueEficiencia - b.k.ataqueEficiencia) * dir
    })
  }, [filtered, sortKey, sortDir])

  const rec = record(matches)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  function SortHead({ label, sortKey: key }: { label: string; sortKey: SortKey }) {
    const active = sortKey === key
    return (
      <TableHead>
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className="inline-flex items-center gap-1 text-inherit hover:text-foreground"
        >
          {label}
          {active ? (
            sortDir === "asc" ? (
              <ArrowUp className="size-3" />
            ) : (
              <ArrowDown className="size-3" />
            )
          ) : null}
        </button>
      </TableHead>
    )
  }

  function handleDelete(m: Match) {
    removeMatch(m.id)
    toast.success("Partida excluída")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partidas"
        subtitle={`${rec.jogos} partidas · ${rec.vitorias}V—${rec.derrotas}D`}
        actions={
          <MatchFormDialog
            trigger={
              <Button>
                <Plus /> Nova partida
              </Button>
            }
            onSaved={(id) => navigate(`/partidas/${id}`)}
          />
        }
      />

      {matches.length === 0 ? (
        <EmptyState
          title="Nenhuma partida cadastrada"
          description="Registre a primeira partida da temporada para começar a acompanhar as estatísticas do time."
          action={
            <MatchFormDialog
              trigger={
                <Button>
                  <Plus /> Nova partida
                </Button>
              }
              onSaved={(id) => navigate(`/partidas/${id}`)}
            />
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Partidas" value={rec.jogos} />
            <StatTile label="Vitórias" value={rec.vitorias} />
            <StatTile label="Sets a favor" value={rec.setsPro} />
            <StatTile label="Sets contra" value={rec.setsContra} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar adversário..."
                className="w-56 pl-8"
              />
            </div>

            <Select value={competitionFilter} onValueChange={setCompetitionFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Competição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas competições</SelectItem>
                {competitions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ToggleGroup
              type="single"
              variant="outline"
              value={resultFilter}
              onValueChange={(v) => v && setResultFilter(v as ResultFilter)}
            >
              <ToggleGroupItem value="todas">Todas</ToggleGroupItem>
              <ToggleGroupItem value="vitorias">Vitórias</ToggleGroupItem>
              <ToggleGroupItem value="derrotas">Derrotas</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead label="Data" sortKey="date" />
                  <TableHead>Resultado</TableHead>
                  <TableHead>Adversário</TableHead>
                  <TableHead>Sets</TableHead>
                  <SortHead label="Disputados" sortKey="disputados" />
                  <SortHead label="Pts conq." sortKey="pontos" />
                  <TableHead>Erros</TableHead>
                  <SortHead label="Ataque %" sortKey="ataque" />
                  <TableHead>Jogadores</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                      Nenhuma partida encontrada com esses filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map(({ match: m, win, won, lost, k, disputados }) => (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/partidas/${m.id}`)}
                    >
                      <TableCell className="num">
                        {format(parseISO(m.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <ResultBadge win={win} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="min-w-0">
                            <div className="font-medium">{m.opponent}</div>
                            {m.competition ? (
                              <div className="truncate text-xs text-muted-foreground">
                                {m.competition}
                              </div>
                            ) : null}
                          </div>
                          {m.location ? (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {m.location === "casa" ? "Casa" : "Fora"}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="num font-medium">
                          {won}—{lost}
                        </div>
                        <div className="num text-xs text-muted-foreground">
                          {m.sets.map((s) => `${s.us}-${s.them}`).join(" · ")}
                        </div>
                      </TableCell>
                      <TableCell className="num">{disputados}</TableCell>
                      <TableCell className="num">{k.pontos}</TableCell>
                      <TableCell className="num">{k.erros}</TableCell>
                      <TableCell className="num">{fmtPct(k.ataqueEficiencia)}</TableCell>
                      <TableCell className="num">{m.lineup.length}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/partidas/${m.id}`)}>
                              <BarChart3 /> Abrir estatísticas
                            </DropdownMenuItem>
                            <MatchFormDialog
                              match={m}
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Pencil /> Editar partida
                                </DropdownMenuItem>
                              }
                            />
                            <DropdownMenuSeparator />
                            <Dialog>
                              <DialogTrigger asChild>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 /> Excluir
                                </DropdownMenuItem>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Excluir partida</DialogTitle>
                                  <DialogDescription>
                                    Tem certeza que deseja excluir a partida contra{" "}
                                    {m.opponent}? Essa ação não pode ser desfeita.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">Cancelar</Button>
                                  </DialogClose>
                                  <DialogClose asChild>
                                    <Button variant="destructive" onClick={() => handleDelete(m)}>
                                      Excluir
                                    </Button>
                                  </DialogClose>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
