-- Diretório de escolas para quem opera a plataforma.
--
-- Sem isto, a administração da plataforma não enxerga nem o nome das escolas: a política
-- `member_directory` exige vínculo, e ela não tem nenhum. O acesso é de leitura e só
-- alcança a tabela `schools` — alunos, financeiro e prontuário continuam fechados por
-- tenant, o que exige impersonação explícita e auditada.
CREATE OR REPLACE FUNCTION app.is_platform_staff() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    (SELECT u.is_platform_staff FROM public.users u WHERE u.id = app.current_user_id()),
    false
  )
$$;

CREATE POLICY platform_directory ON schools
  FOR SELECT
  USING (app.is_platform_staff());
