# NextGen — memória do projeto

- SaaS de gestão para escolas de futebol. Repo `Autoric-Automation-Systems/nextgen`.
- Docs 01–13 em PT-BR (`docs/`); código em inglês. `docs/13-fundacao-implementada.md`
  descreve o que já existe em código — leia antes de assumir que algo é só especificação.
- **Aluno é perfil tutelado, não usuário.** Sem login próprio antes dos 16; quem
  autentica é o responsável. Terminologia fixa: `school`, `unit`, `room`, `season`,
  `category`, `class_group`, `enrollment`, `guardian`, `student`, `consent`, `assessment`.
  Unidade tem endereço; sala pertence à unidade.
- Monorepo pnpm + turbo: `apps/web` (Next 15), `packages/{db,core,auth,integrations}`.
  Storage é **Vercel Blob** em dois stores (público e privado), não R2/Stream.
- Isolamento por escola vive no Postgres: `ENABLE` + `FORCE ROW LEVEL SECURITY` e
  `withTenant()` com `set_config('app.school_id', ..., true)`. Papel de runtime é
  `nextgen_app` (`NOSUPERUSER NOBYPASSRLS`); `DATABASE_URL` (dono) é só para migração/seed.
- **Exceção consciente:** `users` tem `ENABLE` sem `FORCE` porque o login precisa ler o
  usuário pelo e-mail antes de existir sessão. Só `packages/auth` usa o cliente dono.
  Migration `0004_auth_owner_bypass` explica.
- Better Auth exige `advanced.database.generateId: "uuid"` — sem isso ele grava ids
  aleatórios em colunas `uuid` e todo sign-in falha com P2023.
- `BETTER_AUTH_SECURE_COOKIES` controla o flag Secure: `next start` local roda em
  NODE_ENV=production sobre http e o cookie não persiste sem isso.
- Nunca usar extensão `.js` em import relativo dentro dos packages: o webpack do Next
  não resolve `.js` → `.ts`. Import sem extensão (moduleResolution Bundler).
- `packages/db` precisa de `postinstall: prisma generate`; sem o hook a CI quebra no seed.
- Testes: 44 core + 12 RLS + 9 storage. Suite RLS exige Postgres com `nextgen_app`.
- **Neon: o dono do banco não pode criar papel.** `CREATE ROLE` responde 42501
  (`permission denied to create role`); `ALTER ROLE ... PASSWORD` de outro papel também.
  `nextgen_app` nasce em Neon Console → Roles, e o build só concede GRANT (idempotente,
  em `packages/db/prisma/sql/app-role-grants.sql`). Migração que exige CREATEROLE aborta e
  deixa o Prisma em P3009, bloqueando todos os deploys seguintes.
- **Vercel e GitHub Actions não compartilham variáveis.** As credenciais do Neon estão só
  na Vercel; por isso a migração roda no `prebuild` (`scripts/migrate-on-deploy.mjs`), só
  com `VERCEL_ENV=production`, e nunca derruba o deploy.
- Schema `neon_auth` no banco `nextgen-neon` = Neon Auth habilitado no console. Não é
  criado por nenhuma migração deste repo (só `public` e `app`).
