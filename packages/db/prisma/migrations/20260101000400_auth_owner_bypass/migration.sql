-- O login precisa ler o usuário pelo e-mail ANTES de existir sessão — e portanto
-- antes de existir `app.user_id`. Com FORCE RLS essa leitura volta vazia e o link
-- mágico falha com INVALID_TOKEN.
--
-- Decisão: `users` fica com ENABLE (sem FORCE). O papel de aplicação continua
-- restrito pelas políticas; o cliente dono — usado exclusivamente pelo módulo de
-- autenticação (packages/auth) e por migrações/seed — enxerga a tabela inteira.
-- A alternativa (flag `app.auth_flow` na conexão) trocaria esta exceção por uma
-- configuração invisível no meio da string de conexão.
ALTER TABLE users NO FORCE ROW LEVEL SECURITY;
