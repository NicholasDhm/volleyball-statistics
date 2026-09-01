import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  LabelList,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ChartCard, Legend, axisProps, gridProps, makeTooltip, seriesColor } from "@/components/charts/chart-kit"
import { RALLY_STAT } from "@/lib/stats"
import type { Match, Player } from "@/lib/types"
import {
  attackOutcome,
  errorBreakdown,
  fmtNum,
  fmtPct,
  kpis,
  matchRallies,
  matchTotals,
  playerMatchTotals,
  pointOrigins,
  receptionBreakdown,
  t,
  teamTotals,
  totalRallies,
  type Totals,
} from "@/lib/analytics"

/** Barra horizontal 100% empilhada, com rótulo interno só quando cabe. */
function StackedBar({ rows, colors }: { rows: { key: string; label: string; value: number; share: number }[]; colors: string[] }) {
  return (
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
  )
}

function StackedFigures({ rows, colors }: { rows: { key: string; label: string; value: number; share: number }[]; colors: string[] }) {
  return (
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
  )
}

export function AttackOutcomeCard({ totals }: { totals: Totals }) {
  const { rows, total } = attackOutcome(totals)
  const colors = [seriesColor(0), seriesColor(1), "var(--muted-foreground)", seriesColor(4), "var(--destructive)"]
  return (
    <ChartCard title="Desfecho dos ataques" subtitle="O que aconteceu com cada bola atacada">
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum ataque lançado ainda.</p>
      ) : (
        <div className="space-y-3 pt-2">
          <StackedBar rows={rows} colors={colors} />
          <StackedFigures rows={rows} colors={colors} />
          <p className="text-[11px] text-muted-foreground">
            «Adversário defendeu» não é ponto nem erro — o rally continuou.
          </p>
        </div>
      )}
    </ChartCard>
  )
}

export function PointOriginsCard({ matches }: { matches: Match[] }) {
  const { rows, placar } = pointOrigins(matches)
  const colors = [seriesColor(0), seriesColor(1), seriesColor(2), seriesColor(3), "var(--muted-foreground)"]
  return (
    <ChartCard
      title="De onde vieram os pontos do placar"
      subtitle={`${fmtNum(placar)} pontos no placar desta partida`}
    >
      {placar === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Sem placar lançado nesta partida.</p>
      ) : (
        <div className="space-y-3 pt-2">
          <StackedBar rows={rows} colors={colors} />
          <StackedFigures rows={rows} colors={colors} />
          <p className="text-[11px] text-muted-foreground">
            Ponto aqui é ponto no placar mesmo — não é acerto de movimento.
          </p>
        </div>
      )}
    </ChartCard>
  )
}

const errorTooltip = (rows: ReturnType<typeof errorBreakdown>["rows"], total: number) =>
  makeTooltip((payload) => {
    const p = payload[0]
    const row = rows.find((r) => r.label === p?.payload?.label)
    if (!row) return { rows: [] }
    return {
      title: row.label,
      rows: [
        { label: "Erros", value: fmtNum(row.value), color: "var(--destructive)" },
        { label: "Do total de erros", value: total > 0 ? fmtPct(row.value / total) : "—" },
      ],
    }
  })

export function ErrorBreakdownCard({ totals }: { totals: Totals }) {
  const { rows, total } = errorBreakdown(totals)
  const tooltip = errorTooltip(rows, total)
  return (
    <ChartCard title="Erros cometidos" subtitle="Cada erro é um ponto entregue ao adversário">
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum erro lançado ainda.</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid {...gridProps} vertical horizontal={false} />
            <XAxis type="number" {...axisProps} allowDecimals={false} />
            <YAxis type="category" dataKey="label" width={70} {...axisProps} />
            <RTooltip cursor={{ fill: "var(--accent)", opacity: 0.5 }} content={tooltip} />
            <Bar
              isAnimationActive={false}
              dataKey="value"
              fill="var(--destructive)"
              radius={[0, 4, 4, 0]}
              barSize={14}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}

export function ReceptionCard({ totals }: { totals: Totals }) {
  const { rows, total, graded } = receptionBreakdown(totals)
  const colors = graded
    ? [seriesColor(1), seriesColor(2), seriesColor(3), "var(--destructive)"]
    : [seriesColor(1), "var(--destructive)"]
  return (
    <ChartCard title="Recepção" subtitle="Qualidade do passe">
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma recepção lançada ainda.</p>
      ) : (
        <div className="space-y-3 pt-2">
          <StackedBar rows={rows} colors={colors} />
          <StackedFigures rows={rows} colors={colors} />
        </div>
      )}
    </ChartCard>
  )
}

interface BalanceRow {
  id: string
  name: string
  pontos: number
  erros: number
  saldo: number
  pontosJogados: number
}

const balanceTooltip = (rally: number) =>
  makeTooltip((payload) => {
    const d = payload[0]?.payload as BalanceRow | undefined
    if (!d) return { rows: [] }
    return {
      title: d.name,
      rows: [
        { label: "Pontos", value: fmtNum(d.pontos), color: seriesColor(0) },
        { label: "Erros", value: fmtNum(d.erros), color: "var(--destructive)" },
        { label: "Saldo", value: fmtNum(d.saldo) },
        {
          label: "Em quadra",
          value: rally > 0 && d.pontosJogados > 0 ? fmtPct(Math.min(d.pontosJogados / rally, 1)) : "—",
        },
      ],
    }
  })

export function PlayerBalanceCard({ match, players }: { match: Match; players: Player[] }) {
  const rally = matchRallies(match)
  const rows: BalanceRow[] = players
    .map((p) => {
      const totals = playerMatchTotals(match, p.id)
      const k = kpis(totals)
      return {
        id: p.id,
        name: p.name,
        pontos: k.pontos,
        erros: k.erros,
        saldo: k.saldo,
        // quanto do que ele produziu foi ponto, e não erro
        aproveitamento: k.pontos + k.erros > 0 ? k.pontos / (k.pontos + k.erros) : null,
        pontosJogados: t(totals, RALLY_STAT),
      }
    })
    .filter((r) => r.pontos > 0 || r.erros > 0)
    .sort((a, b) => b.pontos - a.pontos)

  const tooltip = balanceTooltip(rally)

  return (
    <ChartCard
      title="Pontos × erros por jogador"
      subtitle="Barras lado a lado. O % em cima é o aproveitamento: pontos ÷ (pontos + erros)."
      legend={
        <Legend
          items={[
            { label: "Pontos", color: seriesColor(0) },
            { label: "Erros", color: "var(--destructive)" },
          ]}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum lançamento nesta partida.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={rows} margin={{ left: 8, right: 16, top: 8, bottom: 40 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axisProps} angle={-35} textAnchor="end" interval={0} height={70} />
            <YAxis type="number" allowDecimals={false} {...axisProps} />
            <RTooltip cursor={{ fill: "var(--accent)", opacity: 0.5 }} content={tooltip} />
            <Bar isAnimationActive={false} dataKey="pontos" name="Pontos" fill={seriesColor(0)} radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="aproveitamento"
                position="top"
                offset={8}
                fill="var(--muted-foreground)"
                fontSize={11}
                formatter={(v: unknown) => (typeof v === "number" ? fmtPct(v) : "")}
              />
            </Bar>
            <Bar isAnimationActive={false} dataKey="erros" name="Erros" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}

interface ProfileAxis {
  key: string
  label: string
  /** o que está sendo contado — sem isso "9,3 em Passe" parece 9,3 pontos */
  noun: (n: number) => string
  get: (x: Totals) => number
}

const PROFILE_AXES: ProfileAxis[] = [
  { key: "ataque", label: "Ataque", noun: (n) => (n === 1 ? "ponto de ataque" : "pontos de ataque"), get: (x) => t(x, "ataque_certo") + t(x, "largada") },
  { key: "saque", label: "Saque", noun: (n) => (n === 1 ? "ace" : "aces"), get: (x) => t(x, "saque_certo") },
  { key: "passe", label: "Passe", noun: (n) => (n === 1 ? "passe certo" : "passes certos"), get: (x) => t(x, "passe_certo") + t(x, "passe_a") + t(x, "passe_b") },
  { key: "defesa", label: "Defesa", noun: (n) => (n === 1 ? "defesa" : "defesas"), get: (x) => t(x, "def_certa") },
  { key: "bloqueio", label: "Bloqueio", noun: (n) => (n === 1 ? "block" : "blocks"), get: (x) => t(x, "block_pro") },
  { key: "cobertura", label: "Cobertura", noun: (n) => (n === 1 ? "cobertura" : "coberturas"), get: (x) => t(x, "cobertura") },
]

export function TeamProfileCard({ match, seasonMatches }: { match: Match; seasonMatches: Match[] }) {
  const matchTotalsX = matchTotals(match)
  const matchRallyCount = matchRallies(match)
  const seasonTotalsX = teamTotals(seasonMatches)
  const seasonRallyCount = totalRallies(seasonMatches)

  const byRally = matchRallyCount > 0 && seasonRallyCount > 0
  const unit = byRally ? "a cada 25 pontos disputados" : "por partida"

  const rateEsta = (get: (x: Totals) => number) =>
    byRally ? (get(matchTotalsX) / matchRallyCount) * 25 : get(matchTotalsX)
  const rateMedia = (get: (x: Totals) => number) =>
    byRally
      ? (get(seasonTotalsX) / seasonRallyCount) * 25
      : seasonMatches.length > 0
        ? get(seasonTotalsX) / seasonMatches.length
        : 0

  const radarData = PROFILE_AXES.map((axis) => {
    const esta = rateEsta(axis.get)
    const media = rateMedia(axis.get)
    const max = Math.max(esta, media)
    return {
      subject: axis.label,
      esta: max > 0 ? (esta / max) * 100 : 0,
      media: max > 0 ? (media / max) * 100 : 0,
      raw: { esta, media },
      noun: axis.noun,
    }
  })

  const tooltip = makeTooltip((payload) => {
    const row = payload[0]?.payload as
      | { subject: string; raw: { esta: number; media: number }; noun: (n: number) => string }
      | undefined
    if (!row) return { rows: [] }
    const say = (n: number) => `${fmtNum(n, 1)} ${row.noun(n)} ${unit}`
    return {
      title: row.subject,
      rows: [
        { label: "Esta partida", value: say(row.raw.esta), color: seriesColor(0) },
        { label: "Média da temporada", value: say(row.raw.media), color: seriesColor(1) },
      ],
    }
  })

  return (
    <ChartCard
      title="Perfil do time nesta partida"
      subtitle="Onde fomos fortes e fracos, comparado com a média da temporada"
      legend={
        <Legend
          items={[
            { label: "Esta partida", color: seriesColor(0) },
            { label: "Média da temporada", color: seriesColor(1) },
          ]}
        />
      }
    >
      <p className="mb-2 text-[11px] text-muted-foreground">
        Índice 0-100 relativo ao maior dos dois; o valor bruto aparece no tooltip.
        {byRally ? null : " Sem dado de participação suficiente na temporada — usando médias por partida."}
      </p>
      <ResponsiveContainer width="100%" height={340}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <RTooltip content={tooltip} />
          <Radar
            isAnimationActive={false}
            name="Esta partida"
            dataKey="esta"
            stroke={seriesColor(0)}
            fill={seriesColor(0)}
            fillOpacity={0.18}
            strokeWidth={2}
          />
          <Radar
            isAnimationActive={false}
            name="Média da temporada"
            dataKey="media"
            stroke={seriesColor(1)}
            strokeOpacity={0.7}
            fill={seriesColor(1)}
            fillOpacity={0.08}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function PointsCompositionCard({ totals }: { totals: Totals }) {
  const k = kpis(totals)
  const rows = [
    { key: "ataque", label: "Ataque", value: t(totals, "ataque_certo") },
    { key: "largada", label: "Largada", value: t(totals, "largada") },
    { key: "saque", label: "Saque", value: t(totals, "saque_certo") },
    { key: "bloqueio", label: "Bloqueio", value: t(totals, "block_pro") },
  ]
  const total = rows.reduce((s, r) => s + r.value, 0)


  return (
    <ChartCard title="Composição dos pontos" subtitle="De onde saíram os pontos que o time conquistou">
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum ponto conquistado ainda.</p>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={62}
                  outerRadius={95}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {rows.map((r, i) => (
                    <Cell key={r.key} fill={seriesColor(i)} stroke="var(--card)" strokeWidth={2} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="num text-2xl font-semibold tabular-nums">{fmtNum(k.pontos)}</span>
              <span className="text-[11px] text-muted-foreground">pontos conquistados</span>
            </div>
          </div>
          <Legend
            items={rows.map((r, i) => ({
              label: `${r.label} · ${fmtNum(r.value)} (${total > 0 ? fmtPct(r.value / total) : "—"})`,
              color: seriesColor(i),
            }))}
          />
        </div>
      )}
    </ChartCard>
  )
}
