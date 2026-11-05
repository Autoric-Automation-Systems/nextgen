import { z } from "zod";

/**
 * Regras do primeiro acesso, sem banco: é o que o formulário público filtra antes de
 * qualquer escrita, e o que dá para testar sem Postgres.
 */
export const firstRunSchema = z.object({
  adminName: z.string().trim().min(2, "informe seu nome").max(120),
  email: z.string().trim().toLowerCase().email("e-mail inválido").max(160),
  schoolName: z.string().trim().min(2, "informe o nome da escola").max(120),
  // Razão social é obrigatória no schema; vazia, o nome fantasia serve.
  schoolLegalName: z
    .string()
    .trim()
    .max(160)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null),
});

export type FirstRunInput = z.infer<typeof firstRunSchema>;

export type SetupResult =
  | { status: "created"; email: string }
  | { status: "already" }
  | { status: "unavailable"; message: string };

/**
 * Slug público da escola, derivado do nome.
 *
 * Acentos saem antes da normalização porque `NFD` separa a marca e ela viraria hífen.
 */
export function schoolSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
