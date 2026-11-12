-- Job de sistema: a cobrança mensal roda sem sessão e precisa enumerar as escolas.
--
-- A política `member_directory` exige vínculo e a `platform_directory` exige pessoa da
-- plataforma; nenhuma das duas serve a um cron. Em vez de dar BYPASSRLS ao usuário da
-- aplicação — que abriria todas as tabelas —, o contexto ganha um sinal explícito e
-- local à transação, e a política nova alcança **só** `schools`, só em SELECT.
--
-- Quem entra na escola continua entrando por `withTenant`: o sinal de sistema não é
-- propagado, e aluno, financeiro e prontuário seguem fechados por tenant.
CREATE OR REPLACE FUNCTION app.is_system_job() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.system_job', true), '') = 'on'
$$;

CREATE POLICY system_school_directory ON schools
  FOR SELECT
  USING (app.is_system_job());
