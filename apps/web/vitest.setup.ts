// Os testes de unidade não falam com o banco, mas `@nextgen/db` instancia o cliente no
// import e lança sem URL. O placeholder mantém `pnpm test` rodando em máquina sem banco
// configurado; qualquer teste que precise de banco de verdade falha na conexão, e não aqui.
process.env.APP_DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.DATABASE_URL ??= process.env.APP_DATABASE_URL;
