import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import {
  missingAppConfig,
  appConfigPresence,
  dbConfigPresence,
  describeDbDetail,
  describeDbFailure,
  probeDatabaseEndpoints,
  redactSecrets,
} from "./db-diagnosis";

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
  it("diz qual papel conectou e de onde veio a URL, sem expor o valor", () => {
    const presence = dbConfigPresence({
      APP_DATABASE_URL: "postgresql://nextgen_app:segredo@host/db?pgbouncer=true",
    });

    expect(presence.appSource).toBe("APP_DATABASE_URL");
    expect(presence.appUser).toBe("nextgen_app");
    expect(presence.appIsOwner).toBe(false);
    expect(JSON.stringify(presence)).not.toContain("segredo");
  });

  it("reconhece a URL unpooled da integração Neon", () => {
    const presence = dbConfigPresence({
      DATABASE_URL_UNPOOLED: "postgresql://owner:pw@host/db",
      DATABASE_URL: "postgresql://owner:pw@host-pooler/db?pgbouncer=true",
    });

    expect(presence.unpooledUrl).toBe(true);
    expect(presence.appSource).toBe("DATABASE_URL");
    expect(presence.appIsOwner).toBe(true);
  });

  it("monta a URL da app a partir das variáveis PG da integração", () => {
    const presence = dbConfigPresence({
      PGHOST: "ep-x-pooler.sa-east-1.aws.neon.tech",
      PGDATABASE: "nextgen",
      APP_DB_PASSWORD: "pw",
    });

    expect(presence.appSource).toBe("montada");
    expect(presence.appUser).toBe("nextgen_app");
    expect(presence.pgIntegration).toBe(true);
  });

  it("ambiente vazio", () => {
    expect(dbConfigPresence({})).toMatchObject({
      appSource: "ausente",
      appIsOwner: true,
      unpooledUrl: false,
      pgIntegration: false,
    });
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
  it("junta a cadeia de cause em uma linha", () => {
    const cause = new Error("engine faltando");
    const error = new Error("Invalid invocation", { cause });
    expect(describeDbDetail(error)).toBe("Invalid invocation | engine faltando");
  });

  it("trunca mensagem gigante", () => {
    expect(describeDbDetail(new Error("x".repeat(5000))).length).toBe(700);
  });

  it("redige antes de devolver", () => {
    expect(describeDbDetail(new Error("falhou em postgresql://u:p@h.neon.tech/db")))
      .toBe("falhou em <url>");
  });
});

describe("appConfigPresence", () => {
  it("só booleanos, sem valor", () => {
    const presence = appConfigPresence({ BETTER_AUTH_SECRET: "segredo", MAIL_FROM: "a@b.c" });
    expect(presence).toEqual({
      authSecret: true,
      authUrl: false,
      mailFrom: true,
      resendKey: false,
      emailUser: false,
      emailPass: false,
      blobPublic: false,
      blobPrivate: false,
    });
    expect(JSON.stringify(presence)).not.toContain("segredo");
  });
});

describe("probeDatabaseEndpoints", () => {
  it("distingue endpoint vivo de morto, sem vazar segredo", async () => {
    // Um socket real, aberto pelo teste: sem depender de Postgres no ambiente.
    const server = createServer((socket) => socket.destroy());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    const port = (server.address() as { port: number }).port;
    const url = (host: string, target: number) =>
      `postgresql://nextgen_app:segredo@${host}:${target}/neondb`;

    try {
      const endpoints = await probeDatabaseEndpoints(800, {
        APP_DATABASE_URL: url("127.0.0.1", port),
        DATABASE_URL: url("127.0.0.1", 1),
      });

      expect(endpoints[0]?.up).toBe(true);
      expect(endpoints[1]?.up).toBe(false);
      expect(JSON.stringify(endpoints)).not.toContain("segredo");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("missingAppConfig", () => {
  it("aponta o segredo ausente, que derruba toda página autenticada", () => {
    expect(missingAppConfig({ MAIL_FROM: "a@b.c" })).toEqual(["BETTER_AUTH_SECRET"]);
  });

  it("aceita EMAIL_FROM como remetente", () => {
    expect(
      missingAppConfig({ BETTER_AUTH_SECRET: "x".repeat(32), EMAIL_FROM: "a@b.c" }),
    ).toEqual([]);
  });
});
