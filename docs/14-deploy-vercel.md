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

### 1.2 Migrar e liberar o papel de aplicação

```bash
cd /caminho/do/repo

# 1) migrações rodam como dono, pela conexão direta
DATABASE_URL="<unpooled>" pnpm db:migrate

# 2) a migração já criou o papel nextgen_app (NOLOGIN); dê login e senha a ele
psql "<unpooled>" -c "alter role nextgen_app login password 'SENHA-FORTE';"
```

A senha vai só para a variável de ambiente da Vercel. Não comite, não cole em issue.

> **Se o `create role` falhar** por falta de `CREATEROLE` (alguns provedores gerenciados
> limitam isso), crie o papel pelo console do provedor com a mesma senha e rode a migração
> de novo — ela é idempotente (`if not exists`) e só concede os grants.
>
> **Último recurso**, se o provedor não permitir papel adicional: use o próprio papel dono
> como `APP_DATABASE_URL`. Funciona porque as tabelas de domínio têm `FORCE ROW LEVEL
> SECURITY` (vale até para o dono). O `/api/health` continua respondendo `rls: true` desde
> que o papel não tenha `BYPASSRLS`. Fica menos isolado — o dono lê qualquer tabela — então
> trate como dívida, não como desenho.

Confira antes de seguir:

```bash
psql "<pooled>" -c "select rolname, rolsuper, rolbypassrls, rolcanlogin from pg_roles where rolname in ('nextgen_app');"
# esperado: rolsuper = f, rolbypassrls = f, rolcanlogin = t
```

### 1.3 Sem dados de demonstração em produção

Não rode `pnpm db:seed` em produção: ele cria as escolas `demo` e `rival` com alunos
fictícios. O primeiro acesso real é o do item 4.

---

## 2. Projeto na Vercel

Projeto criado: **`nextgen-autoric`** → `https://nextgen-autoric.vercel.app`.

### Os dois campos que não podem ficar no padrão

| Campo | Errado | Certo |
|---|---|---|
| Root Directory | `./` (raiz do repo) | `apps/web` |
| Framework Preset | Other | **Next.js** |

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
| Node.js Version | 22.x |

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

`apps/web/vercel.json` já declara framework, install e build, e fixa a região em `gru1`
(São Paulo). Mantenha banco e função na mesma região: cada salto entre `us-east` e
`sa-east` custa ~120 ms por consulta, e a lista de alunos faz várias.

O build roda `prisma generate` antes do `next build` — sem isso o deploy sobe e morre em
runtime com *"Query engine library for current platform could not be found"*, já que o
binário precisa ser o `rhel-openssl-3.0.x` (declarado no `schema.prisma`).

---

## 3. Variáveis de ambiente

**Settings → Environment Variables**. Marque `Production`; as de preview ficam para depois.

| Variável | Valor | Obrigatória |
|---|---|---|
| `DATABASE_URL` | conexão **pooled** do banco | sim |
| `APP_DATABASE_URL` | conexão pooled com usuário `nextgen_app` e senha | sim |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | sim |
| `BETTER_AUTH_URL` | `https://seudominio.com.br` (sem barra no fim) | sim |
| `RESEND_API_KEY` | chave do Resend | sim, para login funcionar |
| `MAIL_FROM` | `NextGen <nao-responda@seudominio.com.br>` | sim, para login funcionar |
| `BLOB_PUBLIC_READ_WRITE_TOKEN` | store público | quando o upload entrar |
| `BLOB_PRIVATE_READ_WRITE_TOKEN` | store privado | quando o upload entrar |

`BETTER_AUTH_SECRET` **não pode ser trocado** depois que houver sessões: todos os cookies
existentes deixam de valer e todo mundo é deslogado.

Sem `RESEND_API_KEY` + `MAIL_FROM`, o link mágico não é enviado e o login simplesmente não
acontece — de propósito. O `/api/health` responde `"mail": "missing"` nesse caso. O
transporte de console (que imprime o link no log) é ignorado quando `VERCEL_ENV=production`,
porque log de produção vira acesso à conta de qualquer pessoa.

### Pooled ou direct?

| Uso | Conexão |
|---|---|
| Funções serverless (`DATABASE_URL`, `APP_DATABASE_URL`) | pooled |
| Migração, seed, `psql` manual | direct (sem `-pooler`) |

O `withTenant()` abre transação e usa `set_config(..., true)`, que é local à transação. Em
pooling de transação a conexão fica presa ao backend durante a transação, então o contexto
chega íntegro às políticas. É justamente por isso que a RLS precisa de transação e não de
`SET` solto.

---

## 4. Primeiro acesso

O login é por link mágico e **não existe auto-cadastro** (`disableSignUp: true`). Nenhum
usuário nasce pela tela de login. Para o primeiro administrador, crie à mão:

```sql
-- rode na conexão direct, com o papel dono
insert into users (id, name, email, email_verified)
values (gen_random_uuid(), 'Ana Diretora', 'ana@escola.com.br', true);

insert into schools (id, name, slug, status)
values (gen_random_uuid(), 'Escola Exemplo', 'escola-exemplo', 'active');

insert into memberships (id, school_id, user_id, role, status)
values (gen_random_uuid(),
        (select id from schools where slug = 'escola-exemplo'),
        (select id from users where email = 'ana@escola.com.br'),
        'admin', 'active');
```

Depois entre em `https://seudominio.com.br/login` com esse e-mail. O convite de responsável
e aluno entra na fase de matrícula.

---

## 5. Proteção de deploy

No estado em que o projeto foi criado, **até a produção exige login da Vercel**: qualquer
requisição devolve `302` para `vercel.com/sso-api`. Isso é o padrão de *Deployment
Protection* e é ótimo enquanto o site é interno — e fatal quando as famílias forem acessar.

Para o domínio de produção ficar aberto sem deixar preview aberto:

**Settings → Deployment Protection → Vercel Authentication → Only Preview Deployments.**

Para eu (ou qualquer automação) conseguir verificar antes disso, gere um **Protection
Bypass for Automation** e rode:

```bash
VERCEL_AUTOMATION_BYPASS_SECRET=... node scripts/check-deploy.mjs https://nextgen-autoric.vercel.app
```

Sem esse segredo, a única leitura possível de fora é o `302` — que não diz nada sobre a
aplicação ter subido.

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
ok   /api/health → 200 db=up rls=true (33ms)

deploy íntegro
```

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
| Login responde ok, e-mail não chega | `mail: "missing"` no health | configure Resend + `MAIL_FROM` |
| `INVALID_TOKEN` ao abrir o link | cookie/URL de origem divergente | `BETTER_AUTH_URL` igual ao domínio acessado; sem barra final |
| Tudo vazio, sem erro | sessão sem `schoolId` resolvido | usuário sem `membership` ativa — ver item 4 |
| Todo acesso redireciona para `vercel.com/login` | Deployment Protection ativa | ver seção 5 |
| `/api/health` → 503 `rls:false` | `APP_DATABASE_URL` aponta para papel com `BYPASSRLS` ou superusuário | usar `nextgen_app` |
| Latência alta em toda página | banco em outra região | mover para `sa-east-1` |

---

## 9. Domínio

**Settings → Domains**. Depois de apontar o domínio:

1. Atualize `BETTER_AUTH_URL` para o domínio final e faça redeploy — o Better Auth usa essa
   URL para montar o link do e-mail e validar origem.
2. Reenvie o teste do item 5.

Não é possível "só trocar o DNS": com a URL antiga, o link do e-mail aponta para o host
errado e o cookie fica no domínio errado.
