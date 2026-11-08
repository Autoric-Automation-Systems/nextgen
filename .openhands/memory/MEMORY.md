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
- **Neon: o dono do banco não cria papel** (42501). `nextgen_app` nasce no Console → Roles;
  o build só concede GRANT (`app-role-grants.sql`). Migração que exige CREATEROLE aborta em
  P3009 e trava os deploys seguintes. `nextgen_app` nasce `NOLOGIN` (P1001 engana o
  diagnóstico) e o Neon recusa senha fraca no `ALTER ROLE` (12+ com maiúscula, número,
  símbolo).
- **Vercel e GitHub Actions não compartilham variáveis.** As credenciais do Neon estão só
  na Vercel; por isso a migração roda no `prebuild` (`scripts/migrate-on-deploy.mjs`), só
  com `VERCEL_ENV=production`, e nunca derruba o deploy.
- Schema `neon_auth` no banco `nextgen-neon` = Neon Auth habilitado no console. Não é
  criado por nenhuma migração deste repo (só `public` e `app`).
- **`prebuild` nunca roda na Vercel** (`turbo run build` chama o script `build`, não o
  ciclo de vida do npm): passo obrigatório entra dentro de `build`.
- **O Neon valida senha no `ALTER ROLE`**: senha curta/simples volta HTTP 400 do control
  plane com "insecure password". Precisa de 12+ caracteres com maiúscula, minúscula,
  número e símbolo.
- `nextgen_app` nasce `NOLOGIN` (migração de RLS); o login só é ligado pelo build. Papel
  NOLOGIN produz P1001 "can't reach database server", que engana o diagnóstico.
- Sem token da API da Vercel não dá para alterar variável de ambiente por aqui; o
  `VERCEL_AUTOMATION_BYPASS_SECRET` serve só para furar o Deployment Protection.
- **Login quebrado em produção tem 3 causas silenciosas** (o formulário responde "enviado"
  nas três): `INVALID_ORIGIN`, `DATABASE_URL_MIGRATE` que não é URL, e URL/segredo faltando.
  Sondas: `/api/health?login=1`, `?smtp=1`, `mailRecent` (`mail_log`).
- **Produção = `https://nextgen-three-ebon.vercel.app`** (confirmado por `/api/health` →
  `config.app.authBase`). `nextgen-autoric.vercel.app` é projeto anterior e cai em SSO da
  Vercel (302 para `vercel.com/sso-api`) — não é produção. Antes de dizer que o site está
  fora do ar, olhe o `authBase`.
- **Login é um só** (`/login`): o e-mail identifica o perfil; a tela não pergunta papel.
  `lib/bootstrap-admin.ts` roda antes do link mágico: com `users = 0` o primeiro e-mail
  vira **administrador da plataforma** (`is_platform_staff`) e ganha `escola-teste` com um
  aluno; e-mail em `PLATFORM_ADMIN_EMAILS` também. Desconhecido com sistema em uso: nada é
  criado (a verificação morre em `new_user_signup_disabled` — o link **é** enviado).
- **Produção está com `users = 0`**: o primeiro login reivindica a instância. Não teste
  login em produção com e-mail alheio, nem adivinhe o e-mail do dono.
- **Ativos de marca**: `apps/web/public/{brand,icons/{ui,skills},dev}`. `lib/brand.ts` é o
  único lugar com caminho de arquivo (SRP); `BrandLogo`/`SiteFooter`/`SkillIcon` só pedem
  variante. `brand.test.ts` valida que todo caminho do manifesto existe — rename sem editar
  o manifesto quebra o CI de propósito. Os SVGs atuais são placeholders (`<!-- PLACEHOLDER -->`).
  Rodapé liga para `https://www.autoric.com.br` (Autoric).
- **Site público**: `/` (hero + 2 cards: "já tem acesso" e "cadastrar escola") →
  `/como-funciona`. `/escola/solicitar` grava em `school_leads`, onde `nextgen_app` só tem
  INSERT (`$executeRaw`); a exceção é reaplicada em `app-role-grants.sql`. Aluno <16 sem conta.
- **E2E local sem credencial de produção**: `apt-get install postgresql` (porta 55432 em
  `postgresql.conf`), `alter role postgres password` + `create database nextgen`, e
  `alter role nextgen_app with login password ... nosuperuser nobypassrls` — sem senha no
  `nextgen_app` o `/dashboard` estoura P1000 depois de um login que "deu certo". Migrar
  com `pnpm --filter @nextgen/db run migrate`. Subir o dev com `MAIL_TRANSPORT=console`:
  o link mágico sai no log e dá para percorrer login → dashboard de verdade.
  O browser tool alcança `localhost:3000`.
- **pnpm some do `/tmp`** quando o sandbox reinicia: `npm i -g pnpm@9.15.4 --prefix /tmp/npmbin`.
- **Sandbox reseta e leva `/tmp` junto**: `pnpm`/`psql` somem no meio da sessão; voltar
  com `npm i -g pnpm@9.15.4 --prefix /tmp/npmbin`. Testes de RLS do `@nextgen/db` exigem
  Postgres em 55432 e falham sem ele — não é regressão de código.
- `BETTER_AUTH_SECRET` ausente derruba `/dashboard` com 500 sem texto (Better Auth lança em
  `create-context`). O health agora devolve `missing` e responde `degraded`.
- O build não tem log acessível: `public.deploy_log` (escrito por
  `scripts/migrate-on-deploy.mjs`, lido pelo health em `lastDeploy`) é a janela para ele.
- **Plataforma e perfis**: `PLATFORM_ADMIN_EMAILS` (env) + `users.is_platform_staff`
  (coluna, para revogar sem redeploy). A política `platform_directory` usa
  `app.is_platform_staff()`; `withoutTenant` zera `app.user_id` e cega a política — diretório
  usa `withUser(userId, …)`. A plataforma vê **todos** os itens do menu (`lib/nav.ts`), e o
  aviso "modo leitura" só aparece quando não há vínculo com a escola.
- **Menu do painel**: `apps/web/lib/nav.ts` (`NAV` + `navSectionsFor`) é a regra de quem vê
  o quê; `components/sidebar.tsx` só desenha. Itens `soon` aparecem sem link.
  `resolveWorkspace` cai na Escola Teste (`slug escola-teste`) quando o usuário é plataforma
  sem vínculo — em modo leitura (`can: () => false`), rotulado "demonstração".
- **Card do aluno**: `components/player-card.tsx` com `variant="internal" | "public"`.
  `<12 anos` nunca mostra nota (`canShowCardRating`); comportamento só na interna; a landing
  usa a pública. Seed de demo: `pnpm db:seed:demo` (id fixo `01940000-…`).
- **Marca**: pacote de ícones veio do dono. Símbolo é raster (`brand/mark{,@2x}.png`
  recortados do ícone 512px); "NextGen" é texto em `brand-logo.tsx`. Paleta do logo =
  `#0e305b` + `#80b235`; tokens `--brand #10331f` / `--accent #c9f24d` ainda são do esboço
  (mismatch pendente).
- **Rodapé não flutua só com `margin-top: auto`**: precisa de pai flex. `body` em
  `globals.css` é `display:flex; flex-direction:column; min-height:100dvh` justamente por
  isso; páginas públicas novas não precisam de wrapper. Cabeçalho público é
  `components/site-header.tsx` (marca linkando para `/`), usado em `/login` e `/setup`
  para não deixar o usuário sem saída.
- **Logo do rodapé** é `public/dev/logo.png` (lockup completo, 785x225) a 34px de altura:
  abaixo de ~30px a linha de assinatura some. Sem `loading="lazy"` — marca de rodapé com
  lazy só pisca na rolagem. Rodapé escuro usa `filter: brightness(0) invert(1)`; filtro não
  existe em cliente de e-mail, então e-mail usa o arquivo colorido sobre fundo claro.
- **Padrão de acabamento** (pedido do dono): construir "como grande marca constrói", com as
  fontes da literatura (WCAG 2.2 AA, WAI-ARIA APG, HIG/Material 3, Nielsen, GOV.UK, guias de
  e-mail transacional, OWASP). Está em `docs/16-padroes-de-acabamento.md` + seção no
  `AGENTS.md`. Toda tela com os quatro estados (vazio, carregando, erro, sem permissão).
- **E-mail do link mágico**: `packages/auth/src/magic-link-email.ts` (HTML em tabela, 600px,
  preheader, botão + link por extenso, versão texto). Prévia em `/sistema/email`.
  `resendMailer` passou a enviar `html` — antes só saía texto.
- **Menu Ajuda**: seção `ajuda` em `lib/nav.ts`, liberada por seção (não por papel) e ancorada
  no rodapé do menu (`sidebar-section.is-help`). `/ajuda` é a central; `/como-funciona` já
  existia. Item externo passa por `external: true` → `<a target=_blank>`.
- **Ação de servidor com `redirect()`**: `try/catch` em volta engole o `NEXT_REDIRECT` e a
  tela mostra "não foi possível". Primeira linha do `catch`: `unstable_rethrow(error)`.
  E ação que apaga a própria linha avisa por `?aviso=` (o componente do resultado some).
- **RLS isola escola, não papel**: responsável/professor leem qualquer linha da escola se a
  query deixar. Escopo por papel (professor → `teachers: { some: { userId } }`; responsável
  fora de `/turmas`) é sempre explícito no código.
- `class_group_teachers` tem unique `(class_group_id, user_id, from_date)` — revincular no
  mesmo dia precisa reabrir o vínculo (`to_date = null`) em vez de inserir.
- **`pnpm -r test` no local exige `pnpm db:seed` antes**: a suíte de RLS de `packages/db`
  procura as escolas/alunos do seed e falha com 6 testes vermelhos num banco só migrado.
- **Casca fixa**: `body { height:100dvh; overflow:hidden }` + `body > main { flex:1;
  min-height:0; overflow-y:auto }`; no painel, `.shell`/`.shell-side`/`.shell-content` com o
  mesmo desenho. Página nova precisa de `<main>` como filho direto do `body`, e o `.wrap`
  (1080px) **dentro** dele — `main` com `max-width` põe a barra de rolagem no meio da tela.
  Celular (≤820px) suspende só menu/rodapé; cabeçalho fica `sticky`.
- **Verificar layout e rolagem de verdade**: Node 24 tem `WebSocket` global, então dá para
  dirigir o chromium por CDP (`--remote-debugging-port=9222`, `Runtime.evaluate` +
  `Page.captureScreenshot`) sem Playwright. É o único jeito de provar que header/rodapé
  ficam parados depois de rolar. `document.querySelector('footer')` pega o `.player-card-foot`
  do card — usar `.footer`. `--dump-dom` não espera `setTimeout`; para pixel, decodificador
  PNG em Python.
- **Verificação no navegador**: a ferramenta de browser clica antes da hidratação e dá
  falso negativo em formulário React. Para provar comportamento de tela, dirigir o
  chromium com `puppeteer-core` (`/tmp/pptr`, binário `/usr/bin/chromium`) esperando
  `networkidle2`; sonda de estado vai num `<p data-probe>`, nunca em `document.title`.
- `pnpm lint` pende (prompt do `next lint`, sem config); a CI roda só typecheck e test.
  Neste shell, `pnpm` só existe via
  `export PATH="/usr/local/lib/node_modules/corepack/shims:$PATH"`.
- **`withTls` e loopback**: `packages/db/src/env.ts` força `sslmode=require` em host
  remoto; em loopback não pode, ou a suíte de RLS morre com P1011 no Postgres da CI.
- **Push**: o remote guardado aponta para `https://github.com/...` e pede senha;
  usar `git remote set-url origin https://x-access-token:$GITHUB_TOKEN@github.com/...`,
  pushar e **restaurar a URL** depois. `pnpm build` mata o `.next` do `next dev` em execução:
  reiniciar o dev server depois do build.
