import { describe, expect, it } from "vitest";
import { can, requiresMfa, type Actor } from "../rbac";

const admin: Actor = { kind: "member", userId: "u1", role: "admin", schoolId: "s1" };
const coordinator: Actor = { kind: "member", userId: "u2", role: "coordinator", schoolId: "s1" };
const teacher: Actor = { kind: "member", userId: "u3", role: "teacher", schoolId: "s1" };
const guardian: Actor = {
  kind: "guardian",
  userId: "u4",
  role: "guardian",
  schoolId: "s1",
  studentIds: ["aluno-a"],
};
const support: Actor = { kind: "member", userId: "u5", role: "platform_support", schoolId: "s1" };
/** A diretora que matriculou o filho: equipe e família no mesmo login. */
const adminParent: Actor = {
  kind: "member",
  userId: "u1",
  role: "admin",
  schoolId: "s1",
  guardianStudentIds: ["aluno-c"],
};
const anonymous: Actor = { kind: "anonymous" };

describe("can", () => {
  it("nega anônimo sempre", () => {
    expect(can(anonymous, { action: "student:read" })).toBe(false);
  });

  it("admin administra a escola e o financeiro", () => {
    expect(can(admin, { action: "school:write" })).toBe(true);
    expect(can(admin, { action: "charge:write" })).toBe(true);
    expect(can(admin, { action: "health:read_clinical" })).toBe(true);
  });

  it("professor não vê prontuário clínico, mas vê o kit de emergência", () => {
    expect(can(teacher, { action: "health:read_clinical" })).toBe(false);
    expect(can(teacher, { action: "health:read_emergency" })).toBe(true);
  });

  it("professor não mexe em dinheiro", () => {
    expect(can(teacher, { action: "charge:read" })).toBe(false);
    expect(can(teacher, { action: "charge:write" })).toBe(false);
    expect(can(teacher, { action: "expense:write" })).toBe(false);
  });

  it("professor avalia mas não aprova", () => {
    expect(can(teacher, { action: "assessment:write" })).toBe(true);
    expect(can(teacher, { action: "assessment:approve" })).toBe(false);
    expect(can(coordinator, { action: "assessment:approve" })).toBe(true);
  });

  it("professor alimenta conteúdo, mas não reorganiza a grade pedagógica", () => {
    expect(can(teacher, { action: "content:write" })).toBe(true);
    expect(can(teacher, { action: "content:structure" })).toBe(false);
    expect(can(coordinator, { action: "content:structure" })).toBe(true);
  });

  it("responsável só alcança os próprios filhos", () => {
    expect(can(guardian, { action: "student:read", studentId: "aluno-a" })).toBe(true);
    expect(can(guardian, { action: "student:read", studentId: "aluno-b" })).toBe(false);
  });

  it("responsável não escreve cadastro nem vê outro responsável", () => {
    expect(can(guardian, { action: "student:write", studentId: "aluno-a" })).toBe(false);
    expect(can(guardian, { action: "guardian:write" })).toBe(false);
  });

  it("responsável concede consentimento; admin não concede em nome dele", () => {
    expect(can(guardian, { action: "consent:grant", studentId: "aluno-a" })).toBe(true);
    expect(can(admin, { action: "consent:grant" })).toBe(false);
    expect(can(admin, { action: "consent:grant", studentId: "aluno-a" })).toBe(false);
  });

  it("equipe que também é responsável assina o termo do próprio filho", () => {
    expect(can(adminParent, { action: "consent:grant", studentId: "aluno-c" })).toBe(true);
    // Ser responsável de um aluno não abre os outros.
    expect(can(adminParent, { action: "consent:grant", studentId: "aluno-a" })).toBe(false);
  });

  it("capacidade de assinar termo consulta o vínculo, não o cargo", () => {
    expect(can(adminParent, { action: "consent:grant" })).toBe(true);
    expect(can(admin, { action: "consent:grant" })).toBe(false);
    expect(can(guardian, { action: "consent:grant" })).toBe(true);
    expect(can(teacher, { action: "consent:grant" })).toBe(false);
  });

  it("ver pendências da escola continua sendo cargo de administração", () => {
    expect(can(adminParent, { action: "consent:read" })).toBe(true);
    expect(can(guardian, { action: "consent:read", studentId: "aluno-a" })).toBe(true);
    expect(can(guardian, { action: "consent:read", studentId: "aluno-b" })).toBe(false);
    expect(can(teacher, { action: "consent:read" })).toBe(false);
  });

  it("ninguém age em escola diferente", () => {
    expect(can(admin, { action: "student:write", schoolId: "s2" })).toBe(false);
  });

  it("suporte de plataforma não vê saúde", () => {
    expect(can(support, { action: "health:read_clinical" })).toBe(false);
    expect(can(support, { action: "health:read_emergency" })).toBe(false);
  });
});

describe("requiresMfa", () => {
  it("exige 2FA para admin e suporte", () => {
    expect(requiresMfa("admin")).toBe(true);
    expect(requiresMfa("platform_support")).toBe(true);
    expect(requiresMfa("teacher")).toBe(false);
  });
});
