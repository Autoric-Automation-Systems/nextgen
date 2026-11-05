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
- **Ativos de marca**: `apps/web/public/{brand,icons/{ui,skills},dev}`. `lib/brand.ts` é o
  único lugar com caminho de arquivo (SRP); `BrandLogo`/`SiteFooter`/`SkillIcon` só pedem
  variante. `brand.test.ts` valida que todo caminho do manifesto existe — rename sem editar
  o manifesto quebra o CI de propósito. Os SVGs atuais são placeholders (`<!-- PLACEHOLDER -->`).
  Rodapé liga para `https://www.autoric.com.br` (Autoric).
- **Site público**: `/` sucinta (hero + 2 portas) → `/como-funciona` (detalhe). Escola entra
  por `/escola` (entrar ou cadastrar) e `/escola/solicitar` grava pedido em `school_leads`.
  `nextgen_app` só tem INSERT nessa tabela (`$executeRaw`, sem RETURNING); a exceção é
  reaplicada em `app-role-grants.sql` porque o GRANT geral do deploy devolveria o SELECT.
  Login é único (responsável, professor, admin); aluno <16 não tem conta.
- **pnpm some do `/tmp`** quando o sandbox reinicia: `npm i -g pnpm@9.15.4 --prefix /tmp/npmbin`.
- **Sandbox reseta e leva `/tmp` junto**: `pnpm` e `psql` somem no meio da sessão. Para
  voltar: `npm i -g pnpm@9.15.4 --prefix /tmp/npmbin` e usar
  `export PATH="/tmp/npmbin/bin:$PATH"`. Testes do `@nextgen/db` (RLS) exigem Postgres
  local em 55432 e falham sem ele — não é regressão de código.
- `BETTER_AUTH_SECRET` ausente derruba `/dashboard` com 500 sem texto (Better Auth lança em
  `create-context`). O health agora devolve `missing` e responde `degraded`.
- O build não tem log acessível: `public.deploy_log` (escrito por
  `scripts/migrate-on-deploy.mjs`, lido pelo health em `lastDeploy`) é a janela para ele.
- **Plataforma e perfis**: `PLATFORM_ADMIN_EMAILS` (env) é a fonte, mas a RLS não lê env:
  o login grava `users.is_platform_staff` e a política `platform_directory` (só `schools`,
  SELECT) usa `app.is_platform_staff()`. `withoutTenant` zera `app.user_id` e cega essa
  política — para o diretório use `withUser(userId, …)` (`packages/db/src/tenant.ts`).
- **Menu do painel**: `apps/web/lib/nav.ts` (`NAV` + `navSectionsFor`) é a regra de quem vê
  o quê; `components/sidebar.tsx` só desenha. Itens `soon` aparecem sem link.
  `resolveWorkspace` cai na Escola Teste (`slug escola-teste`) quando o usuário é plataforma
  sem vínculo — em modo leitura (`can: () => false`), rotulado "demonstração".
- **Card do aluno**: `components/player-card.tsx` com `variant="internal" | "public"`.
  `<12 anos` nunca mostra nota (`canShowCardRating`); comportamento só na interna; a landing
  usa a pública. Seed de demo: `pnpm db:seed:demo` (id fixo `01940000-…`).
- **Marca**: o dono enviou o pacote de ícones (favicon/apple/android + `site.webmanifest`)
  por upload no GitHub. O símbolo é raster (não há vetor): `brand/mark.png` (192px) e
  `@2x.png` (384px) foram **recortados do ícone 512px** (bbox 11,79–505,433). O nome
  "NextGen" é texto em `brand-logo.tsx`, não imagem; os SVGs placeholder de `brand/` foram
  apagados. `apple-touch-icon.png` foi recomposto com fundo branco opaco (iOS pinta preto
  atrás de PNG transparente). Paleta do logo = azul `#0e305b` + verde `#80b235`; os tokens
  `--brand #10331f` / `--accent #c9f24d` ainda são os do esboço (mismatch pendente).
- **Rodapé não flutua só com `margin-top: auto`**: precisa de pai flex. `body` em
  `globals.css` é `display:flex; flex-direction:column; min-height:100dvh` justamente por
  isso; páginas públicas novas não precisam de wrapper. Cabeçalho público é
  `components/site-header.tsx` (marca linkando para `/`), usado em `/login` e `/setup`
  para não deixar o usuário sem saída.
- **Logo do rodapé** é `public/dev/logo-icon.png` (lockup símbolo+wordmark+assinatura que o
  dono enviou em `18a5f9a`); nada de recorte próprio. Rodapé escuro usa `filter: brightness(0)
  invert(1)` em vez de um segundo arquivo claro.
- **Verificar layout sem enxergar screenshot**: `chromium --headless --screenshot` grava PNG
  e um decodificador PNG em Python puro mede faixas de cor (cabeçalho/rodapé) e bbox do logo.
  `--dump-dom` **não** espera `setTimeout`, então iframe de medição não funciona; medir por
  pixel é o caminho.
- **Push**: o remote guardado aponta para `https://github.com/...` e pede senha;
  usar `git remote set-url origin https://x-access-token:$GITHUB_TOKEN@github.com/...`,
  pushar e **restaurar a URL** depois. `pnpm build` mata o `.next` do `next dev` em execução:
  reiniciar o dev server depois do build.
