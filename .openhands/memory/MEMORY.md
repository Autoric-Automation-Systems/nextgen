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
- **`prebuild` nunca roda no build da Vercel**: o comando é `turbo run build`, que executa
  o script `build` do pacote e não o ciclo de vida do npm. Passo que precisa rodar tem de
  estar dentro de `build` (`node scripts/... && next build`). Custou dias de diagnóstico.
- **O Neon valida senha no `ALTER ROLE`**: senha curta/simples volta HTTP 400 do control
  plane com "insecure password". Precisa de 12+ caracteres com maiúscula, minúscula,
  número e símbolo.
- `nextgen_app` nasce `NOLOGIN` (migração de RLS); o login só é ligado pelo build. Papel
  NOLOGIN produz P1001 "can't reach database server", que engana o diagnóstico.
- Sem token da API da Vercel não dá para alterar variável de ambiente por aqui; o
  `VERCEL_AUTOMATION_BYPASS_SECRET` serve só para furar o Deployment Protection.
- **Login quebrado em produção tem 3 causas silenciosas** (o formulário responde "enviado"
  para as três): `INVALID_ORIGIN` (origem fora de `trustedOrigins`), `DATABASE_URL_MIGRATE`
  com valor que não é URL (Prisma falha na 1ª escrita = token do link), e URL/segredo
  faltando. Sondas: `/api/health?login=1` (executa o link mágico para `example.com`),
  `?smtp=1` (AUTH sem enviar), `mailRecent` (tabela `mail_log`).
- **Domínios divergem**: `nextgen-three-ebon.vercel.app` é aberto; `nextgen-autoric.vercel.app`
  cai em SSO da Vercel (302 para `vercel.com/sso-api`). Sem usuário na tabela `users`
  (bootstrap-admin.sql) o link verifica e morre em `new_user_signup_disabled`.
- **Sandbox reseta e leva `/tmp` junto**: `pnpm` e `psql` somem no meio da sessão. Para
  voltar: `npm i -g pnpm@9.15.4 --prefix /tmp/npmbin` e usar
  `export PATH="/tmp/npmbin/bin:$PATH"`. Testes do `@nextgen/db` (RLS) exigem Postgres
  local em 55432 e falham sem ele — não é regressão de código.
- `BETTER_AUTH_SECRET` ausente derruba `/dashboard` com 500 sem texto (Better Auth lança em
  `create-context`). O health agora devolve `missing` e responde `degraded`.
- O build não tem log acessível: `public.deploy_log` (escrito por
  `scripts/migrate-on-deploy.mjs`, lido pelo health em `lastDeploy`) é a janela para ele.
