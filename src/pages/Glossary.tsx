import { PageHeader, PositionBadge } from "@/components/kit"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { POSITIONS, POSITION_STATS, RALLY_STAT, STATS, STAT_GROUP_LABEL } from "@/lib/stats"
import type { Position, StatGroup } from "@/lib/types"

const GROUP_ORDER: StatGroup[] = [
  "participacao",
  "levantamento",
  "ataque",
  "saque",
  "passe",
  "defesa",
  "bloqueio",
]

const ATTACK_OUTCOMES: { label: string; stats: string; who: string; accent: string }[] = [
  {
    label: "Virou ponto",
    stats: "Ataque Ponto, Largadas",
    who: "Nós",
    accent: "var(--success)",
  },
  {
    label: "Adversário defendeu",
    stats: "Defesa Contra",
    who: "Ninguém — o rally continua",
    accent: "var(--muted-foreground)",
  },
  {
    label: "Virou ponto para eles",
    stats: "Ataque Errado, Block Contra",
    who: "Eles",
    accent: "var(--destructive)",
  },
]

const FORMULAS: { label: string; formula: string; meaning: string }[] = [
  {
    label: "Eficiência de ataque",
    formula: "(Ataque Ponto + Largada − Ataque Errado − Block Contra) / Tentativas",
    meaning: "quanto sobra depois de descontar os erros — pode ficar negativa",
  },
  {
    label: "Aproveitamento de ataque",
    formula: "(Ataque Ponto + Largada) / Tentativas",
    meaning: "fração das tentativas que virou ponto, sem descontar erro",
  },
  {
    label: "Nota de passe",
    formula: "(A×3 + B×2 + C×1) / (total×3), ou aproveitamento simples sem graduação",
    meaning: "0 a 100 — usa A/B/C quando há graduação (líbero), senão certo/errado",
  },
  {
    label: "Saldo",
    formula: "Pontos − Erros",
    meaning: "contribuição líquida do jogador para o placar",
  },
  {
    label: "Pontos disputados e taxas por 25",
    formula: "(valor / Pontos disputados) × 25",
    meaning: "normaliza o volume para o tamanho de um set — só existe com participação lançada",
  },
  {
    label: "Participação (em quadra)",
    formula: "Pontos disputados pelo jogador / Pontos disputados na partida",
    meaning: "fatia dos rallies da partida em que ele esteve em quadra",
  },
]

const RENAMES: { from: string; to: string }[] = [
  { from: "Ataque Certo", to: "Ataque Ponto" },
  { from: "Saque Certo", to: "Saque Ponto" },
  { from: "Block Pro", to: "Block Ponto" },
]

function positionsFor(key: string): Position[] {
  return POSITIONS.map((p) => p.key).filter((pos) => POSITION_STATS[pos].includes(key))
}

function PolarityBadge({ polarity }: { polarity: "positive" | "negative" | "neutral" }) {
  const map = {
    positive: { label: "Ponto nosso", className: "bg-[var(--success)]/12 text-[var(--success)]" },
    negative: { label: "Ponto deles", className: "bg-destructive/12 text-destructive" },
    neutral: { label: "Nem ponto nem erro", className: "bg-muted text-muted-foreground" },
  } as const
  const { label, className } = map[polarity]
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", className)}>
      {label}
    </Badge>
  )
}

export default function Glossary() {
  return (
    <div className="space-y-6">
      <PageHeader title="Glossário" subtitle="O que cada número quer dizer" />

      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Ponto é ponto no placar</h2>
        <div className="mt-3 max-w-3xl space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            &quot;Ponto&quot; aqui sempre quer dizer ponto no placar — a bola caiu do lado do
            adversário, ou eles erraram por causa de uma ação nossa. Não é &quot;acerto de
            movimento&quot;: um passe certo, uma defesa certa ou uma cobertura são fundamentais,
            mas não são ponto — são o que permite o ataque acontecer.
          </p>
          <p>
            Um ataque tem três desfechos possíveis, e cada um é lançado separado. Se a bola caiu,
            virou ponto (Ataque Ponto ou Largada). Se o adversário defendeu e o rally continuou, é
            Defesa Contra — não foi erro, mas também não foi ponto. Se a bola voltou pro nosso
            lado ou saiu, foi Ataque Errado ou Block Contra — ponto para eles. &quot;Não
            errar&quot; não é a mesma coisa que &quot;fazer ponto&quot;: dá para atacar sem erro e
            mesmo assim não pontuar, se o adversário defender.
          </p>
          <p>
            &quot;Pontos conquistados&quot; do time soma ataque + largada + ace + block ponto.
            Esse número é sempre menor que o placar, porque parte dos pontos no placar cai por
            erro do adversário (saque na rede, ataque fora) — e isso não é uma ação nossa, é um
            erro deles.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {ATTACK_OUTCOMES.map((o) => (
            <div
              key={o.label}
              className="rounded-lg border-l-4 bg-muted/30 p-3"
              style={{ borderLeftColor: o.accent }}
            >
              <p className="text-sm font-semibold">{o.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{o.stats}</p>
              <p className="mt-2 text-xs font-medium">
                Ganha o ponto: <span className="text-foreground">{o.who}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Fundamentos</h2>
        <div className="space-y-4">
          {GROUP_ORDER.map((group) => {
            const entries = Object.values(STATS).filter((s) => s.group === group)
            if (entries.length === 0) return null
            return (
              <div key={group} className="rounded-xl border bg-card p-5">
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {STAT_GROUP_LABEL[group]}
                </h3>
                <dl className="divide-y divide-border/50">
                  {entries.map((stat) => {
                    const positions = stat.key === RALLY_STAT ? null : positionsFor(stat.key)
                    return (
                      <div key={stat.key} className="py-3 first:pt-2 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <dt className="font-medium">{stat.label}</dt>
                          <PolarityBadge polarity={stat.polarity} />
                        </div>
                        <dd className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                          {stat.help}
                        </dd>
                        <dd className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {positions === null ? (
                            <span>Todas as posições</span>
                          ) : positions.length > 0 ? (
                            <>
                              <span>Registrado por:</span>
                              {positions.map((pos) => (
                                <PositionBadge key={pos} position={pos} />
                              ))}
                            </>
                          ) : (
                            <span>—</span>
                          )}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Contas derivadas</h2>
        <div className="rounded-xl border bg-card p-5">
          <dl className="divide-y divide-border/50">
            {FORMULAS.map((f) => (
              <div
                key={f.label}
                className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-baseline sm:gap-4"
              >
                <dt className="font-medium">{f.label}</dt>
                <dd className="text-sm leading-relaxed text-muted-foreground">
                  <code className="mr-2 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">
                    {f.formula}
                  </code>
                  {f.meaning}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Da planilha para cá</h2>
        <div className="max-w-md rounded-xl border bg-card p-5">
          <p className="mb-3 text-sm text-muted-foreground">
            Dois nomes ficaram mais explícitos — o significado não mudou.
          </p>
          <dl className="space-y-2">
            {RENAMES.map((r) => (
              <div key={r.from} className="flex items-center gap-3 text-sm">
                <dt className="text-muted-foreground line-through decoration-muted-foreground/50">
                  {r.from}
                </dt>
                <span aria-hidden className="text-muted-foreground">
                  →
                </span>
                <dd className="font-semibold">{r.to}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  )
}
