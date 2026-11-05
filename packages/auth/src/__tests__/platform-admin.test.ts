import { describe, expect, it } from "vitest";
import { isPlatformAdmin, parseEmailAllowlist, platformAdminEmails } from "../platform-admin";

describe("parseEmailAllowlist", () => {
  it("aceita vírgula, ponto e vírgula, espaço e quebra de linha", () => {
    expect(parseEmailAllowlist("a@x.com,b@x.com;c@x.com d@x.com\ne@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
      "e@x.com",
    ]);
  });

  it("normaliza caixa e espaço em volta", () => {
    expect(parseEmailAllowlist("  Admin@Escola.COM  ")).toEqual(["admin@escola.com"]);
  });

  it("remove repetidos", () => {
    expect(parseEmailAllowlist("a@x.com,A@X.com")).toEqual(["a@x.com"]);
  });

  it("ignora o que não parece e-mail", () => {
    expect(parseEmailAllowlist("admin, ,*")).toEqual([]);
  });

  it("devolve vazio quando a variável não existe", () => {
    expect(parseEmailAllowlist(undefined)).toEqual([]);
    expect(parseEmailAllowlist("")).toEqual([]);
  });
});

describe("platformAdminEmails", () => {
  it("lê a variável de ambiente", () => {
    expect(platformAdminEmails({ PLATFORM_ADMIN_EMAILS: "eu@escola.com" })).toEqual(["eu@escola.com"]);
  });

  it("sem a variável, ninguém é admin de plataforma", () => {
    expect(platformAdminEmails({})).toEqual([]);
  });
});

describe("isPlatformAdmin", () => {
  const env = { PLATFORM_ADMIN_EMAILS: "eu@escola.com, socio@escola.com" };

  it("reconhece quem está na lista, sem depender de caixa", () => {
    expect(isPlatformAdmin({ email: "EU@Escola.com", env })).toBe(true);
  });

  it("não reconhece quem está fora da lista", () => {
    expect(isPlatformAdmin({ email: "outro@escola.com", env })).toBe(false);
  });

  it("respeita o papel já gravado no banco, mesmo fora da lista", () => {
    expect(isPlatformAdmin({ email: "outro@escola.com", persisted: true, env })).toBe(true);
  });

  it("falha fechada quando a variável está vazia", () => {
    expect(isPlatformAdmin({ email: "eu@escola.com", env: {} })).toBe(false);
  });

  it("não promove ninguém por curinga", () => {
    expect(isPlatformAdmin({ email: "eu@escola.com", env: { PLATFORM_ADMIN_EMAILS: "*" } })).toBe(false);
  });

  it("não promove e-mail vazio", () => {
    expect(isPlatformAdmin({ email: "   ", env: { PLATFORM_ADMIN_EMAILS: "@" } })).toBe(false);
  });
});
