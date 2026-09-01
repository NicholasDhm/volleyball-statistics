import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Users } from "lucide-react"
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

import { cn } from "@/lib/utils"
import type { Player, Match } from "@/lib/types"
import { POSITIONS, RALLY_STAT } from "@/lib/stats"
import {
  kpis,
  playerTotals,
  playerMatches,
  playerMatchTotals,
  hasRallyData,
  participacao,
  matchRallies,
  t,
  fmtPct,
  fmtNum,
  type Kpis,
  type Totals,
} from "@/lib/analytics"
import { usePlayers, useMatches } from "@/store/useTeamStore"
import { PageHeader, PositionBadge, EmptyState } from "@/components/kit"
import {
  ChartCard,
  Legend,
  makeTooltip,
  seriesColor,
  axisProps,
  gridProps,
} from "@/components/charts/chart-kit"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type Scope = "total" | "media" | "por25"

interface MetricRow {
  key: string
  label: string
  kind: "fixed" | "count" | "rate" | "info"
  /** Muted suffix appended to the label, e.g. "(total)". */
  suffix?: string
  invert?: boolean
  get: (k: Kpis, ctx: { id: string; matches: Match[] }) => number | null
  format: (n: number, scope: Scope) => string
}

/** Volume normalizado por 25 pontos disputados — mesma fórmula usada em kpis(). */
const per25 = (raw: number, pontosJogados: number) => (pontosJogados > 0 ? (raw / pontosJogados) * 25 : 0)

const METRIC_ROWS: MetricRow[] = [
  { key: "jogos", label: "Partidas", kind: "fixed", get: () => 0, format: (n) => fmtNum(n, 0) },
  { key: "pontosJogados", label: "Pontos disputados", kind: "info", suffix: "(total)", get: (k) => k.pontosJogados, format: (n) => fmtNum(n, 0) },
  { key: "emQuadra", label: "Em quadra", kind: "info", suffix: "(total)", get: (_k, ctx) => participacao(ctx.matches, ctx.id), format: (n) => fmtPct(n) },
  { key: "pontos", label: "Pontos conquistados", kind: "count", get: (k) => k.pontos, format: (n, s) => fmtNum(n, s !== "total" ? 1 : 0) },
  { key: "erros", label: "Erros", kind: "count", invert: true, get: (k) => k.erros, format: (n, s) => fmtNum(n, s !== "total" ? 1 : 0) },
  { key: "saldo", label: "Saldo", kind: "count", get: (k) => k.saldo, format: (n, s) => fmtNum(n, s !== "total" ? 1 : 0) },
  { key: "ataques", label: "Ataques", kind: "count", get: (k) => k.ataqueTentativas, format: (n, s) => fmtNum(n, s !== "total" ? 1 : 0) },
  { key: "ataquePct", label: "Ataque %", kind: "rate", get: (k) => k.ataqueAproveitamento, format: (n) => fmtPct(n) },
  { key: "ataqueEf", label: "Eficiência de ataque", kind: "rate", get: (k) => k.ataqueEficiencia, format: (n) => fmtPct(n) },
  { key: "aces", label: "Aces", kind: "count", get: (k) => k.saqueAces, format: (n, s) => fmtNum(n, s !== "total" ? 1 : 0) },
  { key: "saqueErros", label: "Erros de saque", kind: "count", invert: true, get: (k) => k.saqueErros, format: (n, s) => fmtNum(n, s !== "total" ? 1 : 0) },
  { key: "passeCertos", label: "Passes certos", kind: "count", get: (k) => k.passeCertos, format: (n, s) => fmtNum(n, s !== "total" ? 1 : 0) },
  { key: "passeNota", label: "Nota de passe", kind: "rate", get: (k) => k.passeNota, format: (n) => fmtNum(n, 1) },
  { key: "defesas", label: "Defesas", kind: "count", get: (k) => k.defesas, format: (n, s) => fmtNum(n, s !== "total" ? 1 : 0) },
  { key: "coberturas", label: "Coberturas", kind: "count", get: (k) => k.coberturas, format: (n, s) => fmtNum(n, s !== "total" ? 1 : 0) },
  { key: "blocks", label: "Blocks", kind: "count", get: (k) => k.blocks, format: (n, s) => fmtNum(n, s !== "total" ? 1 : 0) },
]

const RADAR_AXES = [
  { label: "Ataque", get: (k: Kpis) => k.ataquePontos, volumeDriven: true },
  { label: "Saque", get: (k: Kpis) => k.saqueAces, volumeDriven: true },
  { label: "Passe", get: (k: Kpis) => k.passeCertos, volumeDriven: false },
  { label: "Defesa", get: (k: Kpis) => k.defesas, volumeDriven: true },
  { label: "Bloqueio", get: (k: Kpis) => k.blocks, volumeDriven: true },
  { label: "Cobertura", get: (k: Kpis) => k.coberturas, volumeDriven: true },
]

const COUNT_BAR_METRICS = [
  { label: "Pontos conq.", get: (k: Kpis) => k.pontos },
  { label: "Aces", get: (k: Kpis) => k.saqueAces },
  { label: "Defesas", get: (k: Kpis) => k.defesas },
  { label: "Blocks", get: (k: Kpis) => k.blocks },
]

const RATE_BAR_METRICS = [
  { label: "Ataque %", get: (k: Kpis) => k.ataqueAproveitamento },
  { label: "Passe %", get: (k: Kpis) => k.passeAproveitamento },
]

function formatDateShort(iso: string) {
  const [, m, d] = iso.split("-")
  return `${d}/${m}`
}

function valueFor(
  row: MetricRow,
  stat: { k: Kpis; games: number; totals: Totals },
  scope: Scope,
  ctx: { id: string; matches: Match[] },
): number | null {
  if (row.kind === "fixed") return stat.games
  if (row.kind === "info") return row.get(stat.k, ctx)
  const raw = row.get(stat.k, ctx)
  if (raw == null) return null
  if (row.kind === "rate") return raw
  if (scope === "por25") {
    return hasRallyData(stat.totals) ? per25(raw, stat.k.pontosJogados) : null
  }
  return scope === "media" ? (stat.games > 0 ? raw / stat.games : 0) : raw
}

export default function Compare() {
  const players = usePlayers()
  const matches = useMatches()
  const [searchParams] = useSearchParams()

  const [selected, setSelected] = useState<string[]>(() => {
    const paramId = searchParams.get("a") ?? undefined
    const ranked = players
      .map((p) => ({ id: p.id, pontos: kpis(playerTotals(matches, p.id)).pontos }))
      .sort((a, b) => b.pontos - a.pontos)
      .map((r) => r.id)
    if (paramId && players.some((p) => p.id === paramId)) {
      return [paramId, ...ranked.filter((id) => id !== paramId).slice(0, 2)]
    }
    return ranked.slice(0, 3)
  })

  const [colorAssign, setColorAssign] = useState<Map<string, number>>(() => {
    const m = new Map<string, number>()
    selected.forEach((id, i) => m.set(id, i))
    return m
  })

  const [scope, setScope] = useState<Scope>("total")

  function toggleSelect(id: string) {
    const isSelected = selected.includes(id)
    if (!isSelected && selected.length >= 5) return
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setColorAssign((prev) => {
      const next = new Map(prev)
      if (isSelected) {
        next.delete(id)
      } else {
        const used = new Set(next.values())
        let i = 0
        while (used.has(i)) i++
        next.set(id, i)
      }
      return next
    })
  }

  const playerById = (id: string) => players.find((p) => p.id === id) as Player
  const colorOf = (id: string) => seriesColor(colorAssign.get(id) ?? 0)

  const playerStats = useMemo(() => {
    const map = new Map<string, { k: Kpis; games: number; matches: Match[]; totals: Totals }>()
    for (const id of selected) {
      const pm = playerMatches(matches, id)
      const totals = playerTotals(pm, id)
      map.set(id, { k: kpis(totals), games: pm.length, matches: pm, totals })
    }
    return map
  }, [selected, matches])

  const legendItems = selected.map((id) => ({ label: playerById(id).name, color: colorOf(id) }))

  const radarAllHaveRally =
    selected.length > 0 && selected.every((id) => hasRallyData(playerStats.get(id)!.totals))

  const radarData = useMemo(() => {
    return RADAR_AXES.map((axis) => {
      const raw: Record<string, number> = {}
      for (const id of selected) {
        const stat = playerStats.get(id)!
        const v = axis.get(stat.k)
        raw[id] =
          axis.volumeDriven && radarAllHaveRally
            ? per25(v, stat.k.pontosJogados)
            : scope === "media"
              ? stat.games > 0
                ? v / stat.games
                : 0
              : v
      }
      const max = Math.max(0, ...selected.map((id) => raw[id]))
      const row: Record<string, any> = { subject: axis.label, raw }
      for (const id of selected) row[id] = max > 0 ? (raw[id] / max) * 100 : 0
      return row
    })
  }, [selected, playerStats, scope, radarAllHaveRally])

  const countsData = useMemo(
    () =>
      COUNT_BAR_METRICS.map((m) => {
        const row: Record<string, any> = { metric: m.label }
        for (const id of selected) {
          const stat = playerStats.get(id)!
          const raw = m.get(stat.k)
          row[id] = scope === "media" ? (stat.games > 0 ? raw / stat.games : 0) : raw
        }
        return row
      }),
    [selected, playerStats, scope],
  )

  const ratesData = useMemo(
    () =>
      RATE_BAR_METRICS.map((m) => {
        const row: Record<string, any> = { metric: m.label }
        for (const id of selected) row[id] = playerStats.get(id)!.k[
          m.label === "Ataque %" ? "ataqueAproveitamento" : "passeAproveitamento"
        ] * 100
        return row
      }),
    [selected, playerStats],
  )

  const timelineData = useMemo(() => {
    const involvedIds = new Set<string>()
    const perPlayerMatchIds = new Map<string, Set<string>>()
    for (const id of selected) {
      const ms = playerStats.get(id)?.matches ?? []
      perPlayerMatchIds.set(id, new Set(ms.map((m) => m.id)))
      ms.forEach((m) => involvedIds.add(m.id))
    }
    return matches
      .filter((m) => involvedIds.has(m.id))
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => {
        const row: Record<string, any> = { date: m.date, opponent: m.opponent }
        for (const id of selected) {
          row[id] = perPlayerMatchIds.get(id)!.has(m.id) ? kpis(playerMatchTotals(m, id)).pontos : null
        }
        return row
      })
  }, [selected, matches, playerStats])

  const anyHasRally = selected.some((id) => hasRallyData(playerStats.get(id)!.totals))

  const participationData = useMemo(() => {
    const involvedIds = new Set<string>()
    const perPlayerRally = new Map<string, Map<string, number>>()
    for (const id of selected) {
      const byMatch = new Map<string, number>()
      for (const m of matches) {
        const played = t(m.stats[id], RALLY_STAT)
        if (played > 0) {
          byMatch.set(m.id, played)
          involvedIds.add(m.id)
        }
      }
      perPlayerRally.set(id, byMatch)
    }
    return matches
      .filter((m) => involvedIds.has(m.id))
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => {
        const total = matchRallies(m)
        const row: Record<string, any> = { date: m.date, opponent: m.opponent }
        for (const id of selected) {
          const played = perPlayerRally.get(id)!.get(m.id)
          row[id] = played != null && total > 0 ? (played / total) * 100 : null
        }
        return row
      })
  }, [selected, matches])

  const radarTooltip = makeTooltip((payload) => {
    const row = payload[0]?.payload
    return {
      title: row?.subject,
      rows: selected.map((id) => ({
        label: playerById(id).name,
        value: fmtNum(row?.raw?.[id] ?? 0, radarAllHaveRally || scope === "media" ? 1 : 0),
        color: colorOf(id),
      })),
    }
  })

  const countsTooltip = makeTooltip((payload, label) => ({
    title: label,
    rows: payload.map((p) => ({
      label: playerById(p.dataKey).name,
      value: fmtNum(p.value, scope === "media" ? 1 : 0),
      color: colorOf(p.dataKey),
    })),
  }))

  const ratesTooltip = makeTooltip((payload, label) => ({
    title: label,
    rows: payload.map((p) => ({
      label: playerById(p.dataKey).name,
      value: `${fmtNum(p.value, 0)}%`,
      color: colorOf(p.dataKey),
    })),
  }))

  const timelineTooltip = makeTooltip((payload, label) => {
    const row = payload[0]?.payload
    return {
      title: `${formatDateShort(label)} · vs ${row?.opponent ?? ""}`,
      rows: selected.map((id) => {
        const v = row?.[id]
        return { label: playerById(id).name, value: v == null ? "—" : fmtNum(v, 0), color: colorOf(id) }
      }),
    }
  })

  const participationTooltip = makeTooltip((payload, label) => {
    const row = payload[0]?.payload
    return {
      title: `${formatDateShort(label)} · vs ${row?.opponent ?? ""}`,
      rows: selected.map((id) => {
        const v = row?.[id]
        return { label: playerById(id).name, value: v == null ? "—" : `${fmtNum(v, 0)}%`, color: colorOf(id) }
      }),
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Comparar jogadores" subtitle="Selecione até 5 jogadores" />

      <section className="space-y-4 rounded-xl border bg-card p-4">
        <div className="space-y-4">
          {POSITIONS.map((pos) => {
            const list = players.filter((p) => p.position === pos.key)
            if (!list.length) return null
            return (
              <div key={pos.key}>
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: pos.color }} />
                  {pos.plural}
                </div>
                <div className="flex flex-wrap gap-2">
                  {list.map((p) => {
                    const isSelected = selected.includes(p.id)
                    const disabled = !isSelected && selected.length >= 5
                    const color = isSelected ? colorOf(p.id) : undefined
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleSelect(p.id)}
                        style={
                          isSelected
                            ? {
                                borderColor: color,
                                backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`,
                              }
                            : undefined
                        }
                        className={cn(
                          "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                          isSelected
                            ? "font-medium"
                            : "text-muted-foreground hover:border-border/90 hover:text-foreground",
                          disabled && "cursor-not-allowed opacity-40",
                        )}
                      >
                        <span className="size-2 rounded-full" style={{ background: pos.color }} />
                        {p.name}
                        {typeof p.number === "number" ? (
                          <span className="num text-xs text-muted-foreground">#{p.number}</span>
                        ) : null}
                        {isSelected ? (
                          <span className="size-2 rounded-full" style={{ background: color }} />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        {selected.length >= 5 ? (
          <p className="text-xs text-muted-foreground">
            Máximo de 5 jogadores. Remova alguém para trocar a seleção.
          </p>
        ) : null}
      </section>

      {selected.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum jogador selecionado"
          description="Escolha ao menos um jogador acima para ver a comparação."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ToggleGroup
              type="single"
              variant="outline"
              value={scope}
              onValueChange={(v) => v && setScope(v as Scope)}
            >
              <ToggleGroupItem value="total">Totais da temporada</ToggleGroupItem>
              <ToggleGroupItem value="media">Média por partida</ToggleGroupItem>
              <ToggleGroupItem value="por25">Por 25 pontos disputados</ToggleGroupItem>
            </ToggleGroup>
            {selected.length === 1 ? (
              <p className="text-xs text-muted-foreground">Selecione mais um jogador para comparar</p>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Métrica</TableHead>
                  {selected.map((id) => {
                    const p = playerById(id)
                    return (
                      <TableHead key={id} className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="size-2 rounded-full" style={{ background: colorOf(id) }} />
                          <span className="font-medium text-foreground">{p.name}</span>
                          <PositionBadge position={p.position} />
                        </div>
                      </TableHead>
                    )
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {METRIC_ROWS.map((row) => {
                  const values = selected.map((id) =>
                    valueFor(row, playerStats.get(id)!, scope, { id, matches }),
                  )
                  let bestId: string | null = null
                  let worstId: string | null = null
                  if (selected.length >= 2 && row.kind !== "fixed" && row.kind !== "info") {
                    const present = selected
                      .map((id, i) => ({ id, v: values[i] }))
                      .filter((x): x is { id: string; v: number } => x.v != null)
                    if (present.length >= 2) {
                      const vals = present.map((x) => x.v)
                      const max = Math.max(...vals)
                      const min = Math.min(...vals)
                      if (max !== min) {
                        const bestVal = row.invert ? min : max
                        const worstVal = row.invert ? max : min
                        bestId = present.find((x) => x.v === bestVal)!.id
                        worstId = present.find((x) => x.v === worstVal)!.id
                      }
                    }
                  }
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="text-muted-foreground">
                        {row.label}
                        {row.suffix ? (
                          <span className="ml-1 text-[10px] text-muted-foreground/70">{row.suffix}</span>
                        ) : null}
                      </TableCell>
                      {selected.map((id, i) => (
                        <TableCell
                          key={id}
                          className={cn(
                            "num text-right tabular-nums",
                            id === bestId && "bg-[var(--success)]/10 font-semibold",
                            id === worstId && "text-muted-foreground",
                          )}
                        >
                          {values[i] == null ? "—" : row.format(values[i]!, scope)}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <ChartCard
            title="Perfil de fundamentos"
            subtitle={`Base: ${radarAllHaveRally ? "por 25 pontos disputados" : "volume total"}`}
            legend={<Legend items={legendItems} />}
          >
            <ResponsiveContainer width="100%" height={360}>
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                <Tooltip content={radarTooltip} />
                {selected.map((id) => (
                  <Radar isAnimationActive={false}
                    key={id}
                    name={playerById(id).name}
                    dataKey={id}
                    stroke={colorOf(id)}
                    fill={colorOf(id)}
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Comparativo direto" legend={<Legend items={legendItems} />}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Volume</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={countsData}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="metric" {...axisProps} />
                    <YAxis {...axisProps} allowDecimals={scope === "media"} />
                    <Tooltip content={countsTooltip} cursor={{ fill: "var(--muted)" }} />
                    {selected.map((id) => (
                      <Bar isAnimationActive={false} key={id} dataKey={id} name={playerById(id).name} fill={colorOf(id)} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Aproveitamento</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ratesData}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="metric" {...axisProps} />
                    <YAxis {...axisProps} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip content={ratesTooltip} cursor={{ fill: "var(--muted)" }} />
                    {selected.map((id) => (
                      <Bar isAnimationActive={false} key={id} dataKey={id} name={playerById(id).name} fill={colorOf(id)} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Pontos por partida" legend={<Legend items={legendItems} />}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineData}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} tickFormatter={formatDateShort} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={timelineTooltip} cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }} />
                {selected.map((id) => (
                  <Line isAnimationActive={false}
                    key={id}
                    type="monotone"
                    dataKey={id}
                    name={playerById(id).name}
                    stroke={colorOf(id)}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {anyHasRally ? (
            <ChartCard title="Participação por partida" legend={<Legend items={legendItems} />}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={participationData}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" {...axisProps} tickFormatter={formatDateShort} />
                  <YAxis {...axisProps} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={participationTooltip} cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }} />
                  {selected.map((id) => (
                    <Line isAnimationActive={false}
                      key={id}
                      type="monotone"
                      dataKey={id}
                      name={playerById(id).name}
                      stroke={colorOf(id)}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : null}
        </>
      )}
    </div>
  )
}
