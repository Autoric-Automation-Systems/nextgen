# AGENTS.md — NextGen

Instruções para qualquer agente (humano ou IA) trabalhando neste repositório.

## Contexto

Repositório do NextGen, SaaS de gestão para escolas de futebol. A documentação é a
fonte da verdade do produto; `docs/13-fundacao-implementada.md` descreve o que já
existe em código. O restante entra conforme `docs/09-roadmap.md`.

## Estrutura

```
apps/web              Next.js 15 (App Router) — painel, login, API de auth
packages/db           Prisma, migrações com RLS, seed, cliente de tenant
packages/core         regras puras: dinheiro, categoria, RBAC, consentimento
packages/auth         Better Auth + resolução de sessão/ator
packages/integrations Vercel Blob (stores público e privado)
docs/                 especificação (01..13)
```

## Comandos

```bash
pnpm install
pnpm db:migrate   # prisma migrate deploy
pnpm db:seed
pnpm dev
pnpm test         # regras + RLS (RLS exige Postgres com o papel nextgen_app)
pnpm typecheck
pnpm build

node scripts/check-deploy.mjs <url>   # sonda um deploy publicado
```

## Deploy

Vercel com Root Directory `apps/web` (obrigatório) e preset Next.js; config em
`apps/web/vercel.json`. A Vercel só lê o `vercel.json` da Root Directory.
Node **24.x** (`.nvmrc` + `engines`): 22 está em manutenção e 26 é LTS novo demais para
binário nativo de Prisma/sharp. O runbook completo
está em `docs/14-deploy-vercel.md`. Três coisas não podem regredir:

1. `APP_DATABASE_URL` diferente de `DATABASE_URL` — se o app conectar como dono, a RLS
   some silenciosamente. `/api/health` responde `rls:false` e 503 nesse caso.
2. `prisma generate` no build, com `binaryTargets` incluindo `rhel-openssl-3.0.x`.
3. Nunca usar `console` como transporte de e-mail em produção: o link mágico no log é
   acesso à conta de qualquer pessoa. O código já recusa isso quando `VERCEL_ENV=production`.

Duas URLs de banco são obrigatórias e **precisam ser diferentes**: `DATABASE_URL`
(dono, só migração e seed) e `APP_DATABASE_URL` (papel `nextgen_app`, sem superusuário).
Se a aplicação conectar como dono, a RLS deixa de valer.

## Idioma

- Documentação, UI e mensagens de erro em **português do Brasil**.
- Código (variáveis, funções, tabelas) em **inglês**.
- Commits em português, no imperativo: `docs: adiciona matriz de retenção`.

## Padrões de acabamento

Tela, texto e e-mail seguem [`docs/16-padroes-de-acabamento.md`](docs/16-padroes-de-acabamento.md):
construir como marca grande constrói, com as fontes citadas lá (WCAG 2.2 AA, WAI-ARIA APG,
Apple HIG/Material 3, heurísticas de Nielsen, GOV.UK, guias de e-mail transacional, OWASP).
Na prática, o que mais se esquece:

- Toda tela tem os quatro estados desenhados: vazio, carregando, erro e sem permissão.
- E-mail transacional tem versão em texto, preheader, botão **e** link por extenso, sem
  imagem como conteúdo; a prévia é `/sistema/email`.
- Não inventar cor, raio ou espaçamento: usar os tokens de `apps/web/app/globals.css`.
- **Casca fixa**: cabeçalho, menu e rodapé ficam na tela; só o miolo rola. Toda página nova
  entra em `<main>` como filho direto do `body` (ou em `.shell-content` no painel) — é isso
  que a regra de altura em `globals.css` enxerga. Nunca colocar `max-width` no contêiner que
  rola: o `.wrap` fica dentro.

## Regras não negociáveis

Leia `docs/02-menores-lgpd.md` antes de propor qualquer mudança que envolva aluno,
responsável, consentimento, imagem, saúde ou dado público.

1. Aluno é **perfil tutelado**, não usuário. Sem login próprio antes dos 16.
2. Toda tabela de domínio tem `school_id` + RLS.
3. Toda finalidade de tratamento tem consentimento versionado e revogável.
4. Dado de saúde é sensível: nunca em log, e-mail, push ou analytics.
5. Nada de aluno é público por padrão; card é opt-in e sem ranking.
6. Dinheiro trafega na conta da escola, nunca na da NextGen.
7. Nunca condicionar matrícula a consentimento de imagem ou perfil público.

## Terminologia

Use exatamente os termos do glossário em `docs/01-visao-produto.md` §6:
`school`, `unit`, `room`, `season`, `category`, `class_group`, `enrollment`,
`guardian`, `student`, `consent`, `assessment`.

Atenção: **unidade** tem endereço; **sala** pertence a uma unidade.

## Estilo de documentação

- Markdown com uma ideia por seção, tabelas para decisões e listas curtas.
- Toda regra de negócio deve dizer o **porquê**, não só o **o quê**.
- Diagramas em Mermaid dentro do próprio Markdown.
- Não duplicar conteúdo entre documentos: referencie com link relativo.
- Não criar documentos novos sem atualizar o índice do `README.md`.

## Definição de pronto para documentação

- [ ] Link relativo válido
- [ ] Terminologia consistente com o glossário
- [ ] Impacto em LGPD/consentimento avaliado
- [ ] Índice do README atualizado quando houver documento novo
