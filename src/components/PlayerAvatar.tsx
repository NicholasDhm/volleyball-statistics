import { cn } from "@/lib/utils"
import { positionMeta } from "@/lib/stats"
import type { Player } from "@/lib/types"

const SIZES: Record<"sm" | "md" | "lg", string> = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function PlayerAvatar({
  player,
  size = "md",
  className,
}: {
  player: Player
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const meta = positionMeta(player.position)
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border font-semibold",
        SIZES[size],
        className,
      )}
      style={{
        background: `color-mix(in oklab, ${meta.color} 16%, transparent)`,
        borderColor: `color-mix(in oklab, ${meta.color} 55%, transparent)`,
        color: meta.color,
      }}
    >
      {initials(player.name)}
    </span>
  )
}
