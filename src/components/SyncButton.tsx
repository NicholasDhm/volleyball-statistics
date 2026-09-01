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
import { cn } from "@/lib/utils"
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
        <p className={cn("mt-1 truncate text-xs text-muted-foreground")} title={describePending(pending)}>
          {pending.total === 0
            ? lastSavedAt
              ? `Salvo às ${format(lastSavedAt, "HH:mm")}`
              : "—"
            : describePending(pending)}
        </p>
      )}

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
