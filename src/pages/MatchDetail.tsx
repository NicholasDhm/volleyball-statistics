import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ArrowLeft, CalendarX2, Check, Grid3x3, LineChart as LineChartIcon, Users2,
} from "lucide-react"
import {
  Bar, BarChart, CartesianGrid, Cell as RCell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState, PageHeader, PositionBadge, ResultBadge, StatTile } from "@/components/kit"
import { ChartCard, axisProps, gridProps, makeTooltip, seriesColor } from "@/components/charts/chart-kit"
import { StatGrid } from "@/components/StatGrid"
import {
  AttackOutcomeCard, ErrorBreakdownCard, PlayerBalanceCard, PointOriginsCard,
  PointsCompositionCard, ReceptionCard, TeamProfileCard,
} from "@/components/MatchSummaryCharts"
import { PositionEfficiencyCard } from "@/components/PositionEfficiency"
import { useTeamStore } from "@/store/useTeamStore"
import {
  fmtNum, fmtPct, fmtSigned, isWin, kpis, matchRallies, matchTotals, playerMatchTotals, pontosCedidos,
  pontosPlacar, setTargets, setsLost, setsWon, t,
} from "@/lib/analytics"
import { POSITIONS, POSITION_STATS, RALLY_STAT, positionMeta } from "@/lib/stats"
import { cn } from "@/lib/utils"

export default function MatchDetail() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const match = useTeamStore((s) => s.matches.find((m) => m.id === matchId))
  const allPlayers = useTeamStore((s) => s.players)
  const allMatches = useTeamStore((s) => s.matches)
  const toggleLineup = useTeamStore((s) => s.toggleLineup)
  const updateMatch = useTeamStore((s) => s.updateMatch)
  const [showAll, setShowAll] = useState(false)

  const lineupPlayers = useMemo(
    () => allPlayers.filter((p) => match?.lineup.includes(p.id)),
    [allPlayers, match],
  )
  const gridPlayers = showAll ? allPlayers : lineupPlayers

  const rallies = match ? matchRallies(match) : 0

  function setAllLineup(on: boolean) {
    if (!match) return
    updateMatch(match.id, { lineup: on ? allPlayers.map((p) => p.id) : [] })
  }

  /** Só faz sentido marcar "não jogou" se a participação já foi lançada para alguém. */
  const temParticipacaoLancada = match
    ? allPlayers.some((p) => t(match.stats[p.id], RALLY_STAT) > 0)
    : false

  /** Quem tem número lançado mas ficou de fora da convocação — os dados seguem lá, só somem da grade. */
  const lancamentoSemConvocacao = match
    ? allPlayers.filter(
        (p) => !match.lineup.includes(p.id) && Object.keys(match.stats[p.id] ?? {}).length > 0,
      )
    : []
  const totals = useMemo(() => (match ? matchTotals(match) : {}), [match])
  const k = useMemo(() => kpis(totals), [totals])

  const perPlayer = useMemo(() => {
    if (!match) return []
    return allPlayers
      .filter((p) => Object.keys(match.stats[p.id] ?? {}).length > 0)
      .map((p) => {
        const pk = kpis(playerMatchTotals(match, p.id))
        return {
          id: p.id,
          name: p.name,
          position: p.position,
          ...pk,
          participacao: rallies > 0 && pk.pontosJogados > 0 ? pk.pontosJogados / rallies : null,
          // levantador e líbero não registram erro de ataque — uma "eficiência" deles seria sempre 100%
          medeAtaque: POSITION_STATS[p.position].includes("ataque_errado"),
        }
      })
      .sort((a, b) => b.pontos - a.pontos)
  }, [match, allPlayers, rallies])

  if (!match) {
    return (
      <EmptyState
        icon={CalendarX2}
        title="Partida não encontrada"
        description="Ela pode ter sido excluída."
        action={<Button asChild><Link to="/partidas">Voltar para partidas</Link></Button>}
      />
    )
  }

  const win = isWin(match)
  const setScore = `${setsWon(match)}—${setsLost(match)}`
  const placar = pontosPlacar(match)
  const cedidos = pontosCedidos(match)
  const targets = setTargets([match], allPlayers)

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <ResultBadge win={win} />
            <span>{match.opponent}</span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{format(parseISO(match.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            <span>·</span>
            <span className="num font-medium text-foreground">{setScore}</span>
            <span className="text-muted-foreground">
              ({match.sets.map((s) => `${s.us}-${s.them}`).join(" · ")})
            </span>
            {match.competition ? <><span>·</span><span>{match.competition}</span></> : null}
            {match.location ? (
              <Badge variant="secondary" className="text-[10px] capitalize">{match.location}</Badge>
            ) : null}
          </span>
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/partidas")}>
            <ArrowLeft className="size-4" /> Partidas
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Pontos conquistados" value={k.pontos} accent={seriesColor(0)}
          hint={`${k.ataquePontos} de ataque · ${k.saqueAces} de saque · ${k.blocks} de bloqueio`} />
        <StatTile
          label="Placar"
          value={`${placar}—${cedidos}`}
          accent={seriesColor(3)}
          hint={
            placar === 0
              ? "sem placar lançado"
              : k.pontos > placar
                ? `${k.pontos} pontos conquistados não cabem num placar de ${placar} — revise o lançamento ou o placar`
                : `${fmtPct(k.pontos / placar)} dos nossos pontos vieram de ação nossa; o resto foi erro do adversário`
          }
        />
        <StatTile label="Erros cometidos" value={k.erros} accent={seriesColor(4)}
          hint={`${t(totals, "ataque_errado")} ataque · ${t(totals, "saque_errado")} saque · ${t(totals, "passe_errado")} passe`} />
        <StatTile label="Eficiência de ataque" value={fmtPct(k.ataqueEficiencia, 1)} accent={seriesColor(1)}
          hint={`${k.ataquePontos} pontos em ${k.ataqueTentativas} ataques`} />
        <StatTile label="Defesa e bloqueio" value={k.defesas + k.blocks} accent={seriesColor(2)}
          hint={`${k.defesas} defesas · ${k.coberturas} coberturas · ${k.blocks} blocks`} />
      </div>

      <Tabs defaultValue="lancamento">
        <TabsList>
          <TabsTrigger value="lancamento"><Grid3x3 className="size-4" /> Lançamento</TabsTrigger>
          <TabsTrigger value="resumo"><LineChartIcon className="size-4" /> Resumo</TabsTrigger>
        </TabsList>

        <TabsContent value="lancamento" className="mt-4 space-y-4">
          <section className="rounded-xl border bg-card p-4">
            <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Quem foi convocado</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Marque todo mundo que esteve na partida, tenha entrado em quadra ou não. Quem
                  não jogou fica com 0 pontos disputados — e some das médias por 25 pontos.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setAllLineup(true)}>
                  Convocar todos
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAllLineup(false)}>
                  Limpar
                </Button>
              </div>
            </header>
            <div className="space-y-2.5">
              {POSITIONS.map((pos) => {
                const group = allPlayers.filter((p) => p.position === pos.key)
                if (!group.length) return null
                return (
                  <div key={pos.key} className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 flex w-28 shrink-0 items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <span className="size-2 shrink-0 rounded-[3px]" style={{ background: pos.color }} />
                      {pos.plural}
                    </span>
                    {group.map((p) => {
                      const on = match.lineup.includes(p.id)
                      const jogou = t(match.stats[p.id], RALLY_STAT) > 0
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleLineup(match.id, p.id)}
                          title={on ? "Convocado — clique para remover" : "Fora da partida — clique para convocar"}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                            on
                              ? "border-primary/45 bg-primary/10 font-medium text-foreground"
                              : "border-border bg-transparent text-muted-foreground hover:bg-accent",
                          )}
                        >
                          {on ? <Check className="size-3" /> : null}
                          {p.name}
                          {on && !jogou && temParticipacaoLancada ? (
                            <span className="text-[10px] text-muted-foreground">não jogou</span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
            {lancamentoSemConvocacao.length ? (
              <p className="mt-3 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/8 px-3 py-2 text-xs text-muted-foreground">
                {lancamentoSemConvocacao.map((p) => p.name).join(", ")}{" "}
                {lancamentoSemConvocacao.length === 1 ? "tem lançamento" : "têm lançamento"} mas
                não {lancamentoSemConvocacao.length === 1 ? "está" : "estão"} na convocação. Os
                números continuam salvos e contando no total do time — só somem da grade enquanto
                o modo «só os convocados» estiver ligado.
              </p>
            ) : null}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
            <span>
              Clique numa célula e digite. <kbd className="rounded border px-1">↑</kbd>
              <kbd className="mx-0.5 rounded border px-1">↓</kbd>
              <kbd className="rounded border px-1">Enter</kbd> navegam,
              <kbd className="mx-1 rounded border px-1">+</kbd>/
              <kbd className="mx-1 rounded border px-1">−</kbd> incrementam. Tudo salva sozinho.
            </span>
            <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Mostrar só os convocados" : "Mostrar elenco inteiro"}
            </Button>
          </div>
          {gridPlayers.length ? (
            <StatGrid match={match} players={gridPlayers} />
          ) : (
            <EmptyState
              icon={Users2}
              title="Ninguém escalado nesta partida"
              description="Escolha quem entrou em quadra no menu Escalação."
              action={<Button variant="outline" onClick={() => setShowAll(true)}>Mostrar elenco inteiro</Button>}
            />
          )}
        </TabsContent>

        <TabsContent value="resumo" className="mt-4 space-y-4">
          {perPlayer.length === 0 ? (
            <EmptyState icon={Grid3x3} title="Nenhum lançamento nesta partida" description="Preencha a aba Lançamento." />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Pontos por jogador" subtitle="Ataque + saque + bloqueio">
                  <ResponsiveContainer width="100%" height={Math.max(200, perPlayer.length * 30)}>
                    <BarChart data={perPlayer} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid {...gridProps} vertical horizontal={false} />
                      <XAxis type="number" {...axisProps} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={78} {...axisProps} />
                      <Bar isAnimationActive={false} dataKey="pontos" radius={[0, 4, 4, 0]} barSize={14}>
                        {perPlayer.map((p) => (
                          <RCell key={p.id} fill={positionMeta(p.position).color} />
                        ))}
                      </Bar>
                      <RTooltip cursor={{ fill: "var(--accent)", opacity: 0.5 }} content={TipPontos} />
                    </BarChart>
                  </ResponsiveContainer>
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    {POSITIONS.filter((pos) => perPlayer.some((p) => p.position === pos.key)).map((pos) => (
                      <li key={pos.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: pos.color }} />
                        {pos.plural}
                      </li>
                    ))}
                  </ul>
                </ChartCard>

                <ChartCard title="Distribuição do levantamento" subtitle="Para onde a bola foi nesta partida">
                  {targets.every((d) => d.value === 0) ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Sem levantamentos lançados nesta partida.
                    </p>
                  ) : (
                    <div className="space-y-3 pt-2">
                      <div className="flex h-9 w-full overflow-hidden rounded-lg">
                        {targets.map((d, i) =>
                          d.value === 0 ? null : (
                            <div
                              key={d.key}
                              className="flex items-center justify-center border-r-2 border-card text-[11px] font-semibold text-white last:border-r-0"
                              style={{ width: `${d.share * 100}%`, background: seriesColor(i) }}
                              title={`${d.label}: ${d.value}`}
                            >
                              {d.share > 0.09 ? fmtPct(d.share) : ""}
                            </div>
                          ),
                        )}
                      </div>
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {targets.map((d, i) => (
                          <li key={d.key} className="min-w-0 rounded-lg border px-3 py-2.5">
                            <div className="flex items-baseline gap-2 whitespace-nowrap">
                              <span className="size-2.5 shrink-0 translate-y-px rounded-[3px]" style={{ background: seriesColor(i) }} />
                              <span className="text-xs text-muted-foreground">{d.label}</span>
                              <span className="num ml-auto text-lg font-semibold tabular-nums">{d.value}</span>
                              <span className="text-[11px] text-muted-foreground">{fmtPct(d.share)}</span>
                            </div>
                            {d.receivers.length ? (
                              <ul className="mt-2 space-y-1.5">
                                {d.receivers.map((r) => (
                                  <li key={r.player.id} className="flex items-center gap-2 whitespace-nowrap text-xs">
                                    <Link
                                      to={`/jogador/${r.player.id}`}
                                      className="min-w-0 flex-1 truncate text-muted-foreground hover:text-foreground hover:underline"
                                    >
                                      {r.player.name}
                                    </Link>
                                    <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted sm:w-20">
                                      <span
                                        className="block h-full rounded-full"
                                        style={{ width: `${r.share * 100}%`, background: seriesColor(i) }}
                                      />
                                    </span>
                                    <span className="num w-8 shrink-0 text-right tabular-nums text-foreground">
                                      ~{r.estimate}
                                    </span>
                                    <span className="num w-9 shrink-0 text-right tabular-nums text-muted-foreground">
                                      {fmtPct(r.share)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-1.5 text-[11px] text-muted-foreground">Sem ataques lançados nesta zona.</p>
                            )}
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground">
                        O lançamento registra a zona, não o recebedor. A divisão por jogador é
                        estimada pela fatia de cada um nas tentativas de ataque daquela posição —
                        por isso o «~».
                      </p>
                    </div>
                  )}
                </ChartCard>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <TeamProfileCard match={match} seasonMatches={allMatches} />
                <PointsCompositionCard totals={totals} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <AttackOutcomeCard totals={totals} />
                <PointOriginsCard matches={[match]} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ErrorBreakdownCard totals={totals} />
                <ReceptionCard totals={totals} />
              </div>

              <PlayerBalanceCard match={match} players={allPlayers} />

              <PositionEfficiencyCard
                players={allPlayers}
                matches={[match]}
                subtitle="Nesta partida, cada posição julgada pelo que ela tem que fazer bem — não dá para comparar um líbero com um oposto pelo número de pontos."
              />

              <section className="overflow-hidden rounded-xl border bg-card">
                <header className="border-b px-4 py-2.5">
                  <h3 className="text-sm font-semibold">Boletim da partida</h3>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Jogador</th>
                        <th className="px-3 py-2 text-right font-medium">Em quadra</th>
                        <th className="px-3 py-2 text-right font-medium">Pontos</th>
                        <th className="px-3 py-2 text-right font-medium">Pts/25</th>
                        <th className="px-3 py-2 text-right font-medium">Erros</th>
                        <th className="px-3 py-2 text-right font-medium">Saldo</th>
                        <th className="px-3 py-2 text-right font-medium">Ataque</th>
                        <th className="px-3 py-2 text-right font-medium">Aces</th>
                        <th className="px-3 py-2 text-right font-medium">Defesas</th>
                        <th className="px-3 py-2 text-right font-medium">Blocks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perPlayer.map((p) => (
                        <tr key={p.id} className="border-b last:border-b-0 hover:bg-accent/30">
                          <td className="px-4 py-2">
                            <Link to={`/jogador/${p.id}`} className="flex items-center gap-2 hover:underline">
                              <span className="font-medium">{p.name}</span>
                              <PositionBadge position={p.position} />
                            </Link>
                          </td>
                          <td className="num px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {p.participacao === null ? "—" : fmtPct(p.participacao)}
                          </td>
                          <td className="num px-3 py-2 text-right font-medium tabular-nums">{p.pontos}</td>
                          <td className="num px-3 py-2 text-right tabular-nums">
                            {p.pontosJogados > 0 ? fmtNum(p.pontosPor25, 1) : "—"}
                          </td>
                          <td className="num px-3 py-2 text-right tabular-nums text-muted-foreground">{p.erros}</td>
                          <td className={cn("num px-3 py-2 text-right font-medium tabular-nums",
                            p.saldo > 0 ? "text-[var(--success)]" : p.saldo < 0 ? "text-destructive" : "")}>
                            {p.saldo > 0 ? `+${p.saldo}` : p.saldo}
                          </td>
                          <td className="num px-3 py-2 text-right tabular-nums">
                            {p.medeAtaque && p.ataqueTentativas ? fmtPct(p.ataqueEficiencia) : "—"}
                          </td>
                          <td className="num px-3 py-2 text-right tabular-nums">{p.saqueAces || "—"}</td>
                          <td className="num px-3 py-2 text-right tabular-nums">{p.defesas || "—"}</td>
                          <td className="num px-3 py-2 text-right tabular-nums">{p.blocks || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 bg-muted/40 font-medium">
                      <tr>
                        <td className="px-4 py-2.5">Total do time</td>
                        <td className="num px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {rallies > 0 ? rallies : "—"}
                        </td>
                        <td className="num px-3 py-2.5 text-right tabular-nums">{k.pontos}</td>
                        <td className="num px-3 py-2.5 text-right tabular-nums text-muted-foreground">—</td>
                        <td className="num px-3 py-2.5 text-right tabular-nums">{k.erros}</td>
                        <td className={cn("num px-3 py-2.5 text-right tabular-nums",
                          k.pontos - k.erros > 0 ? "text-[var(--success)]" : k.pontos - k.erros < 0 ? "text-destructive" : "")}>
                          {fmtSigned(k.pontos - k.erros)}
                        </td>
                        <td className="num px-3 py-2.5 text-right tabular-nums">
                          {k.ataqueTentativas ? fmtPct(k.ataqueEficiencia) : "—"}
                        </td>
                        <td className="num px-3 py-2.5 text-right tabular-nums">{k.saqueAces}</td>
                        <td className="num px-3 py-2.5 text-right tabular-nums">{k.defesas}</td>
                        <td className="num px-3 py-2.5 text-right tabular-nums">{k.blocks}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                  «Pontos disputados» não soma entre jogadores — vários estão em quadra ao mesmo
                  tempo, então o total é o da partida. «Pts/25» também não soma, por ser uma média.
                </p>
              </section>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

const TipPontos = makeTooltip((payload) => {
  const d = payload[0]?.payload
  return {
    title: d?.name,
    rows: [
      { label: "Pontos", value: d?.pontos ?? 0, color: positionMeta(d.position).color },
      { label: "Erros", value: d?.erros ?? 0 },
      { label: "Ataque", value: d?.ataqueTentativas ? fmtPct(d.ataqueEficiencia) : "—" },
    ],
  }
})
