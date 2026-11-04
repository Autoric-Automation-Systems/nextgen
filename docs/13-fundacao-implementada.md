# 13 — Fundação implementada (fase 0)

Este documento registra **o que já existe em código**, para não confundir com o que está
apenas desenhado em `04-modulos.md`. Tudo aqui roda e é verificado pela CI.

## O que está de pé

| Camada | Onde | Estado |
|---|---|---|
| Monorepo (pnpm + turbo) | raiz | funciona |
| Schema de dados + migrações | `packages/db/prisma` | 25 tabelas, 4 migrações |
| Isolamento por escola (RLS) | `packages/db/prisma/migrations/*_rls` | testado |
| Seed de duas escolas | `packages/db/prisma/seed.ts` | idempotente |
| Regras puras (dinheiro, categoria, RBAC, consentimento) | `packages/core` | 44 testes |
| Sessão e resolução de ator | `packages/auth` | link mágico |
| Storage (Vercel Blob, 2 stores) | `packages/integrations` | upload + URL assinada |
| App Next.js (login, painel, alunos) | `apps/web` | build verde |

## Como o isolamento entre escolas funciona

Não existe `where school_id = ...` espalhado pelo código como única defesa. A defesa é
do banco:

1. Toda tabela de domínio tem `school_id` e `ENABLE` + `FORCE ROW LEVEL SECURITY`.
2. A política lê `app.current_school_id()`, que vem de
   `set_config('app.school_id', ..., true)` — local à transação.
3. Sem contexto, a política devolve falso. Zero linhas, nunca "todas as linhas".
4. `FORCE` vale até para o dono da tabela: um bug de `WHERE` não vira vazamento.

O acesso passa sempre por `withTenant()`:

```ts
await withTenant({ schoolId: session.schoolId, userId: session.userId }, async (tx) => {
  return tx.student.findMany(); // já filtrado
});
```

O papel de runtime (`nextgen_app`) é `NOSUPERUSER NOBYPASSRLS`. Se a aplicação conectar
como dono, a política é inútil — por isso `APP_DATABASE_URL` é obrigatória e diferente de
`DATABASE_URL`.

### Exceções conscientes

| Exceção | Por quê | Risco controlado |
|---|---|---|
| `users` sem `FORCE`, lida pelo cliente dono no módulo de auth | o login precisa achar o usuário pelo e-mail **antes** de existir sessão | só `packages/auth` usa esse cliente |
| `memberships` com política `self_read` | descobrir a que escolas o usuário pertence, antes do contexto | só leitura do próprio vínculo |
| `schools` com política `member_directory` | seletor de escola mostrar o nome | só escolas com vínculo ativo |
| `consent_purposes` / `consent_terms` em leitura livre | são textos de referência, sem dado pessoal | escrita bloqueada |

## Consentimento: o que o código garante

- Propósitos versionados (`consent_terms` com `body_hash`), imutáveis depois de criados.
- `consents` guarda `evidence_hash`, IP, user-agent e método. Trigger bloqueia qualquer
  `UPDATE` que não seja `status` / `revoked_at`.
- Matrícula depende **só** do propósito `enrollment`. Consentimento de imagem ou de card
  nunca bloqueia matrícula (LGPD art. 8º).
- Card público exige três condições simultâneas: idade ≥ 12, opt-in e consentimento de
  imagem pública vigente.
- Menor de 16 não tem login próprio: `canHoldOwnLogin(age)`.

## Regras de categoria

Categoria é derivada do **ano de nascimento**, não da idade exata:

```ts
deriveCategory(new Date("2017-09-30"), [sub8, sub9]);
// → { ok: true, categoryId: "sub9" }
```

Quando duas categorias casam, a função devolve `ambiguous` em vez de escolher sozinha.

## Rotas disponíveis

| Rota | Comportamento |
|---|---|
| `/` | landing pública |
| `/login` | pedido de link mágico (sem senha) |
| `/dashboard` | requer sessão; métricas da escola |
| `/alunos` | requer sessão; lista com regime etário e consentimento |
| `/api/auth/*` | Better Auth |

Sem sessão, `/dashboard` e `/alunos` redirecionam para `/login`.

## Como rodar

```bash
pnpm install

# Postgres local (Docker)
docker run -d --name nextgen-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nextgen \
  -p 5432:5432 postgres:16-alpine

# papel de aplicação (uma vez)
docker exec nextgen-pg psql -U postgres -d nextgen -c \
  "create role nextgen_app login password 'app' nosuperuser nobypassrls;"
docker exec nextgen-pg psql -U postgres -d nextgen -c \
  "grant connect on database nextgen to nextgen_app;"

cp .env.example apps/web/.env.local   # ajuste as URLs
pnpm db:migrate
pnpm db:seed
pnpm dev
```

O seed cria duas escolas (`demo` e `rival`) com alunos, turma, categorias e consentimento.
Entre em `http://localhost:3000/login` com `admin@demo.test`; o link aparece no terminal
(em produção, vai por e-mail).

## Verificação

```bash
pnpm test        # 44 testes de regra + 12 de RLS (precisa do banco)
pnpm typecheck
pnpm build
```

Os testes de RLS em `packages/db/test/rls.test.ts` cobrem: leitura cruzada, insert com
`school_id` alheio, `update` que não afeta linha, ausência de contexto, imutabilidade do
consentimento e auditoria append-only.

## O que ainda não existe

Ficam para as próximas fases, na ordem de `09-roadmap.md`:

1. Matrícula com convite ao responsável e assinatura do termo (o schema já suporta).
2. Conteúdo, matérias, capítulos e plano de aula.
3. Avaliação de habilidades, histórico e card público.
4. Anamnese e prontuário com visibilidade segregada.
5. Financeiro (cobrança, boleto, inadimplência, despesas).
6. Site público da escola e editor de identidade visual.
