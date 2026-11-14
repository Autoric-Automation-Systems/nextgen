-- CreateEnum
CREATE TYPE "material_kind" AS ENUM ('text', 'link', 'video', 'audio', 'image', 'pdf');

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "kind" "material_kind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "body_text" TEXT,
    "url" TEXT,
    "storage_path" TEXT,
    "mime" TEXT,
    "size_bytes" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_plans" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "class_group_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "planned_for" DATE NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "objective" TEXT,
    "warmup" TEXT,
    "main_part" TEXT,
    "game_part" TEXT,
    "cooldown" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "lesson_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_plan_materials" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "lesson_plan_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,

    CONSTRAINT "lesson_plan_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subjects_school_id_position_idx" ON "subjects"("school_id", "position");

-- CreateIndex
CREATE INDEX "chapters_school_id_subject_id_position_idx" ON "chapters"("school_id", "subject_id", "position");

-- CreateIndex
CREATE INDEX "materials_school_id_chapter_id_position_idx" ON "materials"("school_id", "chapter_id", "position");

-- CreateIndex
CREATE INDEX "lesson_plans_school_id_class_group_id_planned_for_idx" ON "lesson_plans"("school_id", "class_group_id", "planned_for");

-- CreateIndex
CREATE INDEX "lesson_plan_materials_school_id_idx" ON "lesson_plan_materials"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_plan_materials_lesson_plan_id_material_id_key" ON "lesson_plan_materials"("lesson_plan_id", "material_id");

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_class_group_id_fkey" FOREIGN KEY ("class_group_id") REFERENCES "class_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plan_materials" ADD CONSTRAINT "lesson_plan_materials_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plan_materials" ADD CONSTRAINT "lesson_plan_materials_lesson_plan_id_fkey" FOREIGN KEY ("lesson_plan_id") REFERENCES "lesson_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plan_materials" ADD CONSTRAINT "lesson_plan_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Isolamento por escola
-- ─────────────────────────────────────────────────────────────
--
-- Mesma política uniforme das migrações anteriores: sem `app.school_id` no contexto,
-- nenhuma linha. A RLS isola escola, não papel — "professor só publica na turma dele"
-- é regra de aplicação (`apps/web/lib/pedagogy.ts`), não do banco.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'subjects', 'chapters', 'materials', 'lesson_plans', 'lesson_plan_materials'
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

-- ─────────────────────────────────────────────────────────────
-- Garantias estruturais
-- ─────────────────────────────────────────────────────────────

-- Um conteúdo tem exatamente uma origem: corpo escrito, endereço externo ou arquivo.
-- Sem isto, um bug de formulário grava material "vazio" que a tela não sabe renderizar.
ALTER TABLE "materials" ADD CONSTRAINT "materials_source_check" CHECK (
  ("kind" = 'text' AND "body_text" IS NOT NULL AND "url" IS NULL AND "storage_path" IS NULL)
  OR ("kind" = 'link' AND "url" IS NOT NULL AND "body_text" IS NULL AND "storage_path" IS NULL)
  OR ("kind" IN ('video', 'audio', 'image', 'pdf')
      AND "storage_path" IS NOT NULL AND "body_text" IS NULL AND "url" IS NULL)
);

-- Nome de matéria não se repete na mesma escola enquanto estiver ativo.
CREATE UNIQUE INDEX "subjects_school_id_name_key"
  ON "subjects" ("school_id", lower("name"))
  WHERE "deleted_at" IS NULL;

-- Aula de 15 minutos a 3 horas: fora disso é erro de digitação, não planejamento.
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_duration_check"
  CHECK ("duration_minutes" BETWEEN 15 AND 180);

-- O capítulo pertence à matéria da mesma escola.
CREATE OR REPLACE FUNCTION app.guard_chapter_school() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM subjects s
    WHERE s.id = NEW.subject_id AND s.school_id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'capítulo de matéria de outra escola';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER chapters_guard_school
  BEFORE INSERT OR UPDATE ON chapters
  FOR EACH ROW EXECUTE FUNCTION app.guard_chapter_school();

-- O conteúdo pertence ao capítulo da mesma escola, e o item do plano ao conteúdo dela.
CREATE OR REPLACE FUNCTION app.guard_material_school() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM chapters c
    WHERE c.id = NEW.chapter_id AND c.school_id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'conteúdo de capítulo de outra escola';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER materials_guard_school
  BEFORE INSERT OR UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION app.guard_material_school();

CREATE OR REPLACE FUNCTION app.guard_lesson_plan_material_school() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lesson_plans p
    WHERE p.id = NEW.lesson_plan_id AND p.school_id = NEW.school_id
  ) OR NOT EXISTS (
    SELECT 1 FROM materials m
    WHERE m.id = NEW.material_id AND m.school_id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'item de plano aponta para registro de outra escola';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER lesson_plan_materials_guard_school
  BEFORE INSERT OR UPDATE ON lesson_plan_materials
  FOR EACH ROW EXECUTE FUNCTION app.guard_lesson_plan_material_school();
