import { useEffect, useRef, useState } from "react"
import { format, parse } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Match, MatchSet } from "@/lib/types"
import { useTeamStore } from "@/store/useTeamStore"

const MAX_SETS = 5
const emptySet = (): MatchSet => ({ us: 0, them: 0 })
const today = () => new Date().toISOString().slice(0, 10)
const toDate = (iso: string) => parse(iso, "yyyy-MM-dd", new Date())
const toIso = (d: Date) => format(d, "yyyy-MM-dd")

/**
 * Campo de placar: dígitos apenas, sem spinner nativo (que produz "025"),
 * seleciona tudo ao focar, ↑↓ ajustam de 1 em 1 e pula para o próximo aos 2 dígitos.
 */
function ScoreBox({
  value,
  onChange,
  onFilled,
  label,
  winner,
  inputRef,
}: {
  value: number
  onChange: (v: number) => void
  onFilled?: () => void
  label: string
  winner: boolean
  inputRef?: React.Ref<HTMLInputElement>
}) {
  return (
    <input
      ref={inputRef}
      aria-label={label}
      inputMode="numeric"
      autoComplete="off"
      maxLength={2}
      value={value === 0 ? "" : String(value)}
      placeholder="0"
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 2)
        onChange(Number(digits) || 0)
        if (digits.length === 2) onFilled?.()
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(99, value + 1)) }
        if (e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(0, value - 1)) }
      }}
      className={cn(
        "num h-11 w-16 rounded-lg border bg-transparent text-center text-lg font-semibold tabular-nums",
        "outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground/40",
        "focus:border-ring focus:ring-2 focus:ring-ring/40",
        winner ? "border-[var(--success)]/50 bg-[var(--success)]/8" : "border-input",
      )}
    />
  )
}

export function MatchFormDialog({
  match,
  trigger,
  onSaved,
}: {
  match?: Match
  trigger: React.ReactNode
  onSaved?: (id: string) => void
}) {
  const addMatch = useTeamStore((s) => s.addMatch)
  const updateMatch = useTeamStore((s) => s.updateMatch)

  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(today())
  const [opponent, setOpponent] = useState("")
  const [competition, setCompetition] = useState("")
  const [location, setLocation] = useState<"casa" | "fora">("casa")
  const [sets, setSets] = useState<MatchSet[]>([emptySet()])
  const [dateOpen, setDateOpen] = useState(false)
  const usRefs = useRef<(HTMLInputElement | null)[]>([])
  const themRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!open) return
    if (match) {
      setDate(match.date)
      setOpponent(match.opponent)
      setCompetition(match.competition ?? "")
      setLocation(match.location ?? "casa")
      setSets(match.sets.length > 0 ? match.sets.map((s) => ({ ...s })) : [emptySet()])
    } else {
      setDate(today())
      setOpponent("")
      setCompetition("")
      setLocation("casa")
      setSets([emptySet()])
    }
  }, [open, match])

  const setsWon = sets.filter((s) => s.us > s.them).length
  const setsLost = sets.filter((s) => s.them > s.us).length
  const hasScoredSet = sets.some((s) => s.us > 0 || s.them > 0)
  const isWin = setsWon >= setsLost

  const canSave = opponent.trim().length > 0 && hasScoredSet

  function updateSet(i: number, patch: Partial<MatchSet>) {
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  function addSet() {
    setSets((prev) => {
      if (prev.length >= MAX_SETS) return prev
      requestAnimationFrame(() => usRefs.current[prev.length]?.focus())
      return [...prev, emptySet()]
    })
  }

  function removeSet(i: number) {
    setSets((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)))
  }

  function handleSave() {
    if (!canSave) return
    const payload = {
      date,
      opponent: opponent.trim(),
      competition: competition.trim() || undefined,
      location,
      sets,
    }
    if (match) {
      updateMatch(match.id, payload)
      toast.success("Partida atualizada")
      setOpen(false)
      onSaved?.(match.id)
    } else {
      const id = addMatch(payload)
      toast.success("Partida criada")
      setOpen(false)
      onSaved?.(id)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{match ? "Editar partida" : "Nova partida"}</DialogTitle>
          <DialogDescription>
            Preencha os dados da partida e o placar de cada set.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start px-3 font-normal"
                  >
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    {format(toDate(date), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    locale={ptBR}
                    captionLayout="dropdown"
                    formatters={{
                      formatMonthDropdown: (d) => {
                        const m = format(d, "LLL", { locale: ptBR }).replace(".", "")
                        return m.charAt(0).toUpperCase() + m.slice(1)
                      },
                    }}
                    startMonth={new Date(2015, 0)}
                    endMonth={new Date(new Date().getFullYear() + 1, 11)}
                    selected={toDate(date)}
                    defaultMonth={toDate(date)}
                    onSelect={(d) => {
                      if (!d) return
                      setDate(toIso(d))
                      setDateOpen(false)
                    }}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Local</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                value={location}
                onValueChange={(v) => v && setLocation(v as "casa" | "fora")}
                className="w-full"
              >
                <ToggleGroupItem value="casa" className="flex-1">
                  Casa
                </ToggleGroupItem>
                <ToggleGroupItem value="fora" className="flex-1">
                  Fora
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="match-opponent">Adversário</Label>
            <Input
              id="match-opponent"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              placeholder="Nome do time adversário"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="match-competition">Competição</Label>
            <Input
              id="match-competition"
              value={competition}
              onChange={(e) => setCompetition(e.target.value)}
              placeholder="Ex.: Campeonato Estadual"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Sets</Label>
              {hasScoredSet ? (
                <span
                  className={cn(
                    "num text-xs font-semibold",
                    isWin ? "text-[var(--success)]" : "text-destructive",
                  )}
                >
                  {isWin ? "Vitória" : "Derrota"} {setsWon}—{setsLost}
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 pl-14 text-[11px] uppercase tracking-wider text-muted-foreground">
                <span className="w-16 text-center">Nós</span>
                <span className="w-4" />
                <span className="w-16 text-center">Eles</span>
              </div>
              {sets.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-xs text-muted-foreground">Set {i + 1}</span>
                  <ScoreBox
                    label={`Set ${i + 1} — nossos pontos`}
                    value={s.us}
                    winner={s.us > s.them}
                    onChange={(v) => updateSet(i, { us: v })}
                    onFilled={() => themRefs.current[i]?.focus()}
                    inputRef={(el) => { usRefs.current[i] = el }}
                  />
                  <span className="w-4 text-center text-muted-foreground">×</span>
                  <ScoreBox
                    label={`Set ${i + 1} — pontos do adversário`}
                    value={s.them}
                    winner={s.them > s.us}
                    onChange={(v) => updateSet(i, { them: v })}
                    inputRef={(el) => { themRefs.current[i] = el }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    disabled={sets.length <= 1}
                    onClick={() => removeSet(i)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSet}
              disabled={sets.length >= MAX_SETS}
            >
              <Plus /> Adicionar set
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
