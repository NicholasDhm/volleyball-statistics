import { cn } from "@/lib/utils"

/** Validated categorical palette (see index.css --chart-1..5). Assign in fixed order, never cycled. */
export const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const

export const seriesColor = (i: number) => SERIES[i % SERIES.length]

export const axisProps = {
  stroke: "var(--border)",
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const

export const gridProps = {
  stroke: "var(--border)",
  strokeDasharray: "3 3",
  vertical: false,
} as const

export function ChartCard({
  title,
  subtitle,
  legend,
  children,
  className,
  action,
}: {
  title: string
  subtitle?: string
  legend?: React.ReactNode
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <section className={cn("flex flex-col rounded-xl border bg-card p-4", className)}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {legend ? <div className="mb-3">{legend}</div> : null}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
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

interface TipRow { label: string; value: React.ReactNode; color?: string }

export function TooltipShell({ title, rows }: { title?: React.ReactNode; rows: TipRow[] }) {
  return (
    <div className="pointer-events-none rounded-lg border bg-popover/95 px-3 py-2 shadow-lg backdrop-blur">
      {title ? <div className="mb-1.5 text-xs font-semibold">{title}</div> : null}
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 text-xs">
            {r.color ? (
              <span className="size-2 rounded-[2px]" style={{ background: r.color }} />
            ) : null}
            <span className="text-muted-foreground">{r.label}</span>
            <span className="num ml-auto font-medium tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Recharts content={} adapter. */
export function makeTooltip(
  fmt: (payload: readonly any[], label: any) => { title?: React.ReactNode; rows: TipRow[] },
) {
  return function Tip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    const { title, rows } = fmt(payload, label)
    return <TooltipShell title={title} rows={rows} />
  }
}
