-- Isolamento entre escolas por Row Level Security.
--
-- Regras:
--  * o contexto vem de `app.school_id` / `app.user_id`, definidos com `set_config(..., true)`
--    dentro da transação (ver packages/db/src/tenant.ts);
--  * sem contexto a política devolve falso: falha fechada;
--  * FORCE ROW LEVEL SECURITY faz a política valer também para o dono da tabela, o que
--    impede um bug de código virar leitura entre escolas;
--  * o papel de runtime (`nextgen_app`) não é superusuário nem tem BYPASSRLS.

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_school_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.school_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- Papel de aplicação.
--
-- `CREATE ROLE` exige CREATEROLE, que o dono do banco no Neon não tem. Sem o bloco de
-- exceção abaixo, a migração inteira aborta com 42501 e o Prisma registra a falha,
-- bloqueando todos os deploys seguintes (P3009). A criação é melhor-esforço: quando o
-- papel já existe — criado no console do Neon — este trecho só concede o acesso.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nextgen_app') THEN
    BEGIN
      CREATE ROLE nextgen_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'sem CREATEROLE: crie o papel nextgen_app no console do Neon e use a senha em APP_DATABASE_URL';
    END;
  END IF;
END
$$;

-- GRANT e REVOKE falham se o papel não existe, então ficam condicionados.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nextgen_app') THEN
    GRANT USAGE ON SCHEMA public, app TO nextgen_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nextgen_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nextgen_app;
    REVOKE UPDATE, DELETE ON audit_logs FROM nextgen_app;

    -- Sem isto, tabela criada por migração futura nasce inacessível ao runtime, e o
    -- sintoma é 500 em uma tela nova, semanas depois.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nextgen_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO nextgen_app;
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────
-- Políticas por tabela
-- ─────────────────────────────────────────────────────────────

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON schools
  USING (id = app.current_school_id())
  WITH CHECK (id = app.current_school_id());

-- Tabelas com school_id: política única e uniforme.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'units', 'rooms', 'memberships', 'guardians', 'students', 'student_guardians',
    'pickup_authorized_people', 'seasons', 'categories', 'class_groups',
    'class_group_teachers', 'enrollments', 'consents', 'audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (school_id = app.current_school_id()) WITH CHECK (school_id = app.current_school_id())',
      t
    );
  END LOOP;
END
$$;

-- `users` é global: o usuário se vê, e vê quem compartilha uma escola com ele.
-- A subconsulta em `memberships` já passa pela política de tenant, então não vaza.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY self_or_same_school ON users
  USING (
    id = app.current_user_id()
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = users.id AND m.school_id = app.current_school_id()
    )
  )
  WITH CHECK (id = app.current_user_id());

-- `guardians` também é acessível ao próprio responsável, mesmo antes de o tenant
-- da escola estar no contexto (primeiro acesso ao portal).
DROP POLICY tenant_isolation ON guardians;
CREATE POLICY tenant_or_self ON guardians
  USING (school_id = app.current_school_id() OR user_id = app.current_user_id())
  WITH CHECK (school_id = app.current_school_id());

-- Dados de referência globais (sem dado pessoal).
ALTER TABLE consent_purposes ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_all ON consent_purposes FOR SELECT USING (true);
CREATE POLICY write_platform ON consent_purposes FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE consent_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_all ON consent_terms FOR SELECT USING (true);
CREATE POLICY write_platform ON consent_terms FOR ALL USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────
-- Garantias estruturais
-- ─────────────────────────────────────────────────────────────

-- Uma matrícula ativa por aluno/turma.
CREATE UNIQUE INDEX enrollments_active_unique
  ON enrollments (student_id, class_group_id)
  WHERE status = 'active' AND deleted_at IS NULL;

-- Busca por nome sem varrer a tabela inteira.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX students_full_name_trgm ON students USING gin (lower(full_name) gin_trgm_ops);

-- Auditoria é append-only.
CREATE OR REPLACE FUNCTION app.block_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs é append-only';
END
$$;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION app.block_audit_mutation();

-- Consentimento só muda status/revogação; o resto é imutável.
CREATE OR REPLACE FUNCTION app.guard_consent_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.school_id <> OLD.school_id
     OR NEW.student_id <> OLD.student_id
     OR NEW.guardian_id <> OLD.guardian_id
     OR NEW.purpose_code <> OLD.purpose_code
     OR NEW.term_id <> OLD.term_id
     OR NEW.evidence_hash <> OLD.evidence_hash THEN
    RAISE EXCEPTION 'consentimento é imutável exceto status e revogação';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER consents_guard_update
  BEFORE UPDATE ON consents
  FOR EACH ROW EXECUTE FUNCTION app.guard_consent_update();
