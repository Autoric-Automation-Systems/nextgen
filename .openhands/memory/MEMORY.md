# NextGen — memória do projeto

- SaaS de gestão para escolas de futebol. Repo `Autoric-Automation-Systems/nextgen`.
  Docs 01–17 em PT-BR (`docs/`), código em inglês. `docs/13-fundacao-implementada.md`
  diz o que já existe em código — leia antes de tratar algo como só especificação.
- **Aluno é perfil tutelado, não usuário.** Sem login antes dos 16; quem autentica é o
  responsável. Termos: `school`, `unit`, `room`, `class_group`, `enrollment`, `guardian`,
  `student`, `consent`, `assessment`. **Não existem `season` nem `category`** (migration
  `turma_sem_temporada`): a turma tem nome livre, é o único agrupamento pedagógico, e a idade
  vem de `birth_date`; `students.due_day` é o vencimento. Textos/dados falam "ciclo", não
  "temporada".
- Monorepo pnpm + turbo: `apps/web` (Next 15), `packages/{db,core,auth,integrations}`.
  Storage = Vercel Blob em dois stores (público/privado).

## Isolamento e autenticação
- RLS no Postgres: `ENABLE` + `FORCE`, `withTenant()` seta `app.school_id` na transação.
  Runtime usa `nextgen_app` (`NOSUPERUSER NOBYPASSRLS`); `DATABASE_URL` (dono) só migra/seed.
- `users` é `ENABLE` sem `FORCE` (login lê usuário por e-mail antes de haver sessão;
  `0004_auth_owner_bypass`). **Criar usuário só via `ensureUser`** (`@nextgen/auth`): a
  política permite ao papel de aplicação apenas editar o próprio (`WITH CHECK id = current_user_id`).
- `withSystemJob` (cron) só lê o diretório de `schools` (`system_school_directory`) e nunca
  propaga o sinal adiante: cada escola visitada volta por `withTenant`.
- Better Auth exige `advanced.database.generateId: "uuid"` (P2023 sem isso).
  `BETTER_AUTH_SECURE_COOKIES` existe porque `next start` local roda em produção sobre http.
- Import relativo dentro dos packages **sem extensão** `.js` (webpack do Next não resolve).
- `packages/db` precisa de `postinstall: prisma generate`; `prebuild` nunca roda na Vercel.

## Produção
- Produção = `https://nextgen-three-ebon.vercel.app` (confirme em `/api/health` →
  `config.app.authBase`). `nextgen-autoric.vercel.app` é projeto antigo atrás de SSO.
  `/api/health` devolve `version` = sha servido: é a prova de qual build está no ar.
- Login é um só (`/login`); `lib/bootstrap-admin.ts` roda antes do link mágico: com
  `users = 0` o primeiro e-mail vira admin da plataforma. **Produção estava com `users = 0`**:
  não teste login em prod com e-mail alheio. Não há usuário de seed em prod.
- Login "enviado" sem chegar tem 3 causas silenciosas: `INVALID_ORIGIN`,
  `DATABASE_URL_MIGRATE` inválida e URL/segredo faltando. Sondas: `/api/health?login=1`,
  `?smtp=1`, `mailRecent`.
- Neon: o dono **não** cria papel (42501) — `nextgen_app` nasce no Console → Roles e o build
  só concede GRANT. Papel nasce `NOLOGIN` (P1001 engana o diagnóstico) e o Neon recusa senha
  fraca (12+, maiúscula, número, símbolo). Vercel e Actions não compartilham variáveis: a
  migração roda no `build` (`scripts/migrate-on-deploy.mjs`), só em `VERCEL_ENV=production`.

## Produto e código
- Cobrança: `runMonthlyBilling` gera na janela de 5 dias antes do `due_day`, idempotente por
  `(student_id, competence, kind)` + `invoices.notified_at`; e-mail segue a mesma janela.
  Cron `GET /api/cron/mensalidades` com `CRON_SECRET` (503 sem a variável), `207` se uma
  escola falhar. Botão "Gerar agora" em `/financeiro` chama a mesma função.
- Financeiro v0 é sem gateway: Pix copia-e-cola (`packages/core/src/pix.ts`) + baixa manual.
  `charge:read` vale para `guardian` também (`/meus-boletos`) — telas de escola precisam
  excluir o responsável, ou vazam totais, inadimplência e despesas para a família.
- Consentimento: `/consentimentos` (responsável aceita, admin/coordenação só leem),
  termos versionados em `consent_terms` (texto + `body_hash` sha256), aceite com
  `evidence_hash`/IP/UA, índice parcial = 1 linha autorizada por aluno+finalidade, trigger
  só deixa mudar `status`/`revoked_at`. `lib/consent.ts` fala chaves camel (`publicCard`)
  e converte para código do banco (`public_card`) com `PURPOSE_CODES`/`resolvePurpose`.
  Aceitar `enrollment` ativa a matrícula `draft`; revogar **não** cancela matrícula.
  Card público exige 12+ **e** `image_public` — abaixo de 12 não existe card público
  (decisão fechada em `docs/11` nº 16: o card privado segue mostrando só barras).
- `/equipe`: convite por link mágico (`hasPassword` decide `/dashboard` vs `/definir-senha`),
  cargo por pessoa, turmas do professor, revogação sem apagar histórico. Não muda o próprio
  cargo/acesso; sempre ≥1 admin ativo. E-mail de responsável não pode virar equipe (1
  membership por pessoa+escola).
- **Site público**: `/` → `/como-funciona`; `/escola/solicitar` grava em `school_leads`
  (único `INSERT` do `nextgen_app`, via `$executeRaw`).
- Ativos de marca em `apps/web/public/{brand,icons}`; `lib/brand.ts` é o único com caminhos e
  `brand.test.ts` falha de propósito se um arquivo sumir.
- Vitrine da raiz (`lib/site-cards.ts`): retratos são **ilustrações** em `public/players`.
  Nada de foto de criança baixada da internet — `site-cards.test.ts` exige `release`
  (responsável + termo + data) e crédito em todo retrato `kind: "photo"`. Ruy insiste em
  foto real: pedir arquivo com liberação assinada (de preferência aluno de escola cliente,
  coberto pelo próprio termo) e cadastrar os campos.
- Menu do painel no celular é **gaveta lateral** (`components/app-shell.tsx`), não faixa no
  topo. Ruy rejeitou a faixa.

## Ambiente
- `pnpm lint` roda ESLint de verdade (eslint@8 + `.eslintrc.json` com
  `eslint-config-next`); a CI roda lint, typecheck, test e build.
  `pnpm` some quando o sandbox reinicia: `corepack prepare pnpm@9.15.4 --activate` e, como
  o **turbo** não acha o binário do corepack, criar shim `~/bin/pnpm` com
  `exec node ~/.cache/node/corepack/v1/pnpm/9.15.4/bin/pnpm.cjs "$@"` e pôr no PATH.
- `withTls` força `sslmode=require` em host remoto, mas não em loopback (senão P1011 na CI).
- `pnpm build` mata o `.next` do `next dev` em execução: reiniciar o dev depois.
- **Testes**: `apps/web` exige `APP_DATABASE_URL` só porque `@nextgen/db` instancia o cliente
  no import — `vitest.setup.ts` põe um placeholder. Suítes RLS exigem Postgres com `nextgen_app`.
- E2E local: Postgres na 55432, `alter role nextgen_app with login password`,
  `pnpm --filter @nextgen/db run migrate`, dev com `MAIL_TRANSPORT=console` (link no log).
  Seedar antes de olhar tela: sem seed `/financeiro` parece vazio porque está vazio.
- Medir CSS sem banco: harness HTML em iframe no Chromium headless; para transições usar
  `--force-prefers-reduced-motion`. Para comportamento de tela, `puppeteer-core` com
  `networkidle2` e sonda em `<p data-probe>`.
- Push: trocar o remote para `https://x-access-token:$GITHUB_TOKEN@github.com/...` e restaurar
  depois (o remote salvo pede senha).
