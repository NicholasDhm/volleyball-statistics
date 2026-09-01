import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Link2Off } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { personCards } from "@/lib/analytics"
import { POSITIONS, positionMeta } from "@/lib/stats"
import type { Player, Position } from "@/lib/types"
import { useTeamStore, usePlayers } from "@/store/useTeamStore"

export function PlayerFormDialog({
  player,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  player?: Player
  trigger?: React.ReactNode
  /** Optional controlled mode — lets a caller drive the dialog (eg. from a dropdown menu item)
   *  without nesting a Dialog inside another portal-based component. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const addPlayer = useTeamStore((s) => s.addPlayer)
  const updatePlayer = useTeamStore((s) => s.updatePlayer)
  const addPositionToPlayer = useTeamStore((s) => s.addPositionToPlayer)
  const unlinkPlayer = useTeamStore((s) => s.unlinkPlayer)
  const players = usePlayers()

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = openProp ?? uncontrolledOpen
  const setOpen = onOpenChangeProp ?? setUncontrolledOpen

  const [name, setName] = useState(player?.name ?? "")
  const [position, setPosition] = useState<Position>(player?.position ?? "ponta")
  const [number, setNumber] = useState(player?.number != null ? String(player.number) : "")
  const [active, setActive] = useState(player?.active ?? true)
  const [newPosition, setNewPosition] = useState<Position | "">("")
  const [newNumber, setNewNumber] = useState("")

  useEffect(() => {
    if (!open) return
    setName(player?.name ?? "")
    setPosition(player?.position ?? "ponta")
    setNumber(player?.number != null ? String(player.number) : "")
    setActive(player?.active ?? true)
    setNewPosition("")
    setNewNumber("")
  }, [open, player])

  const otherCards = player ? personCards(players, player).filter((c) => c.id !== player.id) : []
  const takenPositions = new Set(
    player ? personCards(players, player).map((c) => c.position) : [],
  )
  const availablePositions = POSITIONS.filter((p) => !takenPositions.has(p.key))

  function handleAddPosition() {
    if (!player || !newPosition) return
    addPositionToPlayer(player.id, newPosition, newNumber.trim() === "" ? undefined : Number(newNumber))
    toast.success(`Posição ${positionMeta(newPosition).label} adicionada`)
    setNewPosition("")
    setNewNumber("")
  }

  function handleUnlink(card: Player) {
    unlinkPlayer(card.id)
    toast.success(`${card.name} desvinculado`, {
      description: "Essa ficha virou um jogador separado e manteve as estatísticas.",
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    const patch = {
      name: trimmed,
      position,
      number: number.trim() === "" ? undefined : Number(number),
      active,
    }

    if (player) {
      updatePlayer(player.id, patch)
      toast.success("Jogador atualizado")
    } else {
      addPlayer(patch)
      toast.success("Jogador adicionado ao elenco")
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{player ? "Editar jogador" : "Novo jogador"}</DialogTitle>
            <DialogDescription>
              {player ? "Atualize os dados do jogador." : "Adicione um jogador ao elenco."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="player-name">Nome</Label>
              <Input
                id="player-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do jogador"
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="player-position">Posição</Label>
                <Select value={position} onValueChange={(v) => setPosition(v as Position)}>
                  <SelectTrigger id="player-position" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        <span className="size-2 shrink-0 rounded-[3px]" style={{ background: p.color }} />
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="player-number">Número</Label>
                <Input
                  id="player-number"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="—"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <Label htmlFor="player-active" className="cursor-pointer">
                Em atividade
              </Label>
              <Switch id="player-active" checked={active} onCheckedChange={setActive} />
            </div>

            {player ? (
              <>
                <Separator />
                <div className="grid gap-3">
                  <div>
                    <p className="text-sm font-medium">Outras posições</p>
                    <p className="text-xs text-muted-foreground">
                      Cada posição é uma ficha separada nas estatísticas — dá para ver tudo junto
                      na página do jogador.
                    </p>
                  </div>

                  {otherCards.length > 0 && (
                    <div className="grid gap-1.5">
                      {otherCards.map((card) => (
                        <div
                          key={card.id}
                          className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <span
                              className="size-2 shrink-0 rounded-[3px]"
                              style={{ background: positionMeta(card.position).color }}
                            />
                            <span>{positionMeta(card.position).label}</span>
                            {card.number != null ? (
                              <span className="num text-muted-foreground">#{card.number}</span>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => handleUnlink(card)}
                          >
                            <Link2Off /> Desvincular
                          </Button>
                        </div>
                      ))}
                      <p className="text-[11px] text-muted-foreground">
                        Desvincular transforma a ficha num jogador separado e mantém as
                        estatísticas dela.
                      </p>
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <div className="grid flex-1 gap-1.5">
                      <Label htmlFor="add-position">Adicionar posição</Label>
                      <Select
                        value={newPosition}
                        onValueChange={(v) => setNewPosition(v as Position)}
                        disabled={availablePositions.length === 0}
                      >
                        <SelectTrigger id="add-position" className="w-full">
                          <SelectValue placeholder="Posição" />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePositions.map((p) => (
                            <SelectItem key={p.key} value={p.key}>
                              <span
                                className="size-2 shrink-0 rounded-[3px]"
                                style={{ background: p.color }}
                              />
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid w-20 gap-1.5">
                      <Label htmlFor="add-position-number">Número</Label>
                      <Input
                        id="add-position-number"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={newNumber}
                        onChange={(e) => setNewNumber(e.target.value)}
                        placeholder="—"
                        disabled={availablePositions.length === 0}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!newPosition || availablePositions.length === 0}
                      onClick={handleAddPosition}
                    >
                      Adicionar
                    </Button>
                  </div>
                  {availablePositions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Todas as posições já têm uma ficha para esta pessoa.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit">{player ? "Salvar alterações" : "Adicionar jogador"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
