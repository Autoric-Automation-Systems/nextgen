-- Registro de tentativas de envio de e-mail.
--
-- Responde "o e-mail saiu?" sem depender do log da Vercel, que não é alcançável de fora.
-- Guarda destinatário mascarado e o erro do provedor — nunca o corpo, que no link mágico
-- é a própria credencial de acesso.
CREATE TABLE "public"."mail_log" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    CONSTRAINT "mail_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mail_log_at_idx" ON "public"."mail_log"("at");

-- Só o dono lê: o endereço, ainda que mascarado, é dado pessoal e nenhuma tela usa isto.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nextgen_app') THEN
    REVOKE ALL ON public.mail_log FROM nextgen_app;
    REVOKE ALL ON SEQUENCE public.mail_log_id_seq FROM nextgen_app;
  END IF;
END
$$;
