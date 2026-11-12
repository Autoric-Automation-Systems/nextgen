# 14 — Deploy na Vercel

Runbook do primeiro deploy de produção. Ordem importa: banco antes da Vercel, migração
antes do primeiro acesso.

O que o deploy **não** cria sozinho:

| Peça | Quem cria | Por quê |
|---|---|---|
| Projeto Vercel | você (importar o repo) | não há token de API no ambiente |
| Postgres gerenciado | você (Neon ou equivalente) | precisa de duas credenciais distintas |
| Papel `nextgen_app` | as migrações criam, você define a senha | a RLS depende desse papel |
| Store do Vercel Blob | você (dashboard) | só existe por projeto |

---

## 1. Banco de dados

A aplicação exige **duas URLs diferentes**, e isso não é zelo excessivo:

- `DATABASE_URL` — dono das tabelas. Usada só por migração e seed.
- `APP_DATABASE_URL` — papel `nextgen_app`, `NOSUPERUSER NOBYPASSRLS`. É a que roda o app.

Se as duas forem iguais, todo o isolamento entre escolas deixa de existir e nada quebra na
tela. O `/api/health` denuncia exatamente isso (`rls: false`).

### 1.1 Criar o banco

Neon é o caminho mais curto na Vercel: **Storage → Create → Neon**, região
`sa-east-1` (São Paulo) para ficar na mesma região das funções. O provisionamento injeta
`DATABASE_URL` e `DATABASE_URL_UNPOOLED` no projeto.

Copie as duas:

```
DATABASE_URL          → host com -pooler  (usada pelo app)
DATABASE_URL_UNPOOLED → host sem -pooler  (usada pela migração)
```

**A URL pooled precisa de parâmetros do PgBouncer.** Neon põe um pooler em modo
*transaction* na frente do banco, e esse modo não suporta *prepared statement*. O Prisma usa
prepared statements por padrão, então sem os parâmetros a aplicação sobe e falha na primeira
query com `prepared statement "s0" already exists` ou `bind message supplies 0 parameters`:

```
postgresql://nextgen_app:SENHA@ep-xxx-pooler.sa-east-1.aws.neon.tech/nextgen  ?sslmode=require&pgbouncer=true&connection_limit=1
```

`connection_limit=1` porque cada instância de função é um processo curto: uma conexão por
função evita esgotar o pool com lambdas ociosas.

O contexto de tenant é aplicado com `set_config(..., true)`, que é escopo de transação — por
isso convive com o modo *transaction*. Se algum caminho de código esquecer a transação, o
contexto morre no fim do statement e a política devolve zero linhas: **falha fechada**, não
vazamento.

### 1.2 Criar o papel de aplicação e migrar

**No Neon, `CREATE ROLE` por SQL não funciona.** O dono do banco (`neondb_owner`) não é
superusuário e não tem `CREATEROLE`, então qualquer `create role` responde:

```
ERROR: permission denied to create role
DETAIL: Only roles with the CREATEROLE attribute may create roles.
```

O papel então nasce fora do SQL, pelo console:

1. **Neon Console → projeto → Roles → Create role**: nome `nextgen_app`, marque para gerar
   uma senha e copie.
2. Monte `APP_DATABASE_URL` com esse usuário, no host *pooled*:
   `postgresql://nextgen_app:SENHA@ep-xxx-pooler.regiao.aws.neon.tech/neondb?sslmode=require&pgbouncer=true`
3. Deixe o build aplicar as migrações (seção 3, "Migração no build"). A cada deploy o
   script confere os `GRANT`s do papel — necessário porque a migração de RLS pode ter
   rodado antes de o papel existir, e migração aplicada não roda de novo.

A verificação mínima:

```bash
psql "<pooled>" -c "select rolname, rolsuper, rolbypassrls, rolcanlogin from pg_roles where rolname = 'nextgen_app';"
# esperado: rolsuper = f, rolbypassrls = f, rolcanlogin = t
```

> **Por que a migração não cria o papel:** ela tenta, e captura `insufficient_privilege`
> com um aviso. Sem isso a migração aborta, o Prisma registra a falha e **passa a recusar
> qualquer migração nova** (P3009) — um erro de permissão virava bloqueio permanente do
> banco. Ver seção 8.
>
> **Último recurso**, se o provedor não permitir papel adicional: use o próprio papel dono
> como `APP_DATABASE_URL`. Funciona porque as tabelas de domínio têm `FORCE ROW LEVEL
> SECURITY` (vale até para o dono) e o `/api/health` continua dando `rls: true` desde que
> o papel não tenha `BYPASSRLS`. Fica menos isolado — o dono lê qualquer tabela — então
> trate como dívida.

### 1.3 Migrar sem ter o repositório na máquina

O caminho normal não precisa de nada disso: o build da Vercel migra com as variáveis que já
existem no projeto (seção 3). O workflow **`migrate`** (`.github/workflows/migrate.yml`)
existe para rodar à mão — **Actions → migrate → Run workflow**, digitando `migrate` para
confirmar — mas ele **não enxerga as variáveis da Vercel**: são cofres separados. Para usá-lo,
cadastre em **Settings → Secrets and variables → Actions**:

| Secret | Valor |
|---|---|
| `DATABASE_URL_UNPOOLED` | a URL sem `-pooler`, do banco `nextgen-neon` |
| `APP_DB_PASSWORD` | senha do papel `nextgen_app` (só se ele já existir) |

Sem esses secrets o workflow para em "Nenhuma URL direta encontrada" — é o mesmo banco, mas
o GitHub não tem a credencial.

### 1.3.1 O schema `neon_auth` não é deste projeto

Se aparecer um schema `neon_auth` no banco, ele **não** foi criado por estas migrações:
elas criam apenas `public` e `app`. `neon_auth` é criado pelo **Neon Auth** — a
autenticação gerenciada do console (**Neon Console → projeto → Auth → Enable**) — que
guarda ali usuários, sessões e configuração de provedores. A documentação da Neon descreve
exatamente isso: "all users, sessions, and organizations live in the `neon_auth` schema".

Para confirmar a origem e o dono:

```sql
select nspname, pg_get_userbyid(nspowner) as dono
from pg_namespace where nspname = 'neon_auth';

select table_name from information_schema.tables
where table_schema = 'neon_auth' order by 1;
```

Ele não atrapalha as migrações nem o RLS — as tabelas da aplicação estão em `public`, e as
políticas leem `app.current_user_id()`, não `neon_auth`. O problema é outro: **passam a
existir duas bases de usuários** (a nossa, em `public.users`, e a do Neon Auth). Se o Auth
foi habilitado por engano, desabilite no console e remova o schema
(`drop schema neon_auth cascade`) com o Auth desligado. Se quiser usá-lo de verdade, é uma
decisão de arquitetura: o Neon Auth também roda Better Auth, mas as políticas de RLS e o
`membership` da aplicação continuariam apontando para `public.users`.

### 1.3.2 O papel nasce `NOLOGIN` — de propósito

A migração de RLS cria `nextgen_app` sem login: quem liga o login é o build, com a senha
da variável `APP_DB_PASSWORD`. São dois passos separados porque a senha não pode viver no
SQL versionado.

Consequência prática: esquema migrado com papel `NOLOGIN` não autentica, e o erro que
aparece na tela é `P1001 — can't reach database server`, que sugere host errado. O
`/api/health` mostra a verdade em `role.can_login`, e o build registra o que aconteceu em
`public.deploy_log` (lido pelo health em `lastDeploy`).

Se o build não conseguir ligar o login, o caminho é o SQL Editor do Neon:

```sql
alter role nextgen_app login password 'SENHA-FORTE';
```

O Neon valida a senha nesse comando: menos de 12 caracteres, ou tudo minúsculo, devolve
`insecure password` (HTTP 400 do control plane). Use maiúscula, minúscula, número e
símbolo — e o mesmo valor em `APP_DB_PASSWORD` na Vercel.

### 1.4 Sem dados de demonstração em produção

Não rode `pnpm db:seed` em produção: ele cria as escolas `demo` e `rival` com alunos
fictícios. O primeiro acesso real é o do item 4.

---

## 2. Projeto na Vercel

Projeto criado: **`nextgen-three-ebon`** → `https://nextgen-three-ebon.vercel.app`.

Esse é o endereço de produção: `/api/health` responde `config.app.authBase` com ele, e é
o nome que o link mágico usa para montar a URL de retorno. O antigo
`nextgen-autoric.vercel.app` — de um projeto anterior — continua respondendo, mas atrás de
*Deployment Protection*; não use para cadastro nem para teste de login.

### Os dois campos que não podem ficar no padrão

| Campo | Errado | Certo |
|---|---|---|
| Root Directory | `./` (raiz do repo) | `apps/web` |
| Framework Preset | Other | **Next.js** |

Não existe atalho: mantenha a Root Directory em `./` e o build até roda, mas a Vercel não
encontra a função do Next.js e serve `404 NOT_FOUND` em tudo. O preset *Other* trata o
output como arquivos estáticos, e `.next` não é um site estático — é build de servidor.

Com Root Directory na raiz e preset *Other*, a Vercel não aplica o builder do Next.js:
ela espera arquivos estáticos em `public/` e não cria a função serverless. O resultado é
`404 NOT_FOUND` em **todas** as rotas, com `content-type: text/plain` — resposta da
plataforma, não da aplicação. O `apps/web/vercel.json` também é ignorado, porque a Vercel
só lê o `vercel.json` que está na Root Directory.

O repositório já está pronto para importar como está.

Na Vercel: **Add New → Project → importar `Autoric-Automation-Systems/nextgen`**.

| Campo | Valor |
|---|---|
| Framework Preset | **Next.js** |
| **Root Directory** | **`apps/web`** |
| Include files outside the root directory | habilitado (a Vercel liga sozinha ao detectar o workspace) |
| Build Command | vazio — o `vercel.json` define |
| Install Command | vazio — o `vercel.json` define |
| Output Directory | vazio — padrão `.next` |
| Node.js Version | **24.x** |

Se preferir preencher em vez de deixar vazio, use exatamente os valores do
`apps/web/vercel.json`:

```
install: pnpm install --frozen-lockfile
build:   pnpm --filter @nextgen/db run build && pnpm run build
```

Não use `next build` cru: fora do `pnpm run`, o binário `next` depende do `PATH` e o
build falha com `next: not found` (código 127).

Trocar a Root Directory depois exige **Redeploy** — a mudança não recompila o deploy
existente.

### Versão do Node

Use **24.x**. Não é preferência estética:

| Versão | Situação em nov/2026 | Serve? |
|---|---|---|
| 20 | EOL desde abr/2026, removida da Vercel em out/2026 | não |
| 22 | Maintenance LTS até abr/2027 | funciona, mas é a anterior |
| **24** | **Active LTS até abr/2028** | **sim** |
| 26 | LTS desde out/2026, poucas semanas | ainda não |

Versão mais nova não é versão melhor aqui. Node 26 virou LTS em outubro de 2026: é recente
demais para ser o runtime de um sistema que vai guardar dado de criança. O risco concreto
não é sintaxe — é binário nativo: o *query engine* do Prisma e o `sharp` do `next/image`
publicam builds por versão de Node, e o intervalo entre um Node novo e esses binários
estarem estáveis é justamente onde aparecem falhas de runtime que só reproduzem em produção.

Node 24 tem o que importa: ainda recebe correção de segurança por mais de um ano, tem
binário publicado por todo o ecossistema, e é a mesma versão em que a suíte roda aqui
(`v24.21.0`, 77 testes). Desenvolvimento e produção na mesma versão evita a classe de bug
que aparece só num dos dois.

O `package.json` fixa `engines.node: "24.x"` e há um `.nvmrc` com `24` para o ambiente
local seguir junto.

---

## 3. Variáveis de ambiente

**Settings → Environment Variables**. Marque `Production`; as de preview ficam para depois.

| Variável | Valor | Obrigatória |
|---|---|---|
| `DATABASE_URL` | conexão **pooled** do banco | sim |
| `APP_DATABASE_URL` | conexão pooled com usuário `nextgen_app` e senha | sim |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | sim |
| `BETTER_AUTH_URL` | `https://seudominio.com.br` (sem barra no fim) | sim |
| `EMAIL_USER` | conta que envia (ex.: `escola@gmail.com`) | sim, sem Resend |
| `EMAIL_PASS` | **senha de app** do Google, não a senha da conta | sim, sem Resend |
| `MAIL_FROM` | remetente exibido; vazio = `NextGen <EMAIL_USER>` | não |
| `RESEND_API_KEY` | chave do Resend (alternativa ao SMTP) | sim, sem SMTP |
| `CRON_SECRET` | `openssl rand -hex 32` — segredo do agendador de mensalidades | sim |
| `BLOB_PUBLIC_READ_WRITE_TOKEN` | store `public` | quando o upload entrar |
| `BLOB_PRIVATE_READ_WRITE_TOKEN` | store `private` | quando o upload entrar |

O `/api/health` confere isso por você: `missing` lista o que falta para o app servir, e
com a lista não vazia ele responde `degraded` em vez de `ok`. Sem `BETTER_AUTH_SECRET`, o
Better Auth lança em toda página autenticada e o sintoma é um `500` sem texto — foi o que
manteve `/dashboard` fora do ar depois de o banco já estar bom.

### Cobrança automática: quem chama o cron

`GET /api/cron/mensalidades` gera e envia as mensalidades que entraram na janela de 5 dias
antes do vencimento. Ele recusa tudo sem `Authorization: Bearer $CRON_SECRET`, então a
variável é obrigatória em produção — sem ela a rota responde `503`.

Cadastre o agendador fora da Vercel (GitHub Actions, cron-job.org, cron da própria VPS),
de hora em hora:

```
*/30 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://seudominio.com.br/api/cron/mensalidades
```

A rota é idempotente: chamar de meia em meia hora não cobra nem avisa duas vezes. A resposta
é um resumo (`created`, `emailed`, `failures`); `207` significa que alguma escola falhou e as
outras seguiram. O cron da Vercel (plano Pro, `vercel.json`) serve igual, com `crons` apontando
para o mesmo caminho.

Se o agendador não rodar, nada se perde: o botão **Gerar agora** em `/financeiro` usa a mesma
função e envia o que já está na janela.

### O domínio público não pode estar atrás da proteção da Vercel

Confira antes de divulgar o endereço:

```
curl -s -o /dev/null -w "%{http_code}\n" https://seu-dominio/login
```

`200` é o esperado. `302` para `vercel.com/sso-api` significa **Deployment Protection**
ligada: o responsável que clicar no link do e-mail cai numa tela de login da Vercel, que
ele não tem. Desligue em **Settings → Deployment Protection → Vercel Authentication** ou
use o domínio de produção do projeto, que nasce sem proteção.

Um projeto responde por vários nomes (`nextgen-three-ebon.vercel.app`,
`nextgen-autoric.vercel.app`). Eles não são equivalentes: a proteção pode valer para um e
não para o outro, e o login só aceita os que estão em `trustedOrigins`. O health mostra o
endereço que o Better Auth considera canônico em `config.app.authBase`.

`BETTER_AUTH_SECRET` **não pode ser trocado** depois que houver sessões: todos os cookies
existentes deixam de valer e todo mundo é deslogado.

Sem transporte configurado, o link mágico não é enviado e o login simplesmente não
acontece — de propósito. O `/api/health` responde `"mail": "missing"` nesse caso. O
transporte de console (que imprime o link no log) é ignorado quando `VERCEL_ENV=production`,
porque log de produção vira acesso à conta de qualquer pessoa.

### E-mail: Gmail por SMTP ou Resend

SMTP tem precedência quando `EMAIL_USER` + `EMAIL_PASS` existem; Resend só entra se não
houver SMTP. Force um dos dois com `MAIL_TRANSPORT=smtp|resend|console`.

Com Gmail, o padrão do código já resolve o resto: host `smtp.gmail.com` quando o usuário
termina em `@gmail.com`, porta 465 (TLS implícito), `From` igual à conta autenticada.
Para outro provedor, defina `EMAIL_HOST` e, se a porta for 587, `EMAIL_PORT=587`.

```
EMAIL_USER=escola@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop     ← senha de app, 16 caracteres, sem espaços
```

**`EMAIL_PASS` é senha de app.** Com 2FA ligado, o Gmail recusa a senha da conta com
`535-5.7.8 Username and Password not accepted`; sem 2FA, o Google descontinuou "apps menos
seguros" e o SMTP também é recusado. Gere em **Conta Google → Segurança → Senhas de app**.

O health confirma que a porta abre a partir da Vercel, o que distingue senha errada de
bloqueio de rede:

```json
"smtp": { "host": "smtp.gmail.com", "port": 465, "reachable": true }
```

Limites do Gmail que importam para escola de futebol:

| Limite | Valor |
|---|---|
| destinatários por dia (conta gratuita) | 500 |
| destinatários por dia (Workspace) | 2.000 |
| mensagens por conexão | 100 |

Um link por convite (não por login), mais avisos de mensalidade: 500/dia atende um
piloto, não uma rede de escolas. Quando passar de uma escola com movimento,
troque para Resend ou SMTP transacional — a troca é só variável de ambiente.

### Migração: no build da Vercel, não no GitHub Actions

As credenciais do banco vivem nas variáveis do projeto na Vercel — a integração Neon
cria `DATABASE_URL_UNPOOLED`, `PGHOST`, `PGPASSWORD`. **O GitHub Actions não enxerga
essas variáveis**: são plataformas separadas, com cofres separados. Um workflow que
espera `DATABASE_URL_MIGRATE` não acha nada, mesmo com tudo configurado na Vercel.

Por isso a migração roda no `prebuild` do site (`scripts/migrate-on-deploy.mjs`), com as
variáveis que já existem:

1. testa cada URL direta disponível e usa a que responder;
2. aplica `prisma migrate deploy`;
3. liga o login do papel `nextgen_app` com `APP_DB_PASSWORD`.

O build não falha se nenhuma URL responder — nesse caso o site segue no ar e
`/api/health` mostra `migrations: "ausentes"`, que é melhor que derrubar o site.

O workflow `migrate` do GitHub continua existindo para rodar à mão, e agora aceita os
nomes da integração Neon. Ele só funciona se um secret existir no GitHub; a Vercel não
empresta os dela.

### Pooled ou direct?

| Uso | Conexão |
|---|---|
| Funções serverless (`DATABASE_URL`, `APP_DATABASE_URL`) | pooled |
| Migração, seed, `psql` manual | direct (sem `-pooler`) |

O `withTenant()` abre transação e usa `set_config(..., true)`, que é local à transação. Em
pooling de transação a conexão fica presa ao backend durante a transação, então o contexto
chega íntegro às políticas. É justamente por isso que a RLS precisa de transação e não de
`SET` solto.

### Vercel Blob: dois stores, e por quê

O modo de acesso é propriedade do **store**, não do arquivo: um store é público ou privado
na criação, e um arquivo privado não pode morar num store público. Cada store tem seu
próprio token de leitura e escrita — daí as duas variáveis.

| Store | Conteúdo | Entrega |
|---|---|---|
| `nextgen-public` | logo, hero, galeria do site | CDN, cache de 30 dias |
| `nextgen-private` | foto de aluno e responsável, documentos, anamnese, vídeo de treino, comprovante | URL assinada, 15 min |

**A foto do aluno fica no store privado, mesmo com o card público na web.** Isso não é
timidez: URL de store público não pode ser despublicada, e o `uploadPublic` define cache de
30 dias na borda. Revogar o consentimento de uso de imagem de uma criança precisa valer
agora — com o arquivo num store público, ela pode continuar acessível por semanas e não há
como recolher cópias. O card renderiza a foto por URL assinada, com TTL curto e checagem de
`public_card_enabled` e consentimento de imagem.

Nenhum dos dois é obrigatório hoje: o upload ainda não está ligado a nenhuma rota, e o
`/api/health` não sonda o Blob. Crie os stores quando a fase de conteúdo começar.

---

## 4. Primeiro acesso

O login é por **e-mail e senha** e **não existe auto-cadastro** (`disableSignUp: true`):
nenhum usuário nasce pela tela de login.

O link por e-mail continua, mas só em `/cadastro` e só para primeiro acesso ou convite:
o clique leva a `/definir-senha`, onde a pessoa escolhe a senha que vai usar no login.
Todo convite gasta um e-mail; login do dia a dia não gasta nenhum.

Espere o deploy terminar com `migrations: "aplicadas"` no `/api/health`.

### Primeiro administrador

Sem conta, o link do e-mail chega e o clique volta para o login com
`new_user_signup_disabled`: `disableSignUp` está ligado, então o Better Auth não cria
usuário por conta própria.

**Pelo cadastro (recomendado):** em `/cadastro`, informe o e-mail e peça o link. Antes de
enviar, o cadastro resolve o caso em que ninguém conseguiria entrar e, se for o caso, cria
usuário, escola e vínculo de administrador na mesma transação:

| Situação | O que acontece |
|---|---|
| instalação sem nenhum usuário | qualquer e-mail vira administrador e ganha a escola `Escola Teste` com um aluno de exemplo |
| e-mail em `PLATFORM_ADMIN_EMAILS` | vira administrador da plataforma (`is_platform_staff`) e recebe a escola de teste se ainda não tiver vínculo |
| e-mail de pessoa já cadastrada, com vínculo | nada é criado; o link é enviado normalmente |
| e-mail desconhecido, com o sistema já em uso | nada é criado; o clique cai em `new_user_signup_disabled` |

Quem opera o produto define a senha no link do primeiro acesso e depois entra por
`/login`. Sendo administrador da plataforma, vê todos os menus — escola, família e plataforma. `PLATFORM_ADMIN_EMAILS` é uma lista separada
por vírgula; gravar na env **e** na coluna `users.is_platform_staff` é intencional (env
adiciona, coluna mantém), então revogar acesso não depende de redeploy.

Crie a escola de verdade depois: `/setup` continua disponível em instalação vazia para
quem preferir já nomear a escola, e os dados da escola de teste se editam em "Site da
escola".

**Pela Vercel (roda a cada deploy):** defina e redeploye.

| Variável | Obrigatória | Exemplo |
|---|---|---|
| `BOOTSTRAP_ADMIN_EMAIL` | sim | `diretor@escola.com.br` |
| `BOOTSTRAP_ADMIN_NAME` | não | `Maria Souza` |
| `BOOTSTRAP_SCHOOL_NAME` | não | `Escola Gol de Ouro` |
| `BOOTSTRAP_SCHOOL_LEGAL_NAME` | não | `Gol de Ouro Ltda` |
| `BOOTSTRAP_SCHOOL_SLUG` | não | derivado do nome | 

É idempotente: promove o que existe, não duplica. O resultado aparece em
`/api/health` como `deploy: admin-ok`. Deixe a variável no lugar enquanto a escola
tiver só um administrador; remova quando houver mais de um.

**Pelo SQL Editor do Neon (manual):** edite `scripts/bootstrap-admin.sql` com o seu e-mail
e o nome da escola, cole no
**SQL Editor do Neon** (conexão *direct*, sem `-pooler`) e execute. Ele cria usuário, escola e
vínculo de administrador, e é idempotente — pode rodar de novo para corrigir nome.

Depois entre em `https://nextgen-three-ebon.vercel.app/login` com esse e-mail.

Dois detalhes que fazem esse SQL falhar se escrito à mão:

- a tabela `schools` **não tem coluna `name`**: são `legal_name` (razão social) e
  `trade_name` (nome fantasia), ambas obrigatórias;
- `updated_at` não tem default no banco — o Prisma o preenche pela aplicação, então em SQL
  manual ele precisa ir explícito.

O convite de responsável e aluno entra na fase de matrícula.

---

## 5. Proteção de deploy

O domínio de produção `nextgen-three-ebon.vercel.app` está **aberto** (verificado: `/login`
responde `200`). O que continua trancado é `nextgen-autoric.vercel.app`, de um projeto
anterior: qualquer requisição ali devolve `302` para `vercel.com/sso-api`, porque
*Deployment Protection* está em **Vercel Authentication**.

Um projeto responde por vários nomes e eles não são equivalentes: confira sempre qual é o
`authBase` do health antes de concluir que o site está fora do ar — o `302` pode ser só o
apelido errado.

Se um dia a produção for fechada por engano, reabra em **Settings → Deployment Protection →
Vercel Authentication → Only Preview Deployments**. Para verificar de fora com a proteção
ligada, gere um **Protection Bypass for Automation**:

```bash
VERCEL_AUTOMATION_BYPASS_SECRET=... node scripts/check-deploy.mjs https://nextgen-three-ebon.vercel.app
```

---

## 6. Verificação

O script não tem dependência e checa o que realmente importa:

```bash
node scripts/check-deploy.mjs https://seudominio.com.br
```

```
ok   / (landing) → 200
ok   /login → 200
ok   /dashboard sem sessão → 307
ok   /api/health → 200 db=up rls=true migrations=aplicadas mail=resend 33ms

deploy íntegro
```

Quando algo está errado, o próprio relatório aponta a correção:

```
FALHA /api/health → 503 db=up rls=false migrations=ausentes mail=missing 13ms
       A aplicação conectou com papel que ignora RLS (superusuário ou BYPASSRLS).
       Revise APP_DATABASE_URL: o isolamento entre escolas não está valendo.
       Conexão funciona, mas as tabelas não existem.
       Rode o workflow `migrate` (Actions → migrate → Run workflow).
       variáveis ausentes: authSecret, authUrl, mailFrom, resendKey
```

Três estados são independentes e é fácil confundir um com o outro:

| Campo | Significa |
|---|---|
| `db` | a conexão TCP/TLS com o Postgres abriu |
| `migrations` | as tabelas existem naquele banco |
| `rls` | o papel conectado respeita as políticas |

`db: up` com `migrations: ausentes` é o caso mais traiçoeiro: o health parece metade
saudável, e toda tela autenticada devolve 500.

O script **nunca segue redirect**, e isso é deliberado: o SSO da Vercel devolve 200 na
página de login, então seguir redirect faria um deploy trancado parecer saudável. Porta
fechada vira `BLOQ … → 302 para o SSO da Vercel` e código de saída 3.

Falha em `rls=true` é bloqueante: significa que a aplicação está conectada com um papel
que ignora as políticas. Não é bug de tela, é vazamento entre escolas.

Se o deploy estiver protegido, gere **Settings → Deployment Protection → Protection Bypass
for Automation** e rode com `VERCEL_AUTOMATION_BYPASS_SECRET=...`.

---

## 7. Previews

Previews servem para revisar PR, não para uso real. Para eles funcionarem:

- `MAIL_TRANSPORT=console` — o link aparece no log da função e não vai para ninguém.
  Recusado em produção.
- `BETTER_AUTH_TRUSTED_ORIGINS` com a URL do preview, se o domínio não for o gerado pela
  Vercel. Com `BETTER_AUTH_URL` vazio, o código usa `https://${VERCEL_URL}` automaticamente.
- Nunca aponte preview para o banco de produção: qualquer teste grava dado de aluno real.

---

## 8. Problemas comuns

| Sintoma | Causa | Correção |
|---|---|---|
| `404 NOT_FOUND` em todas as rotas, `content-type: text/plain` | Root Directory na raiz + preset Other | Root `apps/web` + preset Next.js — ver seção 2 |
| Build falha em `prisma generate` | `DATABASE_URL` ausente no build | a variável precisa existir também em Production *and* Preview |
| Runtime: *Query engine … not found* | falta `rhel-openssl-3.0.x` | já declarado no schema; rode `prisma generate` no build |
| Login responde ok, e-mail não chega | `mail: "missing"` no health | configure `EMAIL_USER` + `EMAIL_PASS` ou Resend |
| Login 500 com `535` | senha da conta em vez de senha de app | gere senha de app no Google |
| Login pendura e cai em timeout | `smtp.reachable: false` no health | porta bloqueada; use 587 ou Resend |
| `INVALID_TOKEN` ao abrir o link | cookie/URL de origem divergente | `BETTER_AUTH_URL` igual ao domínio acessado; sem barra final |
| Tudo vazio, sem erro | sessão sem `schoolId` resolvido | usuário sem `membership` ativa — ver item 4 |
| Todo acesso redireciona para `vercel.com/login` | Deployment Protection ativa | ver seção 5 |
| `/api/health` → 503 `rls:false` | `APP_DATABASE_URL` aponta para papel com `BYPASSRLS` ou superusuário | usar `nextgen_app` |
| Latência alta em toda página | banco em outra região | mover para `sa-east-1` |
| `P3018` / `P3009` nas migrações | `create role` recusado (42501) abortou a migração de RLS; o Prisma registra a falha e bloqueia as seguintes | o build corrige sozinho (`migrate resolve --rolled-back` + nova tentativa); o papel `nextgen_app` deve existir em Neon → Roles |
| `/api/health` → `migrations: "falhou"` | migração abortada e não resolvida | veja `migrationFailed` no health; o próximo deploy tenta de novo |
| Schema `neon_auth` no banco | Neon Auth habilitado no console | não é do projeto — ver 1.3.1 |
| `insecure password` ao gravar a senha | Neon recusa senha fraca no `ALTER ROLE` (400 do control plane) | `APP_DB_PASSWORD` com 12+ caracteres, maiúscula, minúscula, número e símbolo |
| Papel existe mas `can_login: false` | migração cria `nextgen_app` como `NOLOGIN`; o login vem do build | o build liga o login; se falhar, o `deploy_log` diz por quê |

---

## 9. Domínio

**Settings → Domains**. Depois de apontar o domínio:

1. Atualize `BETTER_AUTH_URL` para o domínio final e faça redeploy — o Better Auth usa essa
   URL para montar o link do e-mail e validar origem.
2. Reenvie o teste do item 5.

Não é possível "só trocar o DNS": com a URL antiga, o link do e-mail aponta para o host
errado e o cookie fica no domínio errado.
