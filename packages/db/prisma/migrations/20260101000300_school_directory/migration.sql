-- Seletor de escola: quem tem vínculo pode ler o nome das escolas em que atua,
-- sem abrir os demais dados delas (as tabelas continuam fechadas por tenant).
CREATE POLICY member_directory ON schools
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.school_id = schools.id
        AND m.user_id = app.current_user_id()
        AND m.status = 'active'
    )
  );
