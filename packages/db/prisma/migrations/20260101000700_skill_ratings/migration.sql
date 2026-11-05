-- Notas por atributo e por ciclo (doc 08).
--
-- Uma linha por atributo avaliado, nunca um JSON na linha do aluno: o histórico é a
-- informação, e coluna JSON obrigaria a ler tudo para responder "quanto evoluiu".
CREATE TABLE "public"."student_skill_ratings" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "season_id" UUID,
    "cycle_label" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rated_by_user_id" UUID,
    "rated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_skill_ratings_pkey" PRIMARY KEY ("id"),
    -- Escala 1–5 do doc 08 §3. O banco recusa 0 e 6 mesmo que a aplicação erre.
    CONSTRAINT "student_skill_ratings_score_range" CHECK ("score" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "student_skill_ratings_student_id_cycle_label_code_key"
  ON "public"."student_skill_ratings"("student_id", "cycle_label", "code");
CREATE INDEX "student_skill_ratings_school_id_student_id_idx"
  ON "public"."student_skill_ratings"("school_id", "student_id");

ALTER TABLE "public"."student_skill_ratings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."student_skill_ratings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "public"."student_skill_ratings"
  USING (school_id = app.current_school_id())
  WITH CHECK (school_id = app.current_school_id());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nextgen_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_skill_ratings TO nextgen_app;
    -- Comportamental nunca sai no card público, mas o professor precisa lançar.
  END IF;
END
$$;
