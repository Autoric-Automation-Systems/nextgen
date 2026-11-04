-- O usuário precisa descobrir a que escolas pertence antes de existir contexto de
-- tenant (é o passo que resolve a escola da sessão). Leitura do próprio vínculo,
-- nada além disso: escrita continua restrita ao tenant.
CREATE POLICY self_read ON memberships
  FOR SELECT
  USING (user_id = app.current_user_id());
