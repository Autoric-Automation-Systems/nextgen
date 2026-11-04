# AGENTS.md — NextGen

Instruções para qualquer agente (humano ou IA) trabalhando neste repositório.

## Contexto

Repositório do NextGen, SaaS de gestão para escolas de futebol. A documentação é a
fonte da verdade do produto; `docs/13-fundacao-implementada.md` descreve o que já
existe em código. O restante entra conforme `docs/09-roadmap.md`.

## Estrutura

```
apps/web              Next.js 15 (App Router) — painel, login, API de auth
packages/db           Prisma, migrações com RLS, seed, cliente de tenant
packages/core         regras puras: dinheiro, categoria, RBAC, consentimento
packages/auth         Better Auth + resolução de sessão/ator
packages/integrations Vercel Blob (stores público e privado)
docs/                 especificação (01..13)
```

## Comandos

```bash
pnpm install
pnpm db:migrate   # prisma migrate deploy
pnpm db:seed
pnpm dev
pnpm test         # regras + RLS (RLS exige Postgres com o papel nextgen_app)
pnpm typecheck
pnpm build
```

Duas URLs de banco são obrigatórias e **precisam ser diferentes**: `DATABASE_URL`
(dono, só migração e seed) e `APP_DATABASE_URL` (papel `nextgen_app`, sem superusuário).
Se a aplicação conectar como dono, a RLS deixa de valer.

## Idioma

- Documentação, UI e mensagens de erro em **português do Brasil**.
- Código (variáveis, funções, tabelas) em **inglês**.
- Commits em português, no imperativo: `docs: adiciona matriz de retenção`.

## Regras não negociáveis

Leia `docs/02-menores-lgpd.md` antes de propor qualquer mudança que envolva aluno,
responsável, consentimento, imagem, saúde ou dado público.

1. Aluno é **perfil tutelado**, não usuário. Sem login próprio antes dos 16.
2. Toda tabela de domínio tem `school_id` + RLS.
3. Toda finalidade de tratamento tem consentimento versionado e revogável.
4. Dado de saúde é sensível: nunca em log, e-mail, push ou analytics.
5. Nada de aluno é público por padrão; card é opt-in e sem ranking.
6. Dinheiro trafega na conta da escola, nunca na da NextGen.
7. Nunca condicionar matrícula a consentimento de imagem ou perfil público.

## Terminologia

Use exatamente os termos do glossário em `docs/01-visao-produto.md` §6:
`school`, `unit`, `room`, `season`, `category`, `class_group`, `enrollment`,
`guardian`, `student`, `consent`, `assessment`.

Atenção: **unidade** tem endereço; **sala** pertence a uma unidade.

## Estilo de documentação

- Markdown com uma ideia por seção, tabelas para decisões e listas curtas.
- Toda regra de negócio deve dizer o **porquê**, não só o **o quê**.
- Diagramas em Mermaid dentro do próprio Markdown.
- Não duplicar conteúdo entre documentos: referencie com link relativo.
- Não criar documentos novos sem atualizar o índice do `README.md`.

## Definição de pronto para documentação

- [ ] Link relativo válido
- [ ] Terminologia consistente com o glossário
- [ ] Impacto em LGPD/consentimento avaliado
- [ ] Índice do README atualizado quando houver documento novo
