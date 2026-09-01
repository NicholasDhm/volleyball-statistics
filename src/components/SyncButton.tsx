import { useEffect, useRef, useState } from "react"
import { CloudUpload, CloudOff, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useTeamStore } from "@/store/useTeamStore"
import {
  fetchRemote,
  pushRemote,
  toFile,
  pendingChanges,
  describePending,
  commitMessage,
  SyncError,
} from "@/lib/sync"
import type { Snapshot, RemoteState } from "@/lib/sync"

const PASSWORD_KEY = "volei-sync-password"

export function SyncButton() {
  const teamName = useTeamStore((s) => s.teamName)
  const players = useTeamStore((s) => s.players)
  const matches = useTeamStore((s) => s.matches)
  const lastSaved = useTeamStore((s) => s.lastSaved)
  const remoteSha = useTeamStore((s) => s.remoteSha)
  const markSaved = useTeamStore((s) => s.markSaved)
  const adoptRemote = useTeamStore((s) => s.adoptRemote)

  const current: Snapshot = { teamName, players, matches }
  const pending = pendingChanges(lastSaved, current)

  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [offline, setOffline] = useState(false)
  const [offlineReason, setOfflineReason] = useState("")
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")
  const [conflict, setConflict] = useState<RemoteState | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const bootRan = useRef(false)

  // Sincroniza uma vez ao montar: pega o que está no repositório e decide se
  // adota silenciosamente (sem pendências locais) ou só guarda o sha (com pendências).
  useEffect(() => {
    if (bootRan.current) return
    bootRan.current = true
    fetchRemote()
      .then((remote) => {
        if (remote.data && pendingChanges(lastSaved, current).total === 0) {
          adoptRemote(remote.data, remote.sha)
        } else {
          useTeamStore.setState({ remoteSha: remote.sha })
        }
      })
      .catch((err: unknown) => {
        setOffline(true)
        setOfflineReason(err instanceof Error ? err.message : "Erro desconhecido")
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Avisa antes de fechar a aba enquanto houver algo não publicado.
  useEffect(() => {
    if (pending.total === 0) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [pending.total])

  async function doSave(password: string, shaOverride?: string | null) {
    setSaving(true)
    try {
      const res = await pushRemote({
        file: toFile(current),
        sha: shaOverride !== undefined ? shaOverride : remoteSha,
        password,
        message: commitMessage(pending, current),
      })
      markSaved(current, res.sha)
      setLastSavedAt(new Date())
      toast.success(`Salvo: ${describePending(pending)}`)
      setConflict(null)
    } catch (err) {
      if (err instanceof SyncError && err.status === 401) {
        sessionStorage.removeItem(PASSWORD_KEY)
        toast.error("Senha incorreta")
        setPasswordInput("")
        setPasswordOpen(true)
      } else if (err instanceof SyncError && err.status === 409 && err.remote) {
        setConflict(err.remote)
      } else {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar")
      }
    } finally {
      setSaving(false)
    }
  }

  function handleClick() {
    const password = sessionStorage.getItem(PASSWORD_KEY)
    if (!password) {
      setPasswordOpen(true)
      return
    }
    void doSave(password)
  }

  function handlePasswordSubmit() {
    if (!passwordInput) return
    const password = passwordInput
    sessionStorage.setItem(PASSWORD_KEY, password)
    setPasswordInput("")
    setPasswordOpen(false)
    void doSave(password)
  }

  function handleOverwrite() {
    if (!conflict) return
    const password = sessionStorage.getItem(PASSWORD_KEY)
    if (!password) {
      setPasswordOpen(true)
      return
    }
    void doSave(password, conflict.sha)
  }

  function handleAdoptRemote() {
    if (!conflict?.data) return
    adoptRemote(conflict.data, conflict.sha)
    setConflict(null)
    toast.success("Dados locais substituídos pelos do repositório")
  }

  /**
   * Volta ao que está publicado. Sem isso o time fica preso numa alteração que não
   * quer salvar: o localStorage guarda tudo na hora e o refresh não desfaz nada.
   */
  async function handleDiscard() {
    setDiscarding(true)
    try {
      const remote = await fetchRemote()
      if (remote.data) {
        adoptRemote(remote.data, remote.sha)
        toast.success("Alterações descartadas — voltou ao que está publicado")
      } else {
        adoptRemote({ teamName: "Meu Time", players: [], matches: [] }, remote.sha)
        toast.success("Alterações descartadas — não há nada publicado ainda")
      }
      setDiscardOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui buscar a versão publicada")
    } finally {
      setDiscarding(false)
    }
  }

  const disabled = offline || saving || pending.total === 0
  const label = offline
    ? "Sincronização indisponível"
    : saving
      ? "Salvando…"
      : pending.total === 0
        ? "Tudo salvo"
        : "Salvar dados"

  return (
    <div className="w-full">
      <Button
        className="w-full justify-start"
        variant={offline || pending.total === 0 ? "ghost" : "default"}
        disabled={disabled}
        onClick={handleClick}
        title={offline ? offlineReason : undefined}
      >
        {offline ? (
          <CloudOff />
        ) : saving ? (
          <Loader2 className="animate-spin" />
        ) : pending.total === 0 ? (
          <Check />
        ) : (
          <CloudUpload />
        )}
        <span className="flex-1 text-left">{label}</span>
        {!offline && !saving && pending.total > 0 && (
          <Badge variant="secondary" className="num">
            {pending.total}
          </Badge>
        )}
      </Button>
      {!offline && (
        <div className="mt-1 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={describePending(pending)}>
            {pending.total === 0
              ? lastSavedAt
                ? `Salvo às ${format(lastSavedAt, "HH:mm")}`
                : "—"
              : describePending(pending)}
          </p>
          {pending.total > 0 && (
            <button
              type="button"
              onClick={() => setDiscardOpen(true)}
              className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
            >
              Descartar
            </button>
          )}
        </div>
      )}

      <Dialog open={discardOpen} onOpenChange={(open) => !discarding && setDiscardOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar alterações não salvas?</DialogTitle>
            <DialogDescription>
              Isto joga fora {describePending(pending)} e traz de volta o que está publicado no
              repositório. Não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={discarding} onClick={() => setDiscardOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              disabled={discarding}
              onClick={handleDiscard}
              className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {discarding ? <Loader2 className="animate-spin" /> : null}
              Descartar e recarregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Senha do time</DialogTitle>
            <DialogDescription>
              Só quem tem a senha pode publicar as estatísticas no repositório. Ela fica guardada
              apenas nesta aba do navegador, até você fechá-la.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sync-password">Senha</Label>
            <Input
              id="sync-password"
              type="password"
              autoFocus
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePasswordSubmit()
              }}
            />
          </div>
          <DialogFooter>
            <Button onClick={handlePasswordSubmit} disabled={!passwordInput}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!conflict} onOpenChange={(open) => !open && setConflict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alguém salvou antes de você</DialogTitle>
            <DialogDescription>
              O repositório mudou desde a última vez que este navegador leu os dados. Escolha o
              que fazer com as suas alterações locais ({describePending(pending)}).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={saving}
              onClick={handleAdoptRemote}
            >
              Descartar o meu e puxar o de lá
            </Button>
            <Button disabled={saving} onClick={handleOverwrite}>
              Sobrescrever com o meu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
