import { BrowserRouter, Route, Routes } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { ThemeProvider } from "@/components/theme"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import Dashboard from "@/pages/Dashboard"
import Matches from "@/pages/Matches"
import MatchDetail from "@/pages/MatchDetail"
import Roster from "@/pages/Roster"
import PlayerDetail from "@/pages/PlayerDetail"
import Compare from "@/pages/Compare"
import Report from "@/pages/Report"
import Glossary from "@/pages/Glossary"

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={150}>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="partidas" element={<Matches />} />
              <Route path="partidas/:matchId" element={<MatchDetail />} />
              <Route path="elenco" element={<Roster />} />
              <Route path="jogador/:playerId" element={<PlayerDetail />} />
              <Route path="comparar" element={<Compare />} />
              <Route path="relatorio" element={<Report />} />
              <Route path="glossario" element={<Glossary />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </TooltipProvider>
    </ThemeProvider>
  )
}
