import { Fragment, useCallback, useMemo, useRef } from "react"
import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { POSITIONS, POSITION_STATS, RALLY_STAT, STATS, STAT_GROUP_LABEL } from "@/lib/stats"
import type { Match, Player } from "@/lib/types"
import { useTeamStore } from "@/store/useTeamStore"
import { fmtPct, kpis, matchRallies, playerMatchTotals, t } from "@/lib/analytics"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface CellProps {
  value: number
  onChange: (v: number) => void
  onBump: (d: number) => void
  polarity: "positive" | "negative" | "neutral"
  coords: string
  onNav: (from: string, dx: number, dy: number) => void
}

function Cell({ value, onChange, onBump, polarity, coords, onNav }: CellProps) {
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const k = e.key
    if (k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight") {
      // let left/right work as text caret movement when the field has content selected
      if ((k === "ArrowLeft" || k === "ArrowRight") && !e.shiftKey) {
        const el = e.currentTarget
        const atEdge = k === "ArrowLeft" ? el.selectionStart === 0 : el.selectionStart === el.value.length
        if (!atEdge) return
      }
      e.preventDefault()
      onNav(coords, k === "ArrowLeft" ? -1 : k === "ArrowRight" ? 1 : 0, k === "ArrowUp" ? -1 : k === "ArrowDown" ? 1 : 0)
      return
    }
    if (k === "Enter") { e.preventDefault(); onNav(coords, 0, e.shiftKey ? -1 : 1) }
    if (k === "+" || (k === "=" && e.shiftKey)) { e.preventDefault(); onBump(1) }
    if (k === "-" || k === "_") { e.preventDefault(); onBump(-1) }
  }

  return (
    <div
      className={cn(
        "group/cell relative flex h-10 items-center justify-center transition-colors",
        value > 0 && polarity === "negative" && "bg-destructive/[0.07]",
        value > 0 && polarity === "positive" && "bg-primary/[0.06]",
      )}
    >
      <input
        data-cell={coords}
        inputMode="numeric"
        value={value === 0 ? "" : String(value)}
        placeholder="·"
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
        onKeyDown={handleKey}
        className={cn(
          "num h-full w-full bg-transparent text-center text-sm font-medium tabular-nums outline-none",
          "placeholder:text-muted-foreground/35",
          "focus:bg-primary/10 focus:ring-2 focus:ring-inset focus:ring-ring",
          value === 0 && "text-muted-foreground",
        )}
      />
      <button
        type="button" tabIndex={-1} aria-label="Diminuir"
        onMouseDown={(e) => { e.preventDefault(); onBump(-1) }}
        className={cn(
          "absolute inset-y-0 left-0 hidden w-7 place-items-center text-muted-foreground",
          "border-r border-border/60 bg-muted/60 hover:bg-accent hover:text-foreground active:bg-accent/80",
          "group-hover/cell:grid group-focus-within/cell:grid",
        )}
      >
        <Minus className="size-3.5" />
      </button>
      <button
        type="button" tabIndex={-1} aria-label="Aumentar"
        onMouseDown={(e) => { e.preventDefault(); onBump(1) }}
        className={cn(
          "absolute inset-y-0 right-0 hidden w-7 place-items-center text-muted-foreground",
          "border-l border-border/60 bg-muted/60 hover:bg-accent hover:text-foreground active:bg-accent/80",
          "group-hover/cell:grid group-focus-within/cell:grid",
        )}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}

export function StatGrid({ match, players }: { match: Match; players: Player[] }) {
  const setStat = useTeamStore((s) => s.setStat)
  const bumpStat = useTeamStore((s) => s.bumpStat)
  const rootRef = useRef<HTMLDivElement>(null)

  const sections = useMemo(
    () =>
      POSITIONS.map((pos) => ({
        pos,
        players: players.filter((p) => p.position === pos.key),
        rows: [RALLY_STAT, ...POSITION_STATS[pos.key]],
      })).filter((s) => s.players.length > 0),
    [players],
  )

  const nav = useCallback((from: string, dx: number, dy: number) => {
    const [sec, r, c] = from.split(":").map(Number)
    const target = `${sec}:${r + dy}:${c + dx}`
    const el = rootRef.current?.querySelector<HTMLInputElement>(`[data-cell="${target}"]`)
    if (el) { el.focus(); el.select() }
  }, [])

  return (
    <div ref={rootRef} className="space-y-6">
      {sections.map((section, si) => {
        const rallies = matchRallies(match)
        let rowIndex = -1
        let lastGroup = ""
        return (
          <section key={section.pos.key} className="overflow-hidden rounded-xl border bg-card">
            <header className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: section.pos.color }} />
              <h3 className="text-sm font-semibold">{section.pos.plural}</h3>
              <span className="text-xs text-muted-foreground">{section.players.length}</span>
            </header>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="sticky left-0 z-10 w-full min-w-[168px] bg-card px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Fundamento
                    </th>
                    {section.players.map((p) => {
                      const k = kpis(playerMatchTotals(match, p.id))
                      return (
                        <th key={p.id} className="w-[104px] min-w-[104px] border-l px-2 py-2 text-center align-bottom">
                          <div className="truncate text-sm font-semibold">{p.name}</div>
                          <div className="num text-[11px] font-normal tabular-nums text-muted-foreground">
                            {k.pontos} pts · {k.erros} err
                          </div>
                          <div className="num text-[11px] font-normal tabular-nums text-muted-foreground/80">
                            {rallies > 0 && k.pontosJogados > 0
                              ? `${fmtPct(Math.min(k.pontosJogados / rallies, 1))} em quadra`
                              : "—"}
                          </div>
                        </th>
                      )
                    })}
                    <th className="w-[72px] min-w-[72px] border-l bg-muted/30 px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((statKey) => {
                    rowIndex++
                    const def = STATS[statKey]
                    const groupHeader = def.group !== lastGroup ? def.group : null
                    lastGroup = def.group
                    const rowTotal =
                      statKey === RALLY_STAT
                        ? rallies
                        : section.players.reduce((s, p) => s + t(match.stats[p.id], statKey), 0)
                    const r = rowIndex
                    return (
                      <Fragment key={statKey}>
                        {groupHeader ? (
                          <tr className="bg-muted/25">
                            <td
                              colSpan={section.players.length + 2}
                              className="sticky left-0 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                            >
                              {STAT_GROUP_LABEL[groupHeader]}
                            </td>
                          </tr>
                        ) : null}
                        <tr className="border-b last:border-b-0 hover:bg-accent/25">
                          <td className="sticky left-0 z-10 bg-card px-3 py-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className={cn(
                                    "cursor-help border-b border-dashed border-transparent text-sm hover:border-border",
                                    def.polarity === "negative" && "text-muted-foreground",
                                  )}
                                >
                                  {def.label}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right">{def.help}</TooltipContent>
                            </Tooltip>
                          </td>
                          {section.players.map((p, ci) => (
                            <td key={p.id} className="border-l p-0">
                              <Cell
                                coords={`${si}:${r}:${ci}`}
                                value={match.stats[p.id]?.[statKey] ?? 0}
                                polarity={def.polarity}
                                onNav={nav}
                                onChange={(v) => setStat(match.id, p.id, statKey, v)}
                                onBump={(d) => bumpStat(match.id, p.id, statKey, d)}
                              />
                            </td>
                          ))}
                          <td className="num border-l bg-muted/30 px-2 text-center text-sm font-medium tabular-nums">
                            {rowTotal || <span className="text-muted-foreground/40">·</span>}
                          </td>
                        </tr>
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
