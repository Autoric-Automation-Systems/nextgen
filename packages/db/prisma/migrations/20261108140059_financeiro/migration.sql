-- CreateEnum
CREATE TYPE "charge_kind" AS ENUM ('monthly', 'enrollment', 'material', 'uniform', 'other');

-- CreateEnum
CREATE TYPE "charge_status" AS ENUM ('open', 'paid', 'canceled');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('pix', 'boleto', 'card', 'cash', 'transfer', 'other');

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "pix_city" TEXT,
ADD COLUMN     "pix_holder" TEXT,
ADD COLUMN     "pix_key" TEXT;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "tuition_plan_id" UUID;

-- CreateTable
CREATE TABLE "tuition_plans" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_amount" INTEGER NOT NULL,
    "due_day" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tuition_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "guardian_id" UUID,
    "plan_id" UUID,
    "kind" "charge_kind" NOT NULL DEFAULT 'monthly',
    "competence" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "base_amount" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "status" "charge_status" NOT NULL DEFAULT 'open',
    "description" TEXT,
    "canceled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "payment_method" NOT NULL DEFAULT 'pix',
    "paid_at" DATE NOT NULL,
    "note" TEXT,
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "unit_id" UUID,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_at" DATE,
    "supplier" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tuition_plans_school_id_active_idx" ON "tuition_plans"("school_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "tuition_plans_school_id_name_key" ON "tuition_plans"("school_id", "name");

-- CreateIndex
CREATE INDEX "invoices_school_id_competence_idx" ON "invoices"("school_id", "competence");

-- CreateIndex
CREATE INDEX "invoices_school_id_status_due_date_idx" ON "invoices"("school_id", "status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_student_id_competence_kind_key" ON "invoices"("student_id", "competence", "kind");

-- CreateIndex
CREATE INDEX "invoice_payments_school_id_paid_at_idx" ON "invoice_payments"("school_id", "paid_at");

-- CreateIndex
CREATE INDEX "invoice_payments_invoice_id_idx" ON "invoice_payments"("invoice_id");

-- CreateIndex
CREATE INDEX "expenses_school_id_due_date_idx" ON "expenses"("school_id", "due_date");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_tuition_plan_id_fkey" FOREIGN KEY ("tuition_plan_id") REFERENCES "tuition_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_skill_ratings" ADD CONSTRAINT "student_skill_ratings_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_skill_ratings" ADD CONSTRAINT "student_skill_ratings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tuition_plans" ADD CONSTRAINT "tuition_plans_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "tuition_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Isolamento por escola nas tabelas novas
-- ─────────────────────────────────────────────────────────────
--
-- Mesma política uniforme da migração de RLS: sem contexto de escola, nenhuma linha.
-- A RLS isola escola, não papel — o filtro "responsável só vê as cobranças dos filhos"
-- é explícito na consulta (`apps/web/lib/billing.ts`).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tuition_plans', 'invoices', 'invoice_payments', 'expenses']
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

-- Pagamento é lançamento de caixa: corrigir digitação exige cancelar a cobrança e
-- lançar de novo, então o runtime não altera nem apaga o que já entrou.
REVOKE UPDATE, DELETE ON invoice_payments FROM nextgen_app;
