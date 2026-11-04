import { describe, expect, it } from "vitest";
import {
  bootstrapAdminFrom,
  bootstrapAdminSql,
  slugify,
} from "../../../scripts/lib/bootstrap-admin.mjs";

describe("slugify", () => {
  it("tira acento antes de trocar separador por hífen", () => {
    expect(slugify("Escola São Paulo")).toBe("escola-sao-paulo");
  });

  it("não deixa hífen sobrando nas pontas", () => {
    expect(slugify("  Futebol & Cia.  ")).toBe("futebol-cia");
  });
});

describe("bootstrapAdminFrom", () => {
  it("não faz nada sem e-mail configurado", () => {
    expect(bootstrapAdminFrom({})).toBeNull();
  });

  it("normaliza o e-mail e deriva o resto", () => {
    const admin = bootstrapAdminFrom({
      BOOTSTRAP_ADMIN_EMAIL: "  Diretor@Escola.com.BR ",
      BOOTSTRAP_SCHOOL_NAME: "Escola Gol de Ouro",
    });

    expect(admin).toMatchObject({
      email: "diretor@escola.com.br",
      schoolName: "Escola Gol de Ouro",
      schoolSlug: "escola-gol-de-ouro",
      schoolLegalName: "Escola Gol de Ouro",
    });
  });
});

describe("bootstrapAdminSql", () => {
  const admin = bootstrapAdminFrom({ BOOTSTRAP_ADMIN_EMAIL: "a@b.com" })!;

  it("promove quem já existe em vez de duplicar", () => {
    const sql = bootstrapAdminSql(admin);

    expect(sql).toContain("on conflict (email) do update");
    expect(sql).toContain("on conflict (slug) do update");
    expect(sql).toContain("on conflict (school_id, user_id) do update");
  });

  it("escapa aspas simples, que quebrariam a instrução", () => {
    const sql = bootstrapAdminSql({ ...admin, name: "D'Ávila" });

    expect(sql).toContain("'D''Ávila'");
  });

  it("confirma o vínculo em vez de presumir", () => {
    expect(bootstrapAdminSql(admin)).toContain("from memberships m");
  });
});
