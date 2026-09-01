import { Fragment, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import { Download, FileJson, RotateCcw, Trash2, Upload } from "lucide-react"

import { PageHeader, PositionBadge, StatTile } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

import { cn } from "@/lib/utils"
import { POSITIONS, POSITION_STATS, RALLY_STAT, STATS, STAT_GROUP_LABEL, positionMeta, statLabel } from "@/lib/stats"
import type { Match, Player, Position } from "@/lib/types"
import {
  fmtNum,
  fmtPct,
  fmtSigned,
  geral,
  kpis,
  participacao,
  playerMatches,
  playerTotals,
  t,
  totalRallies,
} from "@/lib/analytics"
import type { GeralBlock } from "@/lib/analytics"
import { useMatches, usePlayers, useTeamStore } from "@/store/useTeamStore"
import { download, exportJson, exportSeasonCsv, parseImportedJson } from "@/lib/exporters"

const GERAL_FIELDS: { key: keyof GeralBlock; label: string }[] = [
  { key: "ataquesPonta", label: "Ataques Ponta" },
  { key: "ataquesOposto", label: "Ataques Oposto" },
  { key: "ataquesCentral", label: "Ataques Central" },
  { key: "ataquesPipe", label: "Ataques Pipe" },
  { key: "ataquesGerais", label: "Ataques Gerais" },
  { key: "ataquesCertos", label: "Ataques Certos" },
  { key: "ataquesErrados", label: "Ataques Errados" },
  { key: "largadas", label: "Largadas" },
  { key: "defesasCertas", label: "Defesas Certas" },
  { key: "saquesCertos", label: "Saques Certos" },
  { key: "saquesErrados", label: "Saques Errados" },
  { key: "passesCertos", label: "Passes Certos" },
  { key: "passesErrados", label: "Passes Errados" },
  { key: "blocksDados", label: "Blocks Dados" },
  { key: "blocksTomados", label: "Blocks Tomados" },
  { key: "errosCometidos", label: "Erros Cometidos" },
]

/** Group a position's stat keys into consecutive runs sharing the same STAT_GROUP_LABEL. */
function statGroups(pos: Position): { group: string; keys: string[] }[] {
  const out: { group: string; keys: string[] }[] = []
  for (const key of POSITION_STATS[pos]) {
    const group = STATS[key].group
    const last = out[out.length - 1]
    if (last && last.group === group) last.keys.push(key)
    else out.push({ group, keys: [key] })
  }
  return out
}

function tintStyle(value: number, rowMax: number, negative: boolean): React.CSSProperties | undefined {
  if (value <= 0 || rowMax <= 0) return undefined
  const intensity = Math.round((value / rowMax) * 18)
  const varName = negative ? "--destructive" : "--primary"
  return { background: `color-mix(in oklab, var(${varName}) ${intensity}%, transparent)` }
}

function PositionTable({ pos, players, matches }: { pos: Position; players: Player[]; matches: Match[] }) {
  const posPlayers = players.filter((p) => p.position === pos)
  if (posPlayers.length === 0) return null

  const meta = positionMeta(pos)
  const groups = statGroups(pos)
  const totalsByPlayer = new Map(posPlayers.map((p) => [p.id, playerTotals(matches, p.id)]))
  const pontosByPlayer = new Map(posPlayers.map((p) => [p.id, kpis(totalsByPlayer.get(p.id)!).pontos]))
  const totalPontos = posPlayers.reduce((s, p) => s + (pontosByPlayer.get(p.id) ?? 0), 0)
  const rallyValues = posPlayers.map((p) => t(totalsByPlayer.get(p.id), RALLY_STAT))
  const rallyRowMax = Math.max(0, ...rallyValues)
  const scopedRallies = totalRallies(matches)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: meta.color }} />
        <h3 className="text-sm font-semibold">{meta.plural}</h3>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-card">Estatística</TableHead>
              {posPlayers.map((p) => (
                <TableHead key={p.id} className="text-center">
                  {p.name}
                </TableHead>
              ))}
              <TableHead className="text-center">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <Fragment key="participacao">
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={posPlayers.length + 2}
                  className="sticky left-0 bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {STAT_GROUP_LABEL.participacao}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="sticky left-0 z-10 bg-card font-medium">{statLabel(RALLY_STAT)}</TableCell>
                {posPlayers.map((p, i) => {
                  const v = rallyValues[i]
                  return (
                    <TableCell
                      key={p.id}
                      className="num text-center tabular-nums"
                      style={tintStyle(v, rallyRowMax, false)}
                    >
                      {v > 0 ? fmtNum(v) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )
                })}
                <TableCell className="num text-center font-medium tabular-nums">
                  {scopedRallies > 0 ? fmtNum(scopedRallies) : <span className="text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="sticky left-0 z-10 bg-card font-medium">Em quadra %</TableCell>
                {posPlayers.map((p) => {
                  const share = participacao(matches, p.id)
                  return (
                    <TableCell key={p.id} className="num text-center tabular-nums">
                      {share !== null ? fmtPct(share) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )
                })}
                <TableCell className="num text-center tabular-nums text-muted-foreground">—</TableCell>
              </TableRow>
            </Fragment>
            {groups.map((g) => (
              <Fragment key={g.group}>
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={posPlayers.length + 2}
                    className="sticky left-0 bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {STAT_GROUP_LABEL[g.group]}
                  </TableCell>
                </TableRow>
                {g.keys.map((key) => {
                  const negative = STATS[key].polarity === "negative"
                  const values = posPlayers.map((p) => t(totalsByPlayer.get(p.id), key))
                  const rowMax = Math.max(0, ...values)
                  const rowTotal = values.reduce((s, v) => s + v, 0)
                  return (
                    <TableRow key={key}>
                      <TableCell className="sticky left-0 z-10 bg-card font-medium">{statLabel(key)}</TableCell>
                      {posPlayers.map((p, i) => {
                        const v = values[i]
                        return (
                          <TableCell
                            key={p.id}
                            className="num text-center tabular-nums"
                            style={tintStyle(v, rowMax, negative)}
                          >
                            {v > 0 ? fmtNum(v) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        )
                      })}
                      <TableCell className="num text-center font-medium tabular-nums">
                        {rowTotal > 0 ? fmtNum(rowTotal) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </Fragment>
            ))}
            <TableRow className="border-t-2 font-semibold">
              <TableCell className="sticky left-0 z-10 bg-card font-medium">Pontos conquistados</TableCell>
              {posPlayers.map((p) => (
                <TableCell key={p.id} className="num text-center tabular-nums">
                  {fmtNum(pontosByPlayer.get(p.id) ?? 0)}
                </TableCell>
              ))}
              <TableCell className="num text-center tabular-nums">{fmtNum(totalPontos)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

interface RankRow {
  player: Player
  partidas: number
  pontosJogados: number
  pontosPor25: number
  pontos: number
  erros: number
  saldo: number
  ataquePct: number
  passeNota: number
  defesas: number
  blocks: number
}

type SortKey =
  | "jogador"
  | "partidas"
  | "pontosJogados"
  | "pontosPor25"
  | "pontos"
  | "erros"
  | "saldo"
  | "ataquePct"
  | "passeNota"
  | "defesas"
  | "blocks"

const RANK_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "jogador", label: "Jogador" },
  { key: "partidas", label: "Partidas" },
  { key: "pontosJogados", label: "Disputados" },
  { key: "pontosPor25", label: "Pts/25" },
  { key: "pontos", label: "Pontos conquistados" },
  { key: "erros", label: "Erros" },
  { key: "saldo", label: "Saldo" },
  { key: "ataquePct", label: "Ataque %" },
  { key: "passeNota", label: "Nota de passe" },
  { key: "defesas", label: "Defesas" },
  { key: "blocks", label: "Blocks" },
]

export default function Report() {
  const players = usePlayers()
  const matches = useMatches()
  const teamName = useTeamStore((s) => s.teamName)
  const importState = useTeamStore((s) => s.importState)
  const loadDemo = useTeamStore((s) => s.loadDemo)
  const resetAll = useTeamStore((s) => s.resetAll)
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [scope, setScope] = useState<string>("todos")
  const [sortKey, setSortKey] = useState<SortKey>("pontos")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const scopedMatches = useMemo(
    () => (scope === "todos" ? matches : matches.filter((m) => m.id === scope)),
    [scope, matches],
  )

  const geralBlock = useMemo(() => geral(scopedMatches, players), [scopedMatches, players])

  const rankRows = useMemo<RankRow[]>(
    () =>
      players.map((p) => {
        const totals = playerTotals(scopedMatches, p.id)
        const k = kpis(totals)
        return {
          player: p,
          partidas: playerMatches(scopedMatches, p.id).length,
          pontosJogados: k.pontosJogados,
          pontosPor25: k.pontosPor25,
          pontos: k.pontos,
          erros: k.erros,
          saldo: k.saldo,
          ataquePct: k.ataqueAproveitamento,
          passeNota: k.passeNota,
          defesas: k.defesas,
          blocks: k.blocks,
        }
      }),
    [players, scopedMatches],
  )

  const sortedRows = useMemo(() => {
    const rows = [...rankRows]
    rows.sort((a, b) => {
      const cmp = sortKey === "jogador" ? a.player.name.localeCompare(b.player.name) : a[sortKey] - b[sortKey]
      return sortDir === "asc" ? cmp : -cmp
    })
    return rows
  }, [rankRows, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    } else {
      setSortKey(key)
      setSortDir(key === "jogador" ? "asc" : "desc")
    }
  }

  function handleExportCsv() {
    const csv = exportSeasonCsv(players, matches)
    download(`relatorio-temporada-${todayIso()}.csv`, csv, "text/csv;charset=utf-8")
    toast.success("CSV exportado.")
  }

  function handleExportJson() {
    const json = exportJson({ teamName, players, matches })
    download(`temporada-${todayIso()}.json`, json, "application/json")
    toast.success("JSON exportado.")
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      const text = await file.text()
      const data = parseImportedJson(text)
      importState(data)
      toast.success("Dados importados com sucesso.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao importar o arquivo.")
    }
  }

  function handleLoadDemo() {
    loadDemo()
    toast.success("Dados de demonstração recarregados.")
  }

  function handleResetAll() {
    resetAll()
    toast.success("Todos os dados foram apagados.")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatório da temporada"
        subtitle="Visão consolidada dos lançamentos — a versão digital da planilha do time."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="size-4" /> Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportJson}>
              <FileJson className="size-4" /> Exportar JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" /> Importar JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportFile}
            />
          </>
        }
      />

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Período</span>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger size="sm" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Toda a temporada</SelectItem>
            {matches.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {format(parseISO(m.date), "dd MMM", { locale: ptBR })} — {m.opponent}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Geral</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {GERAL_FIELDS.map((f) => (
            <StatTile key={f.key} label={f.label} value={fmtNum(geralBlock[f.key])} />
          ))}
          <StatTile label="Pontos Disputados" value={fmtNum(totalRallies(scopedMatches))} />
        </div>
        <p className="text-xs text-muted-foreground">
          Todos os números são calculados a partir dos lançamentos individuais.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-sm font-semibold">Individuais</h2>
        {POSITIONS.map((pos) => (
          <PositionTable key={pos.key} pos={pos.key} players={players} matches={scopedMatches} />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Ranking geral</h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {RANK_COLUMNS.map((c) => (
                  <TableHead
                    key={c.key}
                    className={cn("cursor-pointer select-none", c.key !== "jogador" && "text-center")}
                    onClick={() => toggleSort(c.key)}
                  >
                    {c.label}
                    {sortKey === c.key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((r) => (
                <TableRow
                  key={r.player.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/jogador/${r.player.id}`)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {r.player.name}
                      <PositionBadge position={r.player.position} />
                    </div>
                  </TableCell>
                  <TableCell className="num text-center tabular-nums">{r.partidas}</TableCell>
                  <TableCell className="num text-center tabular-nums">{fmtNum(r.pontosJogados)}</TableCell>
                  <TableCell className="num text-center tabular-nums">
                    {r.pontosJogados > 0 ? fmtNum(r.pontosPor25, 1) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="num text-center font-medium tabular-nums">{fmtNum(r.pontos)}</TableCell>
                  <TableCell className="num text-center tabular-nums">{fmtNum(r.erros)}</TableCell>
                  <TableCell
                    className={cn(
                      "num text-center tabular-nums",
                      r.saldo > 0 ? "text-[var(--success)]" : r.saldo < 0 ? "text-destructive" : undefined,
                    )}
                  >
                    {fmtSigned(r.saldo)}
                  </TableCell>
                  <TableCell className="num text-center tabular-nums">{fmtPct(r.ataquePct, 1)}</TableCell>
                  <TableCell className="num text-center tabular-nums">{fmtNum(r.passeNota)}</TableCell>
                  <TableCell className="num text-center tabular-nums">{fmtNum(r.defesas)}</TableCell>
                  <TableCell className="num text-center tabular-nums">{fmtNum(r.blocks)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-destructive/30 bg-card p-4">
        <div>
          <h3 className="text-sm font-semibold text-destructive">Zona de dados</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Os dados desta temporada ficam salvos apenas neste navegador (localStorage) — não há sincronização com
            nenhum servidor.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleLoadDemo}>
            <RotateCcw className="size-4" /> Recarregar dados de demonstração
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="size-4" /> Apagar tudo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Apagar todos os dados?</DialogTitle>
                <DialogDescription>
                  Isso remove permanentemente todos os jogadores e partidas salvos neste navegador. Essa ação não
                  pode ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive" onClick={handleResetAll}>
                    Apagar tudo
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>
    </div>
  )
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}
