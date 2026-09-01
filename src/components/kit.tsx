import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { positionMeta } from "@/lib/stats"
import type { Position } from "@/lib/types"
import { TrendingDown, TrendingUp } from "lucide-react"

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function PositionBadge({ position, className }: { position: Position; className?: string }) {
  const meta = positionMeta(position)
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/70 bg-card px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      <span className="size-2 shrink-0 rounded-[3px]" style={{ background: meta.color }} />
      {meta.abbr}
    </span>
  )
}

export function StatTile({
  label,
  value,
  hint,
  delta,
  accent,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  delta?: number
  accent?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-4 transition-colors hover:border-border/90",
        className,
      )}
    >
      {accent ? (
        <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />
      ) : null}
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="num mt-1.5 flex items-baseline gap-2 text-2xl font-semibold tabular-nums">
        {value}
        {typeof delta === "number" && delta !== 0 ? (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              delta > 0 ? "text-[var(--success)]" : "text-destructive",
            )}
          >
            {delta > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {Math.abs(delta).toFixed(0)}
          </span>
        ) : null}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      {Icon ? <Icon className="mb-3 size-8 text-muted-foreground/60" /> : null}
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function ResultBadge({ win }: { win: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent font-semibold",
        win
          ? "bg-[var(--success)]/12 text-[var(--success)]"
          : "bg-destructive/12 text-destructive",
      )}
    >
      {win ? "V" : "D"}
    </Badge>
  )
}
