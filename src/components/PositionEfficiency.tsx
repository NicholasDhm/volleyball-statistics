import { POSITIONS, positionMeta } from "@/lib/stats"
import { kpis, playerTotals, playerMatches, fmtPct, fmtNum, type Kpis } from "@/lib/analytics"
import { ChartCard } from "@/components/charts/chart-kit"
import { cn } from "@/lib/utils"
import type { Match, Player, Position } from "@/lib/types"

/**
 * O que julga cada posição, no fundamento que ela de fato precisa fazer bem — não em pontos.
 * Exportado para quem mais precisar da mesma régua (ex: rankings por posição).
 */
export const POSITION_METRIC: Record<
  Position,
  {
    label: string
    unit: string
    note: string
    format: (n: number) => string
    get: (k: Kpis) => number | null
  }
> = {
  levantador: {
    label: "Distribuição",
    unit: "levantamentos a cada 25 pontos disputados",
    note: "Mede o volume de jogo que passa pela mão do levantador, não a qualidade da escolha.",
    format: (n) => fmtNum(n, 1),
    get: (k) => (k.pontosJogados === 0 ? null : (k.levantamentos / k.pontosJogados) * 25),
  },
  libero: {
    label: "Nota de passe",
    unit: "0 a 100",
    note: "Passe A vale 3, B vale 2, C vale 1 — a nota resume a qualidade da recepção.",
    format: (n) => fmtNum(n, 1),
    get: (k) => k.passeNota,
  },
  ponta: {
    label: "Eficiência de ataque",
    unit: "%",
    note: "(pontos de ataque − erros de ataque) ÷ tentativas de ataque.",
    format: (n) => fmtPct(n, 1),
    get: (k) => (k.ataqueTentativas === 0 ? null : k.ataqueEficiencia),
  },
  oposto: {
    label: "Eficiência de ataque",
    unit: "%",
    note: "(pontos de ataque − erros de ataque) ÷ tentativas de ataque.",
    format: (n) => fmtPct(n, 1),
    get: (k) => (k.ataqueTentativas === 0 ? null : k.ataqueEficiencia),
  },
  central: {
    label: "Bloqueio",
    unit: "blocks a cada 25 pontos disputados",
    note: "O central é o dono da rede — mede o quanto ele trava o ataque adversário.",
    format: (n) => fmtNum(n, 1),
    get: (k) => (k.pontosJogados === 0 ? null : k.blocksPor25),
  },
}

const DEFAULT_TITLE = "Eficiência por função"
const DEFAULT_SUBTITLE =
  "Cada posição é julgada pelo que ela tem que fazer bem — não dá para comparar um líbero com um oposto pelo número de pontos."

interface Row {
  player: Player
  value: number | null
}

export function PositionEfficiencyCard({
  players,
  matches,
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
}: {
  players: Player[]
  matches: Match[]
  title?: string
  subtitle?: string
}) {
  const blocks = POSITIONS.map((pos) => {
    const metric = POSITION_METRIC[pos.key]
    const rows: Row[] = players
      .filter((p) => p.position === pos.key)
      .filter((p) => playerMatches(matches, p.id).length > 0)
      .map((p) => ({ player: p, value: metric.get(kpis(playerTotals(matches, p.id))) }))
    return { pos, metric, rows }
  }).filter((b) => b.rows.length > 0)

  if (blocks.length === 0) {
    return (
      <ChartCard title={title} subtitle={subtitle}>
        <p className="py-8 text-center text-sm text-muted-foreground">
          Ainda não há dados suficientes para comparar as posições.
        </p>
      </ChartCard>
    )
  }

  return (
    <ChartCard title={title} subtitle={subtitle}>
      <div className="grid gap-5 lg:grid-cols-2">
        {blocks.map(({ pos, metric, rows }) => {
          const meta = positionMeta(pos.key)
          const withValue = rows.filter(
            (r): r is { player: Player; value: number } => r.value !== null,
          )
          const withoutValue = rows.filter((r) => r.value === null)
          const sorted = [...withValue].sort((a, b) => b.value - a.value)
          const max = sorted.length > 0 ? sorted[0].value : 0

          return (
            <div key={pos.key} className="space-y-2">
              <header className="flex items-center gap-1.5 text-sm font-medium">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                <span>
                  {meta.plural} · {metric.label} — {metric.unit}
                </span>
              </header>

              <div className="space-y-1.5">
                {sorted.map(({ player, value }) => (
                  <div key={player.id} className="flex items-center gap-2 text-xs">
                    <span className="w-[88px] shrink-0 truncate" title={player.name}>
                      {player.name}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0}%`,
                          background: meta.color,
                        }}
                      />
                    </div>
                    <span className="num w-14 shrink-0 text-right tabular-nums">
                      {metric.format(value)}
                    </span>
                  </div>
                ))}

                {withoutValue.map(({ player }) => (
                  <div
                    key={player.id}
                    className={cn("flex items-center gap-2 text-xs", "text-muted-foreground/60")}
                  >
                    <span className="w-[88px] shrink-0 truncate" title={player.name}>
                      {player.name}
                    </span>
                    <span className="flex-1 italic">sem dados suficientes</span>
                    <span className="w-14 shrink-0 text-right">—</span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] leading-snug text-muted-foreground">{metric.note}</p>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}
