# NextGen

Plataforma SaaS de gestão para **escolas de futebol**: matrícula, pedagogia, avaliação de
habilidades, saúde, financeiro e site público — tudo em um só lugar, com conformidade
LGPD e ECA Digital para alunos menores de idade.

> **Status:** fase 0 — fundação de código entregue. Monorepo com schema, RLS, login por
> e-mail e senha, painel e lista de alunos rodando. Ver
> [`docs/13-fundacao-implementada.md`](docs/13-fundacao-implementada.md).

---

## Rodar localmente

```bash
pnpm install  # Node 24 (.nvmrc)
docker run -d --name nextgen-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nextgen \
  -p 5432:5432 postgres:16-alpine
docker exec nextgen-pg psql -U postgres -d nextgen -c \
  "create role nextgen_app login password 'app' nosuperuser nobypassrls;"
docker exec nextgen-pg psql -U postgres -d nextgen -c \
  "grant connect on database nextgen to nextgen_app;"

cp .env.example apps/web/.env.local
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Abra `http://localhost:3000/login` e entre com `admin@demo.test` e a senha
`demo12345678`. O seed cria duas escolas para você conferir o isolamento na prática.

O link mágico continua existindo, mas só para **primeiro acesso e convite**: em
`/cadastro` a pessoa pede o link, o e-mail aparece no terminal (em produção, na caixa de
entrada) e o clique leva a `/definir-senha`, onde ela escolhe a senha do login. Depois
disso, entra sempre por e-mail e senha.

Para publicar, siga [`docs/14-deploy-vercel.md`](docs/14-deploy-vercel.md): banco com duas
credenciais, migração, import do repo na Vercel e verificação com
`node scripts/check-deploy.mjs <url>`.

## O problema

Escolas de futebol (e projetos sociais, escolinhas e clubes de base) rodam hoje em uma
combinação de WhatsApp, planilha, caderno de campo e boleto avulso. Isso gera:

- matrícula e rematrícula manuais, com dados do aluno espalhados;
- professor sem ferramenta em campo (sinal ruim, celular na mão, pressa);
- avaliação de evolução que fica na memória ou em um caderno que se perde;
- anamnese de saúde em papel — e nenhum controle de quem pode ver aquilo;
- financeiro sem visão de inadimplência, fluxo de caixa e despesas;
- nenhuma presença digital: a escola não é encontrada, não converte aula experimental.

## A proposta

Um SaaS multi-escola (multi-tenant) com três experiências distintas:

| Ator | Experiência |
|---|---|
| **Escola / coordenação** | Backoffice completo: alunos, turmas, professores, conteúdo, financeiro, site |
| **Professor** | App de campo: chamada, plano de aula, avaliação por toque, fotos e vídeos |
| **Família** | Portal do responsável: mensalidades, evolução do aluno, saúde, autorizações |
| **Visitante** | Site público da escola + card público do aluno (opt-in) |

## A decisão que organiza tudo

O aluno de uma escolinha normalmente é menor de idade. Isso não é um detalhe de cadastro:
é a **restrição de arquitetura** do produto.

> **O aluno não é um usuário. O aluno é um perfil tutelado por um responsável legal.**

Consequências diretas:

1. A conta âncora é a do **responsável** (`guardian`). O aluno é um `student_profile` vinculado.
2. Antes dos 16 anos não existe login próprio do aluno — o ECA Digital (Lei 15.211/2025,
   art. 24) exige vínculo da conta do menor à conta do responsável.
3. Todo dado do aluno carrega **base legal + finalidade + consentimento versionado**.
4. Dados de saúde são **sensíveis** (LGPD art. 11) e têm visibilidade segregada.
5. Nada do aluno é público por padrão — nem nome completo, nem foto, nem o card.
6. Aos 18 anos, a titularidade migra do responsável para o aluno de forma automática.

O detalhamento está em [`docs/02-menores-lgpd.md`](docs/02-menores-lgpd.md).

## Mapa da documentação

| # | Documento | Para quem |
|---|---|---|
| 01 | [Visão de produto e escopo](docs/01-visao-produto.md) | Produto, negócio |
| 02 | [Menores de idade, LGPD e ECA Digital](docs/02-menores-lgpd.md) | Produto, jurídico, engenharia |
| 03 | [Personas e jornadas](docs/03-personas-jornadas.md) | Produto, design |
| 04 | [Módulos e regras de negócio](docs/04-modulos.md) | Produto, engenharia |
| 05 | [Modelo de dados](docs/05-modelo-dados.md) | Engenharia |
| 06 | [Arquitetura técnica](docs/06-arquitetura.md) | Engenharia |
| 07 | [Módulo financeiro](docs/07-financeiro.md) | Produto, financeiro |
| 08 | [Avaliação de habilidades e card do aluno](docs/08-avaliacao-e-card.md) | Produto, design |
| 09 | [Roadmap e backlog](docs/09-roadmap.md) | Todos |
| 10 | [Operação, segurança e LGPD na prática](docs/10-operacao-seguranca.md) | Engenharia, ops |
| 11 | [Decisões e perguntas abertas](docs/11-decisoes-abertas.md) | Todos |
| 12 | [Métricas e precificação do SaaS](docs/12-metricas-precificacao.md) | Negócio |
| 13 | [Fundação implementada (fase 0)](docs/13-fundacao-implementada.md) | Engenharia |
| 14 | [Deploy na Vercel](docs/14-deploy-vercel.md) | Engenharia, ops |
| 15 | [Marca e arquivos de imagem](docs/15-marca-e-ativos.md) | Design, engenharia |
| 16 | [Padrões de acabamento: tela, texto e e-mail](docs/16-padroes-de-acabamento.md) | Todos |
| 17 | [Turmas e matrícula](docs/17-turmas-e-matricula.md) | Produto, engenharia |

## Stack sugerida (resumo)

- **Web/API:** Next.js 15 (App Router) + TypeScript, API via Route Handlers/tRPC
- **Banco:** PostgreSQL com *Row Level Security* por `school_id`
- **ORM:** Prisma
- **Auth:** Better Auth (organizações, convites, passkeys, 2FA)
- **Jobs:** Inngest ou Trigger.dev (cobrança, e-mail, régua, relatórios)
- **Arquivos:** Vercel Blob em dois stores (público e privado), com URL assinada para mídia do aluno
- **Pagamentos:** Asaas (Pix + boleto + cartão) com conta da própria escola
- **E-mail:** Resend; **WhatsApp:** Meta Cloud API
- **Infra:** Vercel + Neon/Supabase em `sa-east-1` (dados no Brasil)

Detalhes e alternativas em [`docs/06-arquitetura.md`](docs/06-arquitetura.md).

## Princípios de engenharia

1. **Privacidade por padrão** — o default é o mais restritivo.
2. **Menor privilégio** — professor vê restrição operacional, não prontuário.
3. **Tudo auditável** — quem viu, quem alterou, quando, de onde.
4. **Offline-first no campo** — o professor não pode depender de 4G no campo.
5. **Dinheiro da escola não passa pela NextGen** — evita virar instituição de pagamento.
6. **Simplicidade operacional** — monolito modular, um banco, um deploy.

## Licença e uso

Projeto proprietário da Autoric. Todos os direitos reservados.
