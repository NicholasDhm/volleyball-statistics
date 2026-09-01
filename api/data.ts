/**
 * Lê e grava a temporada num JSON versionado no próprio repositório.
 *
 * O token do GitHub vive só aqui (env var na Vercel) — o navegador nunca o vê.
 * O cliente manda a senha do time e o SHA do arquivo que ele leu; se alguém
 * salvou nesse meio-tempo o SHA não bate e a gravação é recusada em vez de
 * sobrescrever o trabalho do outro.
 */
export const config = { runtime: "edge" }

const GH = "https://api.github.com"

interface Env {
  token: string
  repo: string
  branch: string
  path: string
  password: string
}

function readEnv(): Env | { error: string } {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO
  const password = process.env.APP_PASSWORD
  const missing = [
    !token && "GITHUB_TOKEN",
    !repo && "GITHUB_REPO",
    !password && "APP_PASSWORD",
  ].filter(Boolean)
  if (missing.length) return { error: `Faltam variáveis de ambiente: ${missing.join(", ")}` }
  return {
    token: token!,
    repo: repo!,
    password: password!,
    branch: process.env.GITHUB_BRANCH || "data",
    path: process.env.DATA_PATH || "data/season.json",
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  })

const ghHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
  "user-agent": "volei-stats",
})

/** btoa só aceita latin1; o JSON tem acento, então passa por UTF-8 em pedaços. */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ""))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Comparação em tempo constante — não vaza o tamanho do prefixo correto. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function readFile(env: Env) {
  const url = `${GH}/repos/${env.repo}/contents/${encodeURIComponent(env.path)}?ref=${encodeURIComponent(env.branch)}`
  const res = await fetch(url, { headers: ghHeaders(env.token), cache: "no-store" })
  if (res.status === 404) return { data: null, sha: null }
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`)
  const body = (await res.json()) as { content: string; sha: string }
  return { data: JSON.parse(fromBase64(body.content)), sha: body.sha }
}

export default async function handler(request: Request): Promise<Response> {
  const env = readEnv()
  if ("error" in env) return json({ error: env.error }, 500)

  if (request.method === "GET") {
    try {
      const { data, sha } = await readFile(env)
      return json({ data, sha })
    } catch (e) {
      return json({ error: `Não consegui ler do repositório: ${(e as Error).message}` }, 502)
    }
  }

  if (request.method !== "POST") {
    return json({ error: "Método não suportado" }, 405)
  }

  let payload: { password?: string; sha?: string | null; message?: string; data?: unknown }
  try {
    payload = await request.json()
  } catch {
    return json({ error: "Corpo inválido" }, 400)
  }

  if (!payload.password || !sameSecret(payload.password, env.password)) {
    return json({ error: "Senha incorreta" }, 401)
  }
  if (!payload.data || typeof payload.data !== "object") {
    return json({ error: "Sem dados para salvar" }, 400)
  }

  const content = toBase64(JSON.stringify(payload.data, null, 2))
  const url = `${GH}/repos/${env.repo}/contents/${encodeURIComponent(env.path)}`
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...ghHeaders(env.token), "content-type": "application/json" },
    body: JSON.stringify({
      message: payload.message || "Atualiza estatísticas",
      content,
      branch: env.branch,
      ...(payload.sha ? { sha: payload.sha } : {}),
    }),
  })

  if (res.status === 409 || res.status === 422) {
    // o SHA não bate: alguém salvou primeiro
    const { data, sha } = await readFile(env).catch(() => ({ data: null, sha: null }))
    return json({ error: "conflict", remote: data, sha }, 409)
  }
  if (!res.ok) {
    return json({ error: `GitHub ${res.status}: ${await res.text()}` }, 502)
  }

  const body = (await res.json()) as { content: { sha: string }; commit: { sha: string } }
  return json({ sha: body.content.sha, commit: body.commit.sha })
}
