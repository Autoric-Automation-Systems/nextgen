-- Temporada e categoria saem do produto: a turma passa a ser a única estrutura
-- pedagógica e o aluno é vinculado a ela direto.
--
-- O que se perde: as linhas de `seasons`/`categories` (rótulo e faixa de ano). O que não
-- se perde: `class_groups.name` já carrega o nome que a escola usa ("Sub-8 — Ter/Qui 17h")
-- e matrículas, professores e histórico continuam intactos.
--
-- O dia de vencimento que estava na matrícula vira atributo do aluno: com uma turma só,
-- o vencimento não muda quando o aluno troca de horário.

-- AlterTable
ALTER TABLE "students" ADD COLUMN "due_day" INTEGER NOT NULL DEFAULT 10;

-- Move o vencimento já escolhido: prioriza a matrícula ativa e, nela, a mais recente.
UPDATE "students" AS s
SET "due_day" = picked."due_day"
FROM (
  SELECT DISTINCT ON ("student_id") "student_id", "due_day"
  FROM "enrollments"
  WHERE "deleted_at" IS NULL
  ORDER BY "student_id", ("status" = 'active') DESC, "starts_on" DESC
) AS picked
WHERE picked."student_id" = s."id";

ALTER TABLE "students" ADD CONSTRAINT "students_due_day_check" CHECK ("due_day" BETWEEN 1 AND 31);

-- AlterTable
ALTER TABLE "enrollments" DROP COLUMN "due_day";
ALTER TABLE "tuition_plans" DROP COLUMN "due_day";

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "notified_at" TIMESTAMPTZ(6);

-- A nota já é identificada pelo ciclo; a temporada era só um agrupamento paralelo.
ALTER TABLE "student_skill_ratings" DROP COLUMN "season_id";

-- DropForeignKey
ALTER TABLE "class_groups" DROP CONSTRAINT "class_groups_season_id_fkey";
ALTER TABLE "class_groups" DROP CONSTRAINT "class_groups_category_id_fkey";

-- DropIndex
DROP INDEX "class_groups_school_id_season_id_idx";

-- AlterTable
ALTER TABLE "class_groups" DROP COLUMN "season_id", DROP COLUMN "category_id";

-- CreateIndex
CREATE INDEX "class_groups_school_id_idx" ON "class_groups"("school_id");

-- DropTable
DROP TABLE "categories";
DROP TABLE "seasons";
