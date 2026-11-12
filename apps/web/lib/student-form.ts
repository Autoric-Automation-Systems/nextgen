import { z } from "zod";

/** Valores do enum `GuardianRelation` no banco, na ordem em que a tela os mostra. */
export const RELATION_VALUES = [
  "mother",
  "father",
  "grandmother",
  "grandfather",
  "aunt",
  "uncle",
  "sibling",
  "legal_guardian",
  "other",
] as const;

export const GUARDIAN_RELATIONS: { value: (typeof RELATION_VALUES)[number]; label: string }[] = [
  { value: "mother", label: "Mãe" },
  { value: "father", label: "Pai" },
  { value: "grandmother", label: "Avó" },
  { value: "grandfather", label: "Avô" },
  { value: "aunt", label: "Tia" },
  { value: "uncle", label: "Tio" },
  { value: "sibling", label: "Irmão/irmã" },
  { value: "legal_guardian", label: "Responsável legal" },
  { value: "other", label: "Outro" },
] as const;

export const POSITIONS = [
  { value: "goleiro", label: "Goleiro" },
  { value: "zagueiro", label: "Zagueiro" },
  { value: "lateral", label: "Lateral" },
  { value: "meio-campo", label: "Meio-campo" },
  { value: "atacante", label: "Atacante" },
] as const;

const isoDay = /^\d{4}-\d{2}-\d{2}$/;

const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
    message: "Seleção inválida.",
  });

/**
 * Cadastro do aluno.
 *
 * O dia de vencimento mora no aluno, não no plano: dois irmãos no mesmo plano podem
 * vencer em dias diferentes, e é esse dia que a cobrança automática usa. A data de
 * nascimento é obrigatória porque a idade do card sai dela — guardar "8 anos" envelhece
 * errado no dia seguinte.
 */
export const studentFormSchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo do aluno."),
  nickname: z
    .string()
    .trim()
    .max(30, "Apelido muito longo.")
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  birthDate: z
    .string()
    .trim()
    .regex(isoDay, "Informe a data de nascimento.")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date <= new Date();
    }, "A data de nascimento não pode estar no futuro."),
  position: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  dueDay: z.coerce
    .number()
    .int("O dia de vencimento é um número inteiro.")
    .min(1, "O dia de vencimento vai de 1 a 31.")
    .max(31, "O dia de vencimento vai de 1 a 31."),
  guardianName: z.string().trim().min(3, "Informe o nome do responsável."),
  guardianEmail: z.string().trim().toLowerCase().email("Informe um e-mail válido do responsável."),
  guardianPhone: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  relation: z.enum(RELATION_VALUES),
  classGroupId: optionalUuid,
  tuitionPlanId: optionalUuid,
});

export type StudentFormInput = z.infer<typeof studentFormSchema>;
