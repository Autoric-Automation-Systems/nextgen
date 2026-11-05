import { describe, expect, it } from "vitest";
import {
  adminNameFromEmail,
  decideBootstrap,
  slugCandidate,
  TEST_SCHOOL,
  TEST_STUDENT,
} from "./bootstrap-rules";

describe("decideBootstrap", () => {
  it("não mexe em quem já tem vínculo", () => {
    expect(
      decideBootstrap({ totalUsers: 3, allowlisted: true, userExists: true, hasMembership: true }),
    ).toBe("none");
  });

  it("cria na instalação vazia, mesmo sem lista de administradores", () => {
    expect(
      decideBootstrap({ totalUsers: 0, allowlisted: false, userExists: false, hasMembership: false }),
    ).toBe("create");
  });

  it("recusa e-mail desconhecido quando já existe gente no sistema", () => {
    expect(
      decideBootstrap({ totalUsers: 5, allowlisted: false, userExists: false, hasMembership: false }),
    ).toBe("none");
  });

  it("aceita o e-mail da lista mesmo com o sistema em uso", () => {
    expect(
      decideBootstrap({ totalUsers: 5, allowlisted: true, userExists: false, hasMembership: false }),
    ).toBe("create");
  });

  it("vincula quem já existe mas ficou sem escola, se estiver na lista", () => {
    expect(
      decideBootstrap({ totalUsers: 5, allowlisted: true, userExists: true, hasMembership: false }),
    ).toBe("attach");
  });

  it("não vincula usuário sem escola que não é da lista", () => {
    expect(
      decideBootstrap({ totalUsers: 5, allowlisted: false, userExists: true, hasMembership: false }),
    ).toBe("none");
  });
});

describe("adminNameFromEmail", () => {
  it("separa por ponto, hífen e sublinhado", () => {
    expect(adminNameFromEmail("ruy.junior@gmail.com")).toBe("Ruy Junior");
    expect(adminNameFromEmail("ana_paula@escola.com.br")).toBe("Ana Paula");
    expect(adminNameFromEmail("joao-carlos@escola.com.br")).toBe("Joao Carlos");
  });

  it("descarta o prefixo numérico do e-mail noreply do GitHub", () => {
    expect(adminNameFromEmail("63271763+ruyjunior@users.noreply.github.com")).toBe("Ruyjunior");
  });

  it("normaliza maiúsculas e espaços", () => {
    expect(adminNameFromEmail("  RUY@Escola.com.br ")).toBe("Ruy");
  });

  it("tem um nome aceitável quando não sobra nada", () => {
    expect(adminNameFromEmail("123@escola.com.br")).toBe("Administrador");
  });
});

describe("slugCandidate", () => {
  it("mantém o nome na primeira tentativa e sufixa nas seguintes", () => {
    expect(slugCandidate(TEST_SCHOOL.slug, 1)).toBe("escola-teste");
    expect(slugCandidate(TEST_SCHOOL.slug, 2)).toBe("escola-teste-2");
    expect(slugCandidate(TEST_SCHOOL.slug, 9)).toBe("escola-teste-9");
  });
});

describe("escola e aluno de teste", () => {
  it("a escola tem razão social, porque o schema exige as duas colunas", () => {
    expect(TEST_SCHOOL.legalName.length).toBeGreaterThan(0);
    expect(TEST_SCHOOL.legalName).not.toBe(TEST_SCHOOL.tradeName);
  });

  it("o aluno nasce com data válida — é o único campo obrigatório além do nome", () => {
    expect(Number.isNaN(new Date(`${TEST_STUDENT.birthDate}T00:00:00Z`).getTime())).toBe(false);
  });
});
