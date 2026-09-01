import { Fragment, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Scale, Users } from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { EmptyState, PageHeader, ResultBadge, StatTile } from "@/components/kit"
import {
  ChartCard,
  axisProps,
  gridProps,
  makeTooltip,
  seriesColor,
} from "@/components/charts/chart-kit"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  addTotals,
  attackOutcome,
  errorBreakdown,
  fmtNum,
  fmtPct,
  fmtSigned,
  hasRallyData,
  isWin,
  kpis,
  matchRallies,
  participacao,
  personCards,
  personTotals,
  playerMatches,
  playerTotals,
  setsLost,
  setsWon,
  t,
  totalRallies,
  type Kpis,
  type Totals,
} from "@/lib/analytics"
import { POSITION_STATS, STAT_GROUP_LABEL, STATS, positionMeta } from "@/lib/stats"
import type { Match, Player, Position, StatGroup } from "@/lib/types"
import { useMatches, usePlayer, usePlayers } from "@/store/useTeamStore"

function headlineMetric(position: Position | "all", k: Kpis) {
  if (position === "levantador") return { label: "Levantamentos", value: String(k.levantamentos) }
  if (position === "libero") return { label: "Nota de passe", value: fmtNum(k.passeNota, 0) }
  return { label: "Ataque %", value: fmtPct(k.ataqueEficiencia, 0) }
}

function fmtDate(iso: string) {
  const [, m, d] = iso.split("-")
  return `${d}/${m}`
}

function MiniFigure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="num text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}

/** Todas as partidas em que QUALQUER uma das fichas de uma pessoa disputou. */
function unionPlayerMatches(matches: Match[], ids: string[]): Match[] {
  return matches.filter((m) =>
    ids.some((id) => m.lineup.includes(id) || Object.keys(m.stats[id] ?? {}).length > 0),
  )
}

/** Estatísticas de uma partida somando uma ou mais fichas (mesma pessoa em posições diferentes). */
function combinedStats(m: Match, ids: string[]): Totals {
  if (ids.length <= 1) return m.stats[ids[0]] ?? {}
  return ids.reduce<Totals>((acc, id) => addTotals(acc, m.stats[id] ?? {}), {})
}

type AxisKey = "ataque" | "saque" | "passe" | "defesa" | "bloqueio" | "cobertura"

const AXES: { key: AxisKey; label: string }[] = [
  { key: "ataque", label: "Ataque" },
  { key: "saque", label: "Saque" },
  { key: "passe", label: "Passe" },
  { key: "defesa", label: "Defesa" },
  { key: "bloqueio", label: "Bloqueio" },
  { key: "cobertura", label: "Cobertura" },
]

function axisAveragesFromTotals(totals: Totals, matchCount: number): Record<AxisKey, number> {
  const k = kpis(totals)
  const n = matchCount || 1
  return {
    ataque: k.ataquePontos / n,
    saque: k.saqueAces / n,
    passe: k.passeCertos / n,
    defesa: k.defesas / n,
    bloqueio: k.blocks / n,
    cobertura: k.coberturas / n,
  }
}

function axisAverages(player: Player, allMatches: Match[]): Record<AxisKey, number> {
  const pm = playerMatches(allMatches, player.id)
  return axisAveragesFromTotals(playerTotals(pm, player.id), pm.length)
}

const GROUP_ORDER: StatGroup[] = ["levantamento", "ataque", "saque", "passe", "defesa", "bloqueio"]

export default function PlayerDetail() {
  const { playerId } = useParams()
  const player = usePlayer(playerId)
  const allPlayers = usePlayers()
  const allMatches = useMatches()

  // Fichas da mesma pessoa (uma por posição em que atuou). Uma pessoa com ficha única
  // devolve um array de 1 e o resto do componente se comporta exatamente como antes.
  const cards = useMemo(() => (player ? personCards(allPlayers, player) : []), [allPlayers, player])

  const [selection, setSelection] = useState<string>(playerId ?? "all")
  useEffect(() => {
    setSelection(playerId ?? "all")
  }, [playerId])

  const isAll = selection === "all"
  const activeCardObj = useMemo(
    () => (player ? (cards.find((c) => c.id === selection) ?? player) : null),
    [cards, selection, player],
  )
  const activeIds = useMemo(
    () => (isAll ? cards.map((c) => c.id) : activeCardObj ? [activeCardObj.id] : []),
    [isAll, cards, activeCardObj],
  )

  const matches = useMemo(
    () =>
      isAll
        ? unionPlayerMatches(allMatches, activeIds)
        : activeCardObj
          ? playerMatches(allMatches, activeCardObj.id)
          : [],
    [isAll, allMatches, activeIds, activeCardObj],
  )
  const chronological = useMemo(
    () => [...matches].sort((a, b) => a.date.localeCompare(b.date)),
    [matches],
  )

  if (!player) {
    return (
      <EmptyState
        icon={Users}
        title="Jogador não encontrado"
        description="Esse jogador pode ter sido removido do elenco."
        action={
          <Button asChild>
            <Link to="/elenco">
              <ArrowLeft /> Voltar para o elenco
            </Link>
          </Button>
        }
      />
    )
  }

  const card = activeCardObj ?? player
  const activePosition: Position | "all" = isAll ? "all" : card.position

  const totals = isAll ? personTotals(matches, cards) : playerTotals(matches, card.id)
  const k = kpis(totals)
  const headline = headlineMetric(activePosition, k)
  const rally = hasRallyData(totals)
  const partic = isAll
    ? rally && totalRallies(matches) > 0
      ? Math.min(k.pontosJogados / totalRallies(matches), 1)
      : null
    : participacao(matches, card.id)

  // --- Evolução: pontos e erros por partida ---
  const pointsSeries = chronological.map((m) => {
    const mk = kpis(combinedStats(m, activeIds))
    return {
      date: fmtDate(m.date),
      opponent: m.opponent,
      placar: `${setsWon(m)}-${setsLost(m)}`,
      pontos: mk.pontos,
      erros: mk.erros,
    }
  })

  // --- Evolução: métrica de eficiência específica da posição ---
  const isLevantador = activePosition === "levantador"
  const isLibero = activePosition === "libero"
  const efficiencyLabel = isLevantador
    ? "Levantamentos por partida"
    : isLibero
      ? "Nota de passe por partida"
      : "Eficiência de ataque por partida"
  const efficiencySeries = chronological.map((m) => {
    const mk = kpis(combinedStats(m, activeIds))
    const value = isLevantador ? mk.levantamentos : isLibero ? mk.passeNota : mk.ataqueEficiencia * 100
    return { date: fmtDate(m.date), opponent: m.opponent, value }
  })
  const efficiencyAvg =
    efficiencySeries.length > 0
      ? efficiencySeries.reduce((s, r) => s + r.value, 0) / efficiencySeries.length
      : 0
  const fmtEfficiency = (v: number) => (isLevantador ? fmtNum(v, 0) : `${fmtNum(v, 0)}%`)

  // --- Evolução: participação por partida ---
  const participationSeries = chronological.map((m) => {
    const rallies = matchRallies(m)
    const jogados = kpis(combinedStats(m, activeIds)).pontosJogados
    const pct = rallies > 0 ? Math.min((jogados / rallies) * 100, 100) : 0
    return { date: fmtDate(m.date), opponent: m.opponent, jogados, rallies, pct }
  })
  const hasParticipationSeries = participationSeries.some((r) => r.jogados > 0)

  // --- Fundamentos: radar normalizado contra o time ---
  const myAvg = axisAveragesFromTotals(totals, matches.length)
  const teamMax = AXES.reduce((acc, ax) => {
    acc[ax.key] = Math.max(0, ...allPlayers.map((p) => axisAverages(p, allMatches)[ax.key]))
    return acc
  }, {} as Record<AxisKey, number>)
  const radarData = AXES.map((ax) => ({
    subject: ax.label,
    raw: myAvg[ax.key],
    value: teamMax[ax.key] > 0 ? Math.round((myAvg[ax.key] / teamMax[ax.key]) * 100) : 0,
  }))

  // --- Fundamentos: ações registradas, agrupadas ---
  const statKeys = isAll
    ? Array.from(new Set(cards.flatMap((c) => POSITION_STATS[c.position])))
    : POSITION_STATS[card.position]
  const maxTotal = Math.max(1, ...statKeys.map((key) => t(totals, key)))
  const rowsByGroup = GROUP_ORDER.map((group) => ({
    group,
    keys: statKeys.filter((key) => STATS[key].group === group),
  })).filter((g) => g.keys.length > 0)

  const relevantKeys = statKeys.slice(0, 3)

  const subtitle = isAll
    ? `${Array.from(new Set(cards.map((c) => positionMeta(c.position).label))).join(" · ")} · ${matches.length} partidas`
    : `${positionMeta(card.position).label}` +
      (card.number != null ? ` · #${card.number}` : "") +
      ` · ${matches.length} partidas`

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <PlayerAvatar player={card} size="lg" />
            <span>{player.name}</span>
          </div>
        }
        subtitle={subtitle}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/elenco">
                <ArrowLeft /> Elenco
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/comparar?a=${player.id}`}>
                <Scale /> Comparar
              </Link>
            </Button>
          </>
        }
      />

      {cards.length > 1 && (
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={selection}
          onValueChange={(v) => v && setSelection(v)}
          className="flex-wrap"
        >
          {cards.map((c) => (
            <ToggleGroupItem key={c.id} value={c.id}>
              {positionMeta(c.position).label}
            </ToggleGroupItem>
          ))}
          <ToggleGroupItem value="all">Tudo junto</ToggleGroupItem>
        </ToggleGroup>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Pontos conquistados" value={k.pontos} accent={seriesColor(0)}
          hint="ataque + saque + bloqueio" />
        <StatTile label="Erros" value={k.erros} accent={seriesColor(1)} />
        <StatTile label="Saldo" value={fmtSigned(k.saldo)} accent={seriesColor(2)} />
        <StatTile label={headline.label} value={headline.value} accent={seriesColor(3)} />
        <StatTile
          label="Em quadra"
          value={rally ? fmtPct(partic ?? 0) : "—"}
          hint={rally ? `${k.pontosJogados} de ${totalRallies(matches)} pontos disputados` : "sem lançamento de participação"}
          accent={seriesColor(4)}
        />
      </div>

      <Tabs defaultValue="evolucao">
        <TabsList>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
          <TabsTrigger value="fundamentos">Fundamentos</TabsTrigger>
          <TabsTrigger value="partidas">Partidas</TabsTrigger>
        </TabsList>

        <TabsContent value="evolucao" className="space-y-6">
          <ChartCard
            title="Pontos e erros por partida"
            subtitle="Pontos conquistados = ataque + saque + bloqueio"
            legend={
              <Legend
                items={[
                  { label: "Pontos conquistados", color: seriesColor(0) },
                  { label: "Erros", color: seriesColor(1) },
                ]}
              />
            }
          >
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={pointsSeries}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip
                  content={makeTooltip((payload, label) => {
                    const row = payload[0]?.payload
                    return {
                      title: `${row?.opponent} · ${label}`,
                      rows: [
                        { label: "Placar", value: row?.placar },
                        { label: "Pontos conquistados", value: row?.pontos, color: seriesColor(0) },
                        { label: "Erros", value: row?.erros, color: seriesColor(1) },
                      ],
                    }
                  })}
                />
                <Bar isAnimationActive={false} dataKey="pontos" fill={seriesColor(0)} radius={[4, 4, 0, 0]} />
                <Line isAnimationActive={false}
                  type="monotone"
                  dataKey="erros"
                  stroke={seriesColor(1)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={efficiencyLabel}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={efficiencySeries}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} tickFormatter={(v) => fmtEfficiency(v)} />
                <Tooltip
                  content={makeTooltip((payload, label) => {
                    const row = payload[0]?.payload
                    return {
                      title: `${row?.opponent} · ${label}`,
                      rows: [{ label: efficiencyLabel, value: fmtEfficiency(row?.value ?? 0) }],
                    }
                  })}
                />
                <ReferenceLine
                  y={efficiencyAvg}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="3 3"
                  label={{
                    value: `Média ${fmtEfficiency(efficiencyAvg)}`,
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                    position: "insideTopRight",
                  }}
                />
                <Line isAnimationActive={false}
                  type="monotone"
                  dataKey="value"
                  stroke={seriesColor(0)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {hasParticipationSeries && (
            <ChartCard title="Participação por partida">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={participationSeries}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" {...axisProps} />
                  <YAxis {...axisProps} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    content={makeTooltip((payload, label) => {
                      const row = payload[0]?.payload
                      return {
                        title: `${row?.opponent} · ${label}`,
                        rows: [
                          { label: "Pontos disputados", value: row?.jogados },
                          { label: "Total da partida", value: row?.rallies },
                          { label: "Participação", value: `${fmtNum(row?.pct ?? 0, 0)}%`, color: seriesColor(0) },
                        ],
                      }
                    })}
                  />
                  <Bar isAnimationActive={false} dataKey="pct" fill={seriesColor(0)} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <PointsCompositionCard totals={totals} />
            <ErrorBreakdownChart totals={totals} />
          </div>

          <RunningBalanceCard matches={chronological} ids={activeIds} />
        </TabsContent>

        <TabsContent value="fundamentos" className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Por 25 pontos disputados</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniFigure label="Pontos/25" value={rally ? fmtNum(k.pontosPor25, 1) : "—"} />
              <MiniFigure label="Erros/25" value={rally ? fmtNum(k.errosPor25, 1) : "—"} />
              <MiniFigure label="Defesas/25" value={rally ? fmtNum(k.defesasPor25, 1) : "—"} />
              <MiniFigure label="Blocks/25" value={rally ? fmtNum(k.blocksPor25, 1) : "—"} />
            </div>
          </div>

          <AttackOutcomeCard totals={totals} />

          <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Fundamentos"
            subtitle="Índice 0-100: 100 = o melhor do time naquele fundamento. Não é contagem."
          >
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Tooltip
                  content={makeTooltip((payload) => {
                    const row = payload[0]?.payload
                    return {
                      title: row?.subject,
                      rows: [
                        { label: "Ações/partida", value: fmtNum(row?.raw ?? 0, 1) },
                        { label: "Índice", value: `${row?.value ?? 0}/100`, color: seriesColor(0) },
                      ],
                    }
                  })}
                />
                <Radar isAnimationActive={false}
                  dataKey="value"
                  stroke={seriesColor(0)}
                  fill={seriesColor(0)}
                  fillOpacity={0.22}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Ações registradas">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ação</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Média/partida</TableHead>
                  <TableHead className="w-28">Distribuição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsByGroup.map((g) => (
                  <Fragment key={g.group}>
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={4}
                        className="bg-muted/40 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {STAT_GROUP_LABEL[g.group]}
                      </TableCell>
                    </TableRow>
                    {g.keys.map((key) => {
                      const total = t(totals, key)
                      const avg = matches.length > 0 ? total / matches.length : 0
                      const width = (total / maxTotal) * 100
                      return (
                        <TableRow key={key}>
                          <TableCell>{STATS[key].label}</TableCell>
                          <TableCell className="num text-right">{total}</TableCell>
                          <TableCell className="num text-right">{fmtNum(avg, 1)}</TableCell>
                          <TableCell>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-foreground/60"
                                style={{ width: `${width}%` }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="partidas">
          <MatchesTable ids={activeIds} matches={matches} relevantKeys={relevantKeys} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Legenda simples (bolinha + rótulo), para os gráficos que só precisam disso. */
function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: it.color }} />
          {it.label}
        </li>
      ))}
    </ul>
  )
}

const ATTACK_OUTCOME_SHORT: Record<string, string> = {
  ponto: "ponto",
  largada: "largada",
  defendido: "defendidos",
  bloqueado: "bloqueado",
  erro: "erro",
}

/** "Cadê os ataques que só passaram?" — o desfecho de cada bola atacada, com a identidade explícita. */
function AttackOutcomeCard({ totals }: { totals: Totals }) {
  const { rows, total } = attackOutcome(totals)
  if (total === 0) return null

  const colors = [seriesColor(0), seriesColor(1), "var(--muted-foreground)", seriesColor(4), "var(--destructive)"]
  const identity = rows.map((r) => `${r.value} ${ATTACK_OUTCOME_SHORT[r.key] ?? r.label}`).join(" + ")

  return (
    <ChartCard title="Desfecho dos ataques" subtitle="O que aconteceu com cada bola atacada">
      <div className="space-y-3 pt-2">
        <div className="flex h-9 w-full overflow-hidden rounded-lg">
          {rows.map((r, i) =>
            r.value === 0 ? null : (
              <div
                key={r.key}
                className="flex items-center justify-center border-r-2 border-card text-[11px] font-semibold text-white last:border-r-0"
                style={{ width: `${r.share * 100}%`, background: colors[i] }}
                title={`${r.label}: ${r.value}`}
              >
                {r.share > 0.09 ? fmtPct(r.share) : ""}
              </div>
            ),
          )}
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {rows.map((r, i) => (
            <li key={r.key} className="rounded-lg border px-2.5 py-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: colors[i] }} />
                {r.label}
              </div>
              <div className="num mt-0.5 text-lg font-semibold tabular-nums">{r.value}</div>
              <div className="text-[11px] text-muted-foreground">{fmtPct(r.share)}</div>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted-foreground">
          <span className="num">{identity}</span> = <span className="num">{total}</span> ataques ·
          «adversário defendeu» não é ponto nem erro, o rally continuou.
        </p>
      </div>
    </ChartCard>
  )
}

/** Donut com a origem dos pontos conquistados pelo jogador. */
function PointsCompositionCard({ totals }: { totals: Totals }) {
  const k = kpis(totals)
  const rows = [
    { key: "ataque", label: "Ataque", value: t(totals, "ataque_certo"), color: seriesColor(0) },
    { key: "largada", label: "Largada", value: t(totals, "largada"), color: seriesColor(1) },
    { key: "saque", label: "Saque", value: k.saqueAces, color: seriesColor(2) },
    { key: "bloqueio", label: "Bloqueio", value: k.blocks, color: seriesColor(3) },
  ]
  const total = k.pontos

  return (
    <ChartCard title="Composição dos pontos" subtitle="De onde vieram os pontos conquistados pelo jogador">
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum ponto lançado ainda.</p>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Tooltip
                  content={makeTooltip((payload) => {
                    const row = payload[0]?.payload as (typeof rows)[number] | undefined
                    if (!row) return { rows: [] }
                    return {
                      title: row.label,
                      rows: [
                        { label: "Pontos", value: row.value, color: row.color },
                        { label: "% do total", value: total > 0 ? fmtPct(row.value / total) : "—" },
                      ],
                    }
                  })}
                />
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={62}
                  outerRadius={95}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {rows.map((r) => (
                    <Cell key={r.key} fill={r.color} stroke="var(--card)" strokeWidth={2} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="num text-2xl font-semibold tabular-nums">{total}</span>
              <span className="text-[11px] text-muted-foreground">pontos</span>
            </div>
          </div>
          <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center gap-1.5">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} />
                {r.label}
                <span className="num font-medium text-foreground">{r.value}</span>
                <span>({total > 0 ? fmtPct(r.value / total) : "—"})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  )
}

/** Erros cometidos pelo jogador, por fundamento. */
function ErrorBreakdownChart({ totals }: { totals: Totals }) {
  const { rows, total } = errorBreakdown(totals)
  return (
    <ChartCard title="Erros por fundamento" subtitle="Cada erro é um ponto entregue ao adversário">
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum erro lançado ainda.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid {...gridProps} vertical horizontal={false} />
            <XAxis type="number" {...axisProps} allowDecimals={false} />
            <YAxis type="category" dataKey="label" width={70} {...axisProps} />
            <Tooltip
              content={makeTooltip((payload) => {
                const row = payload[0]?.payload
                return {
                  title: row?.label,
                  rows: [
                    { label: "Erros", value: row?.value, color: "var(--destructive)" },
                    { label: "Do total de erros", value: total > 0 ? fmtPct((row?.value ?? 0) / total) : "—" },
                  ],
                }
              })}
            />
            <Bar isAnimationActive={false} dataKey="value" fill="var(--destructive)" radius={[0, 4, 4, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}

interface BalanceRow {
  date: string
  opponent: string
  saldo: number
  running: number
}

/** Soma corrida de (pontos - erros) partida a partida — mostra se o jogador está subindo na temporada. */
function RunningBalanceCard({ matches, ids }: { matches: Match[]; ids: string[] }) {
  let running = 0
  const rows: BalanceRow[] = matches.map((m) => {
    const mk = kpis(combinedStats(m, ids))
    const saldo = mk.pontos - mk.erros
    running += saldo
    return { date: fmtDate(m.date), opponent: m.opponent, saldo, running }
  })

  return (
    <ChartCard title="Saldo acumulado" subtitle="Soma corrida de pontos menos erros ao longo da temporada">
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Sem partidas registradas.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={rows}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" {...axisProps} />
            <YAxis {...axisProps} allowDecimals={false} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Tooltip
              content={makeTooltip((payload, label) => {
                const row = payload[0]?.payload as BalanceRow | undefined
                if (!row) return { rows: [] }
                return {
                  title: `${row.opponent} · ${label}`,
                  rows: [
                    { label: "Saldo da partida", value: fmtSigned(row.saldo) },
                    { label: "Saldo acumulado", value: fmtSigned(row.running), color: seriesColor(0) },
                  ],
                }
              })}
            />
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="running"
              stroke={seriesColor(0)}
              strokeWidth={2}
              fill={seriesColor(0)}
              fillOpacity={0.15}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}

function MatchesTable({
  ids,
  matches,
  relevantKeys,
}: {
  ids: string[]
  matches: Match[]
  relevantKeys: string[]
}) {
  const navigate = useNavigate()

  if (matches.length === 0) {
    return (
      <EmptyState title="Sem partidas registradas" description="Esse jogador ainda não participou de nenhuma partida." />
    )
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Adversário</TableHead>
            <TableHead>Resultado</TableHead>
            <TableHead className="text-right">Em quadra</TableHead>
            <TableHead className="text-right">Pontos</TableHead>
            <TableHead className="text-right">Erros</TableHead>
            {relevantKeys.map((key) => (
              <TableHead key={key} className="text-right">
                {STATS[key].short}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.map((m) => {
            const row = combinedStats(m, ids)
            const mk = kpis(row)
            const rallies = matchRallies(m)
            const matchPartic = mk.pontosJogados > 0 && rallies > 0 ? mk.pontosJogados / rallies : null
            return (
              <TableRow
                key={m.id}
                className="cursor-pointer"
                onClick={() => navigate(`/partidas/${m.id}`)}
              >
                <TableCell className="num">{fmtDate(m.date)}</TableCell>
                <TableCell>{m.opponent}</TableCell>
                <TableCell>
                  <ResultBadge win={isWin(m)} />
                </TableCell>
                <TableCell className="num text-right">
                  {matchPartic != null ? fmtPct(matchPartic) : "—"}
                </TableCell>
                <TableCell className="num text-right">{mk.pontos}</TableCell>
                <TableCell className="num text-right">{mk.erros}</TableCell>
                {relevantKeys.map((key) => (
                  <TableCell key={key} className="num text-right">
                    {t(row, key)}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
