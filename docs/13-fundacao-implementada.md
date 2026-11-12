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
| Regras puras (dinheiro, RBAC, consentimento, avaliação) | `packages/core` | 44 testes |
| Sessão e resolução de ator | `packages/auth` | e-mail + senha |
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

## Turma, sem categoria nem temporada

Não existe `season` nem `category` no schema (migration `turma_sem_temporada`): a turma é o
único agrupamento pedagógico e a idade sai de `birth_date`. Ver [17](17-turmas-e-matricula.md).

## Rotas disponíveis

| Rota | Comportamento |
|---|---|
| `/` | landing pública |
| `/login` | e-mail e senha; avisos de `?senha=1` e `?saida=1` |
| `/cadastro` | pede o link de primeiro acesso/convite |
| `/definir-senha` | exige sessão do link; define a senha inicial |
| `/esqueci-senha` | pede o link de redefinição |
| `/redefinir-senha` | troca a senha com o token do e-mail |
| `/dashboard` | requer sessão; métricas da escola |
| `/alunos` | requer sessão; lista com regime etário e consentimento |
| `/alunos/[id]` | ficha do aluno com o card na versão interna |
| `/financeiro` | administração: competência, cobranças, planos, Pix, despesas (`?mes=YYYY-MM`) |
| `/meus-boletos` | responsável: cobranças dos próprios filhos e Pix de cada uma |
| `/sistema` | só administração da plataforma; diretório de escolas |
| `/sistema/card` | só plataforma; card interno e público lado a lado, com dado de demonstração |
| `/api/auth/*` | Better Auth |

Sem sessão, todo o painel redireciona para `/login`.

## Autenticação: senha no dia a dia, link só no convite

O login é **e-mail + senha**. O link mágico não abre o painel: ele existe para o primeiro
acesso e para o convite da escola, e o clique sempre termina em `/definir-senha`.

| Caminho | Para quê | Validade | Regras |
|---|---|---|---|
| `/login` | dia a dia | — | e-mail + senha; "Manter conectado" opcional |
| `/cadastro` → `/definir-senha` | primeiro acesso/convite | 15 min, uso único | define a senha com sessão do link |
| `/esqueci-senha` → `/redefinir-senha` | senha esquecida | 30 min, uso único | revoga as sessões antigas |

Detalhes que mudam o comportamento:

- Senha errada e e-mail sem conta devolvem a **mesma** mensagem. Separar as duas
  transformaria o formulário em um verificador de quem tem acesso ao sistema.
- "Manter conectado" marcado grava cookie com validade de 7 dias; desmarcado, o cookie
  morre quando o navegador fecha. A sessão expira em 7 dias e é renovada a cada 24 h.
- `disableSignUp: true`: ninguém cria conta pela API. Quem provisiona usuário é a escola
  ou o bootstrap do primeiro acesso (`ensureBootstrapAdmin`).
- Senha: 10 a 128 caracteres, sem as óbvias do `OBVIOUS` (ver `password-rules.ts`). A
  regra "não pode conter o e-mail" roda onde o e-mail é conhecido — em `/definir-senha`,
  pela sessão. Em `/redefinir-senha` o servidor só tem o token, e o token já foi para a
  caixa certa: a regra é dispensada, e não é bug.
- Tokens de link são gravados com hash (`storeToken: "hashed"`), de uso único.
- O servidor recusa origem desconhecida (`403 INVALID_ORIGIN`) e limita tentativas
  (`TOO_MANY_REQUESTS`), com mensagem própria em português.

Os textos de cada falha ficam em `apps/web/app/login/error-message.ts`: o Better Auth
devolve código em inglês na query, e é ali que ele vira frase útil.

## Menu por perfil e modo demonstração

O menu é dado, não `if` espalhado pelo componente: `apps/web/lib/nav.ts` declara as seções
e `navSectionsFor` decide quem vê o quê. Testes em `nav.test.ts` cobrem os quatro casos.

| Perfil | Seções |
|---|---|
| dono/coordenação da escola | Escola (painel, alunos, turmas, pedagogia, avaliação, financeiro, site) |
| professor | Escola, sem financeiro e sem site |
| responsável | Aluno e família |
| administração da plataforma | Escola (leitura) + Plataforma |

Itens marcados `soon` aparecem apagados, sem link: o mapa do produto fica visível sem
prometer tela que não existe.

**Administração da plataforma** é reconhecida de duas formas: a lista
`PLATFORM_ADMIN_EMAILS` (vírgula, ponto e vírgula ou espaço) e a coluna
`users.is_platform_staff`. O login grava a coluna quando o e-mail está na lista, e é a
coluna que a política `platform_directory` consulta — então revogar acesso é um `update`,
sem depender de deploy. A lista sozinha não serve para a RLS, que não enxerga variável de
ambiente.

Quem opera a plataforma não tem vínculo com escola nenhuma, e várias telas exigem escola.
`resolveWorkspace` devolve a **escola de demonstração** para esse caso, em modo leitura e
rotulado como demonstração. É também o que permite revisar a interface com dado fictício
sem tocar em escola real.

## Card do aluno

`apps/web/components/player-card.tsx`, com as regras do `08-avaliacao-e-card.md`:

- 16 atributos em 4 pilares; barras por pilar e grade por código;
- menor de 12 anos não tem nota: o card mostra idade e barras (`canShowCardRating`);
- comportamento nunca aparece na variante pública;
- card público exige 12 anos ou mais **e** consentimento do responsável (card + imagem
  pública vigentes). Abaixo de 12 não há card público: o card privado mostra idade e barras.

## Consentimento e equipe

Telas que fecham o ciclo de vida do aluno depois do cadastro:

- **`/consentimentos`** — uma linha por finalidade, com o texto do termo atrás de
  "ler o termo". Responsável vê e decide; administração e coordenação veem pendências em
  modo leitura. O aceite exige marcar a caixa (sem pré-marcação) antes do botão.
- **Termos versionados** — `consent_terms` guarda o texto e o `body_hash` (sha256 do corpo,
  calculado no banco). O aceite grava `term_id`, `evidence_hash` (termo + aluno +
  finalidade + autor + instante), IP e user-agent. Mudar o texto é publicar versão nova:
  o aceite antigo continua apontando para o texto que a família leu.
- **Revogação** — `consents` é append-only para o conteúdo: o trigger só deixa mudar
  `status`/`revoked_at`. Reaceitar cria linha nova. Índice parcial garante **uma** linha
  autorizada por aluno e finalidade, mesmo se duas abas enviarem o aceite junto.
- **Efeito imediato** — revogar `public_card`/`image_public` desliga `public_card_enabled`
  na hora; revogar `enrollment` **não** cancela a matrícula em silêncio (decisão humana).
  Aceitar `enrollment` tira a matrícula de `draft` e a coloca em `active` ou `waitlist`
  conforme lotação.
- **`/equipe`** — convite por e-mail (link mágico da Better Auth), cargo por pessoa,
  vínculo com turmas do professor, revogação de acesso sem apagar histórico. A escola
  nunca vê senha; quem já tem senha cai no painel, quem nunca entrou vai definir a senha.
- **Regras de proteção** — ninguém muda o próprio cargo nem o próprio acesso, e a escola
  não pode ficar sem administração ativa.

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

O seed cria duas escolas (`demo` e `rival`) com alunos, turmas e consentimento.
Entre em `http://localhost:3000/login` com `admin@demo.test` e a senha `demo12345678`.
O link por e-mail aparece no terminal (em produção, vai pela caixa de entrada) e só é
pedido em `/cadastro`, para primeiro acesso ou convite.

Para ver o painel com conteúdo, rode também o seed de demonstração:

```bash
pnpm db:seed:demo   # Escola Teste: 5 alunos, 2 responsáveis, notas de dois ciclos
```

| Acesso | Perfil |
|---|---|
| `admin@escola-teste.test` | dono da Escola Teste |
| `professor@escola-teste.test` | professor |
| `responsavel@escola-teste.test` | responsável |

Para entrar como administração da plataforma, coloque seu e-mail em
`PLATFORM_ADMIN_EMAILS` e faça login: o menu passa a mostrar as seções Escola (em leitura,
sobre a Escola Teste) e Plataforma.

## Verificação

```bash
pnpm test        # regras por pacote (core, auth, web) + 12 de RLS (precisa do banco)
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
5. Financeiro: emissão real de boleto/Pix por gateway e régua de cobrança automática
   (a geração mensal, a baixa manual, o Pix copia-e-cola e as despesas já existem — ver
   `07-financeiro.md`, seção 14).
6. Site público da escola e editor de identidade visual.
