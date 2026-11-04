import { describe, expect, it } from "vitest";
import { dbConfigPresence, describeDbDetail, describeDbFailure, redactSecrets } from "./db-diagnosis";

function prismaError(errorCode: string, message = "raw driver message") {
  const error = new Error(message);
  (error as { errorCode?: string }).errorCode = errorCode;
  return error;
}

describe("describeDbFailure", () => {
  it("traduz o código do Prisma sem repetir a mensagem do driver", () => {
    const described = describeDbFailure(
      prismaError("P1001", "Can't reach database server at ep-abc-pooler.sa-east-1.aws.neon.tech:5432"),
    );

    expect(described).toContain("P1001");
    expect(described).not.toContain("neon.tech");
  });

  it("reconhece URL ausente", () => {
    expect(describeDbFailure(new Error("APP_DATABASE_URL (ou DATABASE_URL) não configurada")))
      .toBe("URL do banco não configurada");
  });

  it("reconhece variável não encontrada pelo Prisma", () => {
    expect(describeDbFailure(new Error("Environment variable not found: DATABASE_URL")))
      .toBe("variável de ambiente do banco ausente");
  });

  it("cai no nome do erro quando o código é desconhecido", () => {
    expect(describeDbFailure(new TypeError("boom"))).toBe("TypeError");
  });

  it("não quebra com valor que não é Error", () => {
    expect(describeDbFailure("string solta")).toBe("falha desconhecida");
  });
});

describe("dbConfigPresence", () => {
  it("não expõe o valor da URL, só a presença", () => {
    const presence = dbConfigPresence({
      APP_DATABASE_URL: "postgresql://user:segredo@host/db?pgbouncer=true",
    });

    expect(presence).toEqual({ appDatabaseUrl: true, databaseUrl: false, pooled: true });
    expect(JSON.stringify(presence)).not.toContain("segredo");
  });

  it("detecta pgbouncer ausente", () => {
    expect(dbConfigPresence({ APP_DATABASE_URL: "postgresql://u:p@host/db?sslmode=require" }).pooled)
      .toBe(false);
  });

  it("ambiente vazio", () => {
    expect(dbConfigPresence({})).toEqual({ appDatabaseUrl: false, databaseUrl: false, pooled: false });
  });
});

describe("redactSecrets", () => {
  it("apaga a URL com credenciais do host Neon", () => {
    const out = redactSecrets(
      "Can't reach database server at postgresql://nextgen_app:pw@ep-x-pooler.sa-east-1.aws.neon.tech:5432/nextgen",
    );

    expect(out).not.toContain("pw@");
    expect(out).not.toContain("neon.tech");
    expect(out).toContain("<url>");
  });

  it("apaga token do Resend", () => {
    expect(redactSecrets("chave re_1234567890abcdef")).toBe("chave <token>");
  });

  it("preserva texto sem segredo", () => {
    expect(redactSecrets("desconhecido")).toBe("desconhecido");
  });
});

describe("describeDbDetail", () => {
  it("pega só a primeira linha não vazia", () => {
    const error = new Error("\n  primeira linha  \nsegunda linha");
    expect(describeDbDetail(error)).toBe("primeira linha");
  });

  it("redige antes de devolver", () => {
    expect(describeDbDetail(new Error("falhou em postgresql://u:p@h.neon.tech/db")))
      .toBe("falhou em <url>");
  });
});
