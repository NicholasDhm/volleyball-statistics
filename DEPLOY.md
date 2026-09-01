# Publicar na Vercel

O app é estático e guarda a temporada num JSON versionado no próprio repositório.
O token do GitHub fica só na função serverless — o navegador nunca o vê.

## 1. Criar a branch de dados

O JSON vive numa branch separada de propósito: assim salvar estatística **não dispara
redeploy** (a Vercel só constrói a branch de produção).

```bash
git switch --orphan data
mkdir -p data
echo '{}' > data/season.json
git add data/season.json
git commit -m "Inicia arquivo da temporada"
git push -u origin data
git switch main
```

## 2. Criar o token do GitHub

Em **Settings → Developer settings → Personal access tokens → Fine-grained tokens**:

- **Repository access**: apenas este repositório
- **Permissions → Repository → Contents**: `Read and write`
- Nada mais. Sem essa restrição, um vazamento daria acesso a tudo.

Guarde o token; ele só aparece uma vez.

## 3. Ligar na Vercel

Importe o repositório (preset **Vite**, detectado sozinho) e configure em
**Settings → Environment Variables**:

| Variável | Valor | Obrigatória |
|---|---|---|
| `GITHUB_TOKEN` | o token do passo 2 | sim |
| `GITHUB_REPO` | `seu-usuario/volleyball-statistics` | sim |
| `APP_PASSWORD` | a senha que o time vai usar para salvar | sim |
| `GITHUB_BRANCH` | branch dos dados (padrão `data`) | não |
| `DATA_PATH` | caminho do arquivo (padrão `data/season.json`) | não |

Depois é `git push` na `main` e pronto.

## Como funciona no dia a dia

- Tudo que você lança fica **na hora** no `localStorage` — nada se perde se fechar o navegador.
- O botão **Salvar dados** na barra lateral publica no repositório. Ele só acende quando algo
  mudou, e diz o quê: *"2 partidas, 1 jogador"*.
- Cada save é um commit com mensagem legível (`+1 partida · 12 partidas na temporada`), então o
  histórico do repositório vira o diário da temporada. Lançou errado? `git revert`.
- Quem não tem a senha **vê tudo, mas não salva**.
- Abriu em outro aparelho? Se não houver nada pendente ali, o app puxa a versão do repositório
  sozinho. Se houver, ele avisa antes de qualquer coisa ser sobrescrita.
- Duas pessoas salvando ao mesmo tempo não se atropelam: a segunda recebe um aviso e escolhe entre
  sobrescrever ou puxar.

## Custo

Zero. Vercel Hobby cobre o site e a função; o GitHub cobre o armazenamento. Uma temporada de
12 partidas ocupa 22 KB — cinco anos de jogos não passam de meio megabyte.

## Rodando local com sync

A função só existe na Vercel. Para testar o sync na sua máquina:

```bash
npm i -g vercel
vercel dev
```

Com `npm run dev` puro, o app funciona normalmente e o botão fica em
"Sincronização indisponível".
