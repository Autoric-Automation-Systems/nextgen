# NextGen — memória do projeto

- Repositório de **planejamento** (docs only) do SaaS de gestão para escolas de futebol.
- Stack decidida: Next.js 15 + Postgres/Prisma + RLS por `school_id`, Better Auth,
  Inngest, Asaas, Resend, Cloudflare R2/Stream, Vercel + Neon `sa-east-1`.
- Decisão central: **aluno é perfil tutelado**, não usuário. Sem login antes dos 16.
- Terminologia fixa: `school`, `unit`, `room`, `season`, `category`, `class_group`,
  `enrollment`, `guardian`, `student`, `consent`, `assessment`. Unidade tem endereço;
  sala pertence à unidade.
- Documentação em PT-BR; código em inglês. Índice no `README.md`.
- 12 documentos em `docs/`, ~2.500 linhas, commit `dab455d` em `master` (sem remote).
