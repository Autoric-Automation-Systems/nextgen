-- Envio automático da mensalidade e assinatura da escola com a NextGen (docs 07 e 18).
--
-- Duas coisas separadas, na mesma migração porque nasceram juntas:
-- 1. `schools.invoice_send_*` + `invoices.last_sent_at`: a escola decide se o Pix/boleto
--    dela sai sozinho para o responsável, e em que dia. Um envio por competência.
-- 2. `saas_subscriptions` / `saas_charges`: o que a escola paga à NextGen, espelhado do
--    Asaas. Não confundir com `invoices`, que é dinheiro da escola.

-- AlterTable
ALTER TABLE "schools" ADD COLUMN "invoice_send_automatic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "invoice_send_day" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "last_sent_at" TIMESTAMPTZ(6),
ADD COLUMN "send_count" INTEGER NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "saas_status" AS ENUM ('trialing', 'active', 'past_due', 'canceled');

-- CreateEnum
CREATE TYPE "saas_charge_status" AS ENUM ('pending', 'paid', 'overdue', 'refunded', 'canceled');

-- CreateTable
CREATE TABLE "saas_subscriptions" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "plan_code" TEXT NOT NULL,
    "status" "saas_status" NOT NULL DEFAULT 'trialing',
    "price_cents" INTEGER NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 0,
    "trial_ends_at" TIMESTAMPTZ(6),
    "current_period_end" TIMESTAMPTZ(6),
    "next_due_date" DATE,
    "asaas_customer_id" TEXT,
    "asaas_subscription_id" TEXT,
    "canceled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "saas_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_charges" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "asaas_payment_id" TEXT NOT NULL,
    "status" "saas_charge_status" NOT NULL DEFAULT 'pending',
    "amount_cents" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_at" DATE,
    "billing_type" TEXT,
    "invoice_url" TEXT,
    "competence" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "saas_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saas_subscriptions_school_id_key" ON "saas_subscriptions"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_subscriptions_asaas_customer_id_key" ON "saas_subscriptions"("asaas_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_subscriptions_asaas_subscription_id_key" ON "saas_subscriptions"("asaas_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_charges_asaas_payment_id_key" ON "saas_charges"("asaas_payment_id");

-- CreateIndex
CREATE INDEX "saas_charges_school_id_due_date_idx" ON "saas_charges"("school_id", "due_date");

-- AddForeignKey
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_charges" ADD CONSTRAINT "saas_charges_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: mesma política uniforme das demais tabelas com `school_id`.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['saas_subscriptions', 'saas_charges']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (school_id = app.current_school_id()) WITH CHECK (school_id = app.current_school_id())',
      t
    );
    -- Operação da plataforma precisa cobrar e dar suporte à assinatura sem impersonar
    -- a escola. É leitura: escrita continua exigindo a escola no contexto.
    EXECUTE format(
      'CREATE POLICY platform_directory ON %I FOR SELECT USING (app.is_platform_staff())',
      t
    );
  END LOOP;
END
$$;
