import { NavLink, Outlet, useLocation } from "react-router-dom"
import {
  BarChart3, BookOpen, CalendarDays, Check, LayoutDashboard, Moon, Pencil, Sun, Users, Scale,
  Volleyball, Menu, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme"
import { useTeamStore } from "@/store/useTeamStore"
import { SyncButton } from "@/components/SyncButton"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { toast } from "sonner"
import { useEffect, useRef, useState } from "react"

const NAV = [
  { to: "/", label: "Visão Geral", icon: LayoutDashboard, end: true },
  { to: "/partidas", label: "Partidas", icon: CalendarDays },
  { to: "/elenco", label: "Elenco", icon: Users },
  { to: "/comparar", label: "Comparar", icon: Scale },
  { to: "/relatorio", label: "Relatório", icon: BarChart3 },
  { to: "/glossario", label: "Glossário", icon: BookOpen },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )
          }
        >
          <Icon className="size-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export function TeamNameEditor({
  className,
  size = "sm",
}: {
  className?: string
  size?: "sm" | "lg"
}) {
  const teamName = useTeamStore((s) => s.teamName)
  const setTeamName = useTeamStore((s) => s.setTeamName)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(teamName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setDraft(teamName)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [editing, teamName])

  function commit() {
    const name = draft.trim()
    if (name && name !== teamName) {
      setTeamName(name)
      toast.success("Nome do time atualizado")
    }
    setEditing(false)
  }

  const big = size === "lg"

  if (editing) {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <input
          ref={inputRef}
          value={draft}
          maxLength={40}
          aria-label="Nome do time"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") setEditing(false)
          }}
          onBlur={commit}
          className={cn(
            "min-w-0 rounded-lg border border-input bg-background px-2 outline-none focus:border-ring focus:ring-2 focus:ring-ring/40",
            big ? "w-[min(20ch,60vw)] py-0.5 text-2xl font-semibold sm:text-3xl" : "w-full py-0.5 text-sm font-semibold",
          )}
        />
        <button
          type="button" aria-label="Salvar nome"
          onMouseDown={(e) => { e.preventDefault(); commit() }}
          className="grid size-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button" aria-label="Cancelar"
          onMouseDown={(e) => { e.preventDefault(); setEditing(false) }}
          className="grid size-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </span>
    )
  }

  return (
    <span className={cn("group/team inline-flex min-w-0 items-center gap-1.5", className)}>
      <span className="truncate">{teamName}</span>
      <button
        type="button"
        aria-label="Editar nome do time"
        title="Editar nome do time"
        onClick={() => setEditing(true)}
        className={cn(
          "grid shrink-0 place-items-center rounded text-muted-foreground transition-opacity",
          "hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/team:opacity-100",
          big ? "size-8 opacity-40" : "size-6 opacity-0",
        )}
      >
        <Pencil className={big ? "size-4" : "size-3"} />
      </button>
    </span>
  )
}

function Brand({ editable = true }: { editable?: boolean }) {
  const teamName = useTeamStore((s) => s.teamName)
  const setTeamName = useTeamStore((s) => s.setTeamName)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(teamName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setDraft(teamName)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [editing, teamName])

  function commit() {
    const name = draft.trim()
    if (name && name !== teamName) {
      setTeamName(name)
      toast.success("Nome do time atualizado")
    }
    setEditing(false)
  }

  return (
    <div className="group/brand flex items-center gap-2.5 px-1 py-1">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Volleyball className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              value={draft}
              maxLength={40}
              aria-label="Nome do time"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit()
                if (e.key === "Escape") setEditing(false)
              }}
              onBlur={commit}
              className="w-full min-w-0 rounded-md border border-input bg-background px-1.5 py-0.5 text-sm font-semibold outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
            />
            <button
              type="button"
              aria-label="Salvar nome"
              onMouseDown={(e) => { e.preventDefault(); commit() }}
              className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Cancelar"
              onMouseDown={(e) => { e.preventDefault(); setEditing(false) }}
              className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="truncate text-sm font-semibold leading-tight">{teamName}</span>
            {editable ? (
              <button
                type="button"
                aria-label="Editar nome do time"
                onClick={() => setEditing(true)}
                className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/brand:opacity-100"
              >
                <Pencil className="size-3" />
              </button>
            ) : null}
          </div>
        )}
        {editing ? null : (
          <div className="text-[11px] leading-tight text-muted-foreground">Voleibol</div>
        )}
      </div>
    </div>
  )
}

/** O título da aba acompanha o nome do time. */
function DocumentTitle() {
  const teamName = useTeamStore((s) => s.teamName)
  useEffect(() => {
    document.title = `${teamName.trim() || "Meu Time"} Voleibol`
  }, [teamName])
  return null
}

/** Trocar de rota volta ao topo — sem isso a página nova abre no meio. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior })
  }, [pathname])
  return null
}

export function AppShell() {
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <div className="flex min-h-screen bg-background">
      <ScrollToTop />
      <DocumentTitle />
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar p-3 lg:flex">
        <Brand />
        <div className="mt-5 flex-1"><NavItems /></div>
        <div className="mb-2 border-t pt-3"><SyncButton /></div>
        <Button variant="ghost" size="sm" onClick={toggle} className="justify-start gap-2.5 text-muted-foreground">
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? "Tema claro" : "Tema escuro"}
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/80 px-4 py-2.5 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="size-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-3">
              <SheetTitle className="sr-only">Navegação</SheetTitle>
              <Brand />
              <div className="mt-5"><NavItems onNavigate={() => setOpen(false)} /></div>
              <div className="mt-4 border-t pt-4"><SyncButton /></div>
            </SheetContent>
          </Sheet>
          <Brand editable={false} />
          <Button variant="ghost" size="icon" className="ml-auto" onClick={toggle}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
