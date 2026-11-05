-- Pedido público de cadastro de escola.
--
-- A tabela é de entrada, não de leitura: o papel de runtime pode inserir e não pode
-- consultar. Sem SELECT, o formulário não serve para descobrir quem já pediu cadastro —
-- e o dado do responsável pela escola deixa de ser legível a partir de uma falha em
-- qualquer tela pública.
CREATE TYPE "public"."lead_status" AS ENUM ('new', 'contacted', 'activated', 'discarded');

CREATE TABLE "public"."school_leads" (
    "id" UUID NOT NULL,
    "school_name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "student_count" INTEGER,
    "message" TEXT,
    "status" "public"."lead_status" NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_leads_created_at_idx" ON "public"."school_leads"("created_at");
CREATE INDEX "school_leads_status_idx" ON "public"."school_leads"("status");

ALTER TABLE "public"."school_leads" ENABLE ROW LEVEL SECURITY;

-- Só inserção. O dono das tabelas (backoffice) continua lendo, porque a política não é
-- FORCE: quem triagem é o operador da plataforma, não o runtime do site.
CREATE POLICY lead_intake ON "public"."school_leads" FOR INSERT WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nextgen_app') THEN
    GRANT INSERT ON public.school_leads TO nextgen_app;
    REVOKE SELECT, UPDATE, DELETE ON public.school_leads FROM nextgen_app;
  END IF;
END
$$;
