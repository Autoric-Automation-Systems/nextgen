-- Posição e camisa do aluno: dados do card e da escalação, não do cadastro civil.
ALTER TABLE "public"."students"
  ADD COLUMN "position" TEXT,
  ADD COLUMN "jersey_number" INTEGER;
