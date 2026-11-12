import { describe, expect, it } from "vitest";
import { studentFormSchema } from "./student-form";

const VALID = {
  fullName: "Lucas Almeida",
  nickname: "Luquinhas",
  birthDate: "2018-04-12",
  position: "atacante",
  dueDay: "10",
  guardianName: "Carla Almeida",
  guardianEmail: "Carla@Exemplo.com ",
  guardianPhone: "+55 11 98888-7777",
  relation: "mother",
  classGroupId: "",
  tuitionPlanId: "",
};

describe("studentFormSchema", () => {
  it("aceita o cadastro completo e normaliza o e-mail", () => {
    const parsed = studentFormSchema.parse(VALID);
    expect(parsed.guardianEmail).toBe("carla@exemplo.com");
    expect(parsed.dueDay).toBe(10);
    expect(parsed.classGroupId).toBeNull();
  });

  it("exige nome do aluno e nome do responsável", () => {
    expect(studentFormSchema.safeParse({ ...VALID, fullName: "Lu" }).success).toBe(false);
    expect(studentFormSchema.safeParse({ ...VALID, guardianName: "" }).success).toBe(false);
  });

  it("recusa e-mail inválido do responsável", () => {
    expect(studentFormSchema.safeParse({ ...VALID, guardianEmail: "sem-arroba" }).success).toBe(false);
  });

  it("recusa data de nascimento no futuro", () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(studentFormSchema.safeParse({ ...VALID, birthDate: tomorrow }).success).toBe(false);
  });

  it("mantém o vencimento entre 1 e 31", () => {
    expect(studentFormSchema.safeParse({ ...VALID, dueDay: "0" }).success).toBe(false);
    expect(studentFormSchema.safeParse({ ...VALID, dueDay: "32" }).success).toBe(false);
    expect(studentFormSchema.safeParse({ ...VALID, dueDay: "31" }).success).toBe(true);
  });

  it("recusa parentesco fora do enum", () => {
    expect(studentFormSchema.safeParse({ ...VALID, relation: "vizinho" }).success).toBe(false);
  });

  it("aceita turma e plano opcionais", () => {
    const parsed = studentFormSchema.parse({ ...VALID, dueDay: 5 });
    expect(parsed.dueDay).toBe(5);
    expect(parsed.tuitionPlanId).toBeNull();
  });
});
