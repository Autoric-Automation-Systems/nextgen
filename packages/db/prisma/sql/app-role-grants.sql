-- Privilégios do papel de runtime. Idempotente.
--
-- Roda a cada deploy (scripts/migrate-on-deploy.mjs) por um motivo específico: no Neon o
-- papel `nextgen_app` não pode ser criado por SQL, então ele nasce fora da ordem das
-- migrações. Se a migração de RLS já tiver rodado sem o papel, os GRANTs de lá nunca
-- aconteceram e não há como refazê-los — migração aplicada não roda de novo.
--
-- Aqui a concessão é condicional: sem o papel, nada acontece e o health segue mostrando
-- o que falta, em vez de o deploy quebrar.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nextgen_app') THEN
    RAISE NOTICE 'papel nextgen_app ausente: crie em Neon > Roles e defina APP_DATABASE_URL';
    RETURN;
  END IF;

  GRANT USAGE ON SCHEMA public, app TO nextgen_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nextgen_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nextgen_app;

  -- Audit log é somente-adição: o runtime registra e nunca corrige nem apaga.
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    REVOKE UPDATE, DELETE ON audit_logs FROM nextgen_app;
  END IF;

  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nextgen_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO nextgen_app;
END
$$;
