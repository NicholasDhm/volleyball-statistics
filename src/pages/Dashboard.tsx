import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { LucideIcon } from "lucide-react"
import { Activity, CalendarDays, Flame, Hand, ShieldCheck, Target, TrendingDown, Trophy } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { EmptyState, PageHeader, PositionBadge, ResultBadge, StatTile } from "@/components/kit"
import { ChartCard, Legend, axisProps, gridProps, makeTooltip, seriesColor } from "@/components/charts/chart-kit"
import { useMatches, usePlayers } from "@/store/useTeamStore"
import { TeamNameEditor } from "@/components/layout/AppShell"
import { PositionEfficiencyCard } from "@/components/PositionEfficiency"
import { POSITION_STATS, positionMeta } from "@/lib/stats"
import type { Match, Player } from "@/lib/types"
import {
  fmtNum,
  fmtPct,
  fmtSigned,
  geral,
  hasRallyData,
  isWin,
  kpis,
  matchTotals,
  participacao,
  playerMatches,
  playerTotals,
  record,
  setDistribution,
  setsLost,
  setsWon,
  teamTotals,
  totalRallies,
  totalPontosPlacar,
  totalPontosCedidos,
  aproveitamentoDoPlacar,
} from "@/lib/analytics"

type SeasonFilter = "all" | "last5" | "last3" | (string & {})

const shortName = (s: string) => (s.length > 14 ? `${s.slice(0, 13)}…` : s)

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase()
}

function maxBy<T>(arr: T[], f: (x: T) => number): T | undefined {
  return arr.reduce<T | undefined>((best, cur) => (best === undefined || f(cur) > f(best) ? cur : best), undefined)
}
function minBy<T>(arr: T[], f: (x: T) => number): T | undefined {
  return arr.reduce<T | undefined>((best, cur) => (best === undefined || f(cur) < f(best) ? cur : best), undefined)
}

function LeaderCard({
  icon: Icon,
  title,
  player,
  value,
  hint,
}: {
  icon: LucideIcon
  title: string
  player: Player
  value: string
  hint: string
}) {
  const meta = positionMeta(player.position)
  return (
    <Link
      to={`/jogador/${player.id}`}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-border/90"
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </div>
      <div className="flex items-center gap-3">
        <Avatar size="lg">
          <AvatarFallback
            className="font-semibold"
            style={{ backgroundColor: meta.color, color: "white" }}
          >
            {initials(player.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{player.name}</div>
          <PositionBadge position={player.position} className="mt-1" />
        </div>
      </div>
      <div>
        <div className="num text-xl font-semibold tabular-nums">{value}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const matches = useMatches()
  const players = usePlayers()
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>("all")

  const competitions = useMemo(() => {
    const set = new Set<string>()
    for (const m of matches) if (m.competition) set.add(m.competition)
    return Array.from(set).sort()
  }, [matches])

  const filteredMatches = useMemo(() => {
    const byDateDesc = [...matches].sort((a, b) => b.date.localeCompare(a.date))
    if (seasonFilter === "all") return matches
    if (seasonFilter === "last5") return byDateDesc.slice(0, 5)
    if (seasonFilter === "last3") return byDateDesc.slice(0, 3)
    return matches.filter((m) => m.competition === seasonFilter)
  }, [matches, seasonFilter])

  const recordData = record(filteredMatches)
  const teamK = kpis(teamTotals(filteredMatches))
  const geralData = geral(filteredMatches, players)
  const dist = setDistribution(teamTotals(filteredMatches))
  const rallies = totalRallies(filteredMatches)
  const placarPro = totalPontosPlacar(filteredMatches)
  const placarContra = totalPontosCedidos(filteredMatches)
  const aproveitamentoPlacar = aproveitamentoDoPlacar(filteredMatches)

  const chartMatches = useMemo(() => {
    return [...filteredMatches]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => {
        const k = kpis(matchTotals(m))
        return {
          id: m.id,
          name: shortName(m.opponent),
          opponent: m.opponent,
          dateLabel: format(parseISO(m.date), "dd MMM", { locale: ptBR }),
          placar: `${setsWon(m)}—${setsLost(m)}`,
          pontos: k.pontos,
          erros: k.erros,
          ataqueEficiencia: k.ataqueEficiencia,
          win: isWin(m),
        }
      })
  }, [filteredMatches])

  const recentMatches = useMemo(
    () => [...filteredMatches].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [filteredMatches],
  )

  const playerStats = useMemo(() => {
    return players
      .map((p) => {
        const totals = playerTotals(filteredMatches, p.id)
        const matchesPlayed = playerMatches(filteredMatches, p.id).length
        return { player: p, totals, k: kpis(totals), matchesPlayed }
      })
      .filter((s) => s.matchesPlayed > 0)
  }, [players, filteredMatches])

  const perfTooltip = makeTooltip((payload) => {
    const d = payload[0]?.payload as (typeof chartMatches)[number] | undefined
    if (!d) return { rows: [] }
    return {
      title: `${d.dateLabel} · ${d.opponent}`,
      rows: [
        { label: "Placar de sets", value: d.placar },
        { label: "Pontos conquistados", value: fmtNum(d.pontos), color: seriesColor(0) },
        { label: "Erros", value: fmtNum(d.erros), color: seriesColor(1) },
        { label: "Resultado", value: d.win ? "Vitória" : "Derrota" },
      ],
    }
  })

  const effTooltip = makeTooltip((payload) => {
    const d = payload[0]?.payload as (typeof chartMatches)[number] | undefined
    if (!d) return { rows: [] }
    return {
      title: `${d.dateLabel} · ${d.opponent}`,
      rows: [{ label: "Eficiência de ataque", value: fmtPct(d.ataqueEficiencia, 1), color: seriesColor(0) }],
    }
  })

  const distTooltip = makeTooltip((payload) => ({
    rows: payload.map((p) => {
      const entry = dist.find((d) => d.key === p.dataKey)!
      return { label: entry.label, value: `${fmtNum(entry.value)} · ${fmtPct(entry.share)}`, color: p.fill as string }
    }),
  }))

  if (matches.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={<TeamNameEditor size="lg" />} subtitle="Temporada 2026 · 0 partidas" />
        <EmptyState
          icon={CalendarDays}
          title="Nenhuma partida registrada"
          description="Cadastre a primeira partida da temporada para ver os números do time aqui."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                to="/partidas"
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Cadastrar primeira partida
              </Link>
              <Link
                to="/elenco"
                className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
              >
                Montar o elenco
              </Link>
            </div>
          }
        />
      </div>
    )
  }

  const maiorPontuador = maxBy(playerStats, (s) => s.k.pontos)
  const melhorEficiencia = maxBy(
    // só quem de fato registra erro de ataque — levantador e líbero não têm como "errar" aqui
    playerStats.filter(
      (s) =>
        s.k.ataqueTentativas >= 15 &&
        POSITION_STATS[s.player.position].includes("ataque_errado"),
    ),
    (s) => s.k.ataqueEficiencia,
  )

  // Taxas por 25 pontos disputados só fazem sentido quando há participação lançada.
  const anyRallyData = playerStats.some((s) => hasRallyData(s.totals))
  const rallyCandidates = playerStats.filter((s) => hasRallyData(s.totals) && s.k.pontosJogados >= 50)

  const maisDefesas = anyRallyData
    ? maxBy(rallyCandidates, (s) => s.k.defesasPor25)
    : maxBy(playerStats, (s) => s.k.defesas)
  const maisBlocks = anyRallyData
    ? maxBy(rallyCandidates, (s) => s.k.blocksPor25)
    : maxBy(playerStats, (s) => s.k.blocks)
  const maisRodado = anyRallyData
    ? maxBy(
        playerStats.filter((s) => hasRallyData(s.totals)),
        (s) => s.k.pontosJogados,
      )
    : undefined

  const melhorPasse = maxBy(
    playerStats.filter((s) => s.k.passeTotal >= 15),
    (s) => s.k.passeNota,
  )
  const menosErros = minBy(
    playerStats.filter((s) => s.matchesPlayed >= 3),
    (s) => s.k.erros / s.matchesPlayed,
  )

  const leaders: { key: string; title: string; icon: LucideIcon; entry: (typeof playerStats)[number]; value: string; hint: string }[] = []
  if (maiorPontuador) {
    const pts25Suffix = hasRallyData(maiorPontuador.totals)
      ? ` · ${fmtNum(maiorPontuador.k.pontosPor25, 1)} pts/25`
      : ""
    leaders.push({
      key: "pontuador",
      title: "Maior pontuador",
      icon: Trophy,
      entry: maiorPontuador,
      value: `${fmtNum(maiorPontuador.k.pontos)} pontos`,
      hint: `${fmtNum(maiorPontuador.k.pontos)} pontos conquistados em ${maiorPontuador.matchesPlayed} partidas${pts25Suffix}`,
    })
  }
  if (melhorEficiencia) {
    leaders.push({
      key: "eficiencia",
      title: "Melhor eficiência de ataque",
      icon: Flame,
      entry: melhorEficiencia,
      value: fmtPct(melhorEficiencia.k.ataqueEficiencia, 1),
      hint: `${fmtNum(melhorEficiencia.k.ataqueTentativas)} ataques em ${melhorEficiencia.matchesPlayed} partidas`,
    })
  }
  if (maisDefesas) {
    leaders.push(
      anyRallyData
        ? {
            key: "defesas",
            title: "Melhor defesa",
            icon: ShieldCheck,
            entry: maisDefesas,
            value: `${fmtNum(maisDefesas.k.defesasPor25, 1)} def/25`,
            hint: `${fmtNum(maisDefesas.k.defesas)} defesas em ${fmtNum(maisDefesas.k.pontosJogados)} pontos disputados`,
          }
        : {
            key: "defesas",
            title: "Mais defesas",
            icon: ShieldCheck,
            entry: maisDefesas,
            value: `${fmtNum(maisDefesas.k.defesas)} defesas`,
            hint: `${fmtNum(maisDefesas.k.defesas)} defesas em ${maisDefesas.matchesPlayed} partidas`,
          },
    )
  }
  if (maisBlocks) {
    leaders.push(
      anyRallyData
        ? {
            key: "blocks",
            title: "Melhor bloqueio",
            icon: Hand,
            entry: maisBlocks,
            value: `${fmtNum(maisBlocks.k.blocksPor25, 1)} blocks/25`,
            hint: `${fmtNum(maisBlocks.k.blocks)} blocks em ${fmtNum(maisBlocks.k.pontosJogados)} pontos disputados`,
          }
        : {
            key: "blocks",
            title: "Mais blocks",
            icon: Hand,
            entry: maisBlocks,
            value: `${fmtNum(maisBlocks.k.blocks)} blocks`,
            hint: `${fmtNum(maisBlocks.k.blocks)} blocks em ${maisBlocks.matchesPlayed} partidas`,
          },
    )
  }
  if (maisRodado) {
    const share = participacao(filteredMatches, maisRodado.player.id)
    if (share !== null) {
      leaders.push({
        key: "rodado",
        title: "Mais rodado",
        icon: Activity,
        entry: maisRodado,
        value: fmtPct(share),
        hint: `${fmtNum(maisRodado.k.pontosJogados)} pontos disputados em ${maisRodado.matchesPlayed} partidas`,
      })
    }
  }
  if (melhorPasse) {
    leaders.push({
      key: "passe",
      title: "Melhor passe",
      icon: Target,
      entry: melhorPasse,
      value: `${fmtNum(melhorPasse.k.passeNota)} / 100`,
      hint: `${fmtNum(melhorPasse.k.passeTotal)} passes em ${melhorPasse.matchesPlayed} partidas`,
    })
  }
  if (menosErros) {
    leaders.push({
      key: "menos-erros",
      title: "Menos erros por partida",
      icon: TrendingDown,
      entry: menosErros,
      value: `${fmtNum(menosErros.k.erros / menosErros.matchesPlayed, 1)} erros/partida`,
      hint: `${fmtNum(menosErros.k.erros)} erros em ${menosErros.matchesPlayed} partidas`,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={<TeamNameEditor size="lg" />}
        subtitle={`Temporada 2026 · ${matches.length} partidas`}
        actions={
          <Select value={seasonFilter} onValueChange={setSeasonFilter}>
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as partidas</SelectItem>
              <SelectItem value="last5">Últimas 5</SelectItem>
              <SelectItem value="last3">Últimas 3</SelectItem>
              {competitions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Campanha"
          value={`${recordData.vitorias}V — ${recordData.derrotas}D`}
          hint={`${recordData.setsPro} sets a favor · ${recordData.setsContra} contra`}
          accent={seriesColor(0)}
        />
        <StatTile
          label="Eficiência de ataque"
          value={fmtPct(teamK.ataqueEficiencia, 1)}
          hint={`${fmtNum(teamK.ataquePontos)} pontos em ${fmtNum(teamK.ataqueTentativas)} ataques`}
          accent={seriesColor(1)}
        />
        <StatTile
          label="Aproveitamento de saque"
          value={`${fmtNum(teamK.saqueAces)} aces`}
          hint={`${fmtNum(teamK.saqueErros)} erros · média ${fmtNum(teamK.saqueAces / Math.max(recordData.jogos, 1), 1)} por partida`}
          accent={seriesColor(2)}
        />
        <StatTile
          label="Saldo pontos/erros"
          value={fmtSigned(teamK.pontos - teamK.erros)}
          hint={`${fmtNum(teamK.pontos)} pontos conquistados · ${fmtNum(teamK.erros)} erros`}
          accent={seriesColor(3)}
        />
        <StatTile
          label="Pontos no placar"
          value={`${fmtNum(placarPro)}—${fmtNum(placarContra)}`}
          hint={
            aproveitamentoPlacar === null
              ? "sem placar lançado"
              : `${fmtPct(aproveitamentoPlacar)} vieram de ação nossa; o resto foi erro do adversário`
          }
          accent={seriesColor(4)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Defesas certas" value={fmtNum(geralData.defesasCertas)} />
        <StatTile label="Blocks dados" value={fmtNum(geralData.blocksDados)} />
        <StatTile label="Blocks tomados" value={fmtNum(geralData.blocksTomados)} />
        <StatTile label="Passes certos" value={fmtNum(geralData.passesCertos)} />
        <StatTile
          label="Pontos disputados"
          value={fmtNum(rallies)}
          hint={`média de ${fmtNum(rallies / Math.max(recordData.jogos, 1), 1)} por partida`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Desempenho por partida"
          subtitle="Pontos conquistados = ataque + saque + bloqueio. Não inclui os pontos que caíram por erro do adversário."
          legend={
            <Legend
              items={[
                { label: "Pontos conquistados", color: seriesColor(0) },
                { label: "Erros cometidos", color: seriesColor(1) },
              ]}
            />
          }
        >
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartMatches} margin={{ left: -16, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} />
              <RTooltip content={perfTooltip} cursor={{ fill: "var(--muted)" }} />
              <Bar isAnimationActive={false} dataKey="pontos" name="Pontos conquistados" fill={seriesColor(0)} radius={[4, 4, 0, 0]} />
              <Line isAnimationActive={false}
                type="monotone"
                dataKey="erros"
                name="Erros"
                stroke={seriesColor(1)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Eficiência de ataque por partida">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartMatches} margin={{ left: -16, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v: number) => fmtPct(v)} />
              <RTooltip content={effTooltip} cursor={{ stroke: "var(--border)" }} />
              <ReferenceLine
                y={teamK.ataqueEficiencia}
                stroke="var(--muted-foreground)"
                strokeOpacity={0.5}
                strokeDasharray="4 4"
                label={{ value: "média", position: "insideBottomRight", fill: "var(--muted-foreground)", fontSize: 10, offset: 6 }}
              />
              <Line isAnimationActive={false}
                type="monotone"
                dataKey="ataqueEficiencia"
                name="Eficiência"
                stroke={seriesColor(0)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard
        title="Distribuição do levantamento"
        legend={<Legend items={dist.map((d, i) => ({ label: d.label, color: seriesColor(i) }))} />}
      >
        <ResponsiveContainer width="100%" height={90}>
          <BarChart data={[{ name: "levantamento", set_ponta: dist[0].value, set_saida: dist[1].value, set_central: dist[2].value, set_pipe: dist[3].value }]} layout="vertical" barSize={28}>
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis type="category" dataKey="name" hide />
            <RTooltip content={distTooltip} cursor={{ fill: "var(--muted)" }} />
            <Bar isAnimationActive={false} dataKey="set_ponta" stackId="dist" fill={seriesColor(0)} stroke="var(--card)" strokeWidth={2} radius={[4, 0, 0, 4]} />
            <Bar isAnimationActive={false} dataKey="set_saida" stackId="dist" fill={seriesColor(1)} stroke="var(--card)" strokeWidth={2} />
            <Bar isAnimationActive={false} dataKey="set_central" stackId="dist" fill={seriesColor(2)} stroke="var(--card)" strokeWidth={2} />
            <Bar isAnimationActive={false} dataKey="set_pipe" stackId="dist" fill={seriesColor(3)} stroke="var(--card)" strokeWidth={2} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
          {dist.map((d, i) => (
            <div key={d.key} className="flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-[2px]" style={{ background: seriesColor(i) }} />
              <span className="text-muted-foreground">{d.label}</span>
              <span className="num font-medium tabular-nums">
                {fmtPct(d.share)} ({fmtNum(d.value)})
              </span>
            </div>
          ))}
        </div>
      </ChartCard>

      <PositionEfficiencyCard players={players} matches={filteredMatches} />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Destaques da temporada</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {leaders.map((l) => (
            <LeaderCard
              key={l.key}
              icon={l.icon}
              title={l.title}
              player={l.entry.player}
              value={l.value}
              hint={l.hint}
            />
          ))}
        </div>
      </div>

      <section className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Últimas partidas</h3>
          <Link to="/partidas" className="text-xs font-medium text-primary hover:underline">
            Ver todas
          </Link>
        </div>
        <div className="divide-y divide-border">
          {recentMatches.map((m: Match) => {
            const k = kpis(matchTotals(m))
            return (
              <Link
                key={m.id}
                to={`/partidas/${m.id}`}
                className="-mx-1 flex items-center gap-3 rounded-md px-1 py-2.5 text-sm transition-colors hover:bg-accent/40"
              >
                <span className="w-14 shrink-0 text-xs text-muted-foreground">
                  {format(parseISO(m.date), "dd MMM", { locale: ptBR })}
                </span>
                <ResultBadge win={isWin(m)} />
                <span className="min-w-0 flex-1 truncate font-medium">{m.opponent}</span>
                <span className="num shrink-0 text-xs tabular-nums text-muted-foreground">
                  {setsWon(m)}—{setsLost(m)}
                </span>
                <span className="num w-28 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {fmtNum(k.pontos)} pts · {fmtNum(k.erros)} err
                </span>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
