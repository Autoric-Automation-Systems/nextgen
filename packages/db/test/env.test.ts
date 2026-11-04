import { describe, expect, it } from "vitest";
import {
  appDatabaseUrl,
  directDatabaseUrl,
  resolveDatabaseConfig,
  sslMode,
  userFromUrl,
} from "../src/env";

const OWNER = "postgresql://neondb_owner:senha@ep-x-pooler.sa-east-1.aws.neon.tech/nextgen";

describe("directDatabaseUrl", () => {
  it("prefere o nome do projeto", () => {
    expect(
      directDatabaseUrl({
        DATABASE_URL_MIGRATE: "postgresql://a@dir/nextgen",
        DATABASE_URL_UNPOOLED: "postgresql://b@dir/nextgen",
      }),
    ).toBe("postgresql://a@dir/nextgen");
  });

  it("aceita o nome que a integração Neon cria", () => {
    expect(directDatabaseUrl({ DATABASE_URL_UNPOOLED: "postgresql://b@dir/nextgen" }))
      .toBe("postgresql://b@dir/nextgen");
  });

  it("ignora variável declarada vazia", () => {
    expect(
      directDatabaseUrl({
        DATABASE_URL_MIGRATE: "",
        POSTGRES_URL_NON_POOLING: "postgresql://c@dir/nextgen",
      }),
    ).toBe("postgresql://c@dir/nextgen");
  });
});

describe("appDatabaseUrl", () => {
  it("usa APP_DATABASE_URL quando existe", () => {
    const url = "postgresql://nextgen_app:senha@ep-x-pooler/nextgen?pgbouncer=true";
    const resolved = appDatabaseUrl({ APP_DATABASE_URL: url });

    expect(resolved).toContain("nextgen_app");
    expect(resolved).toContain("ep-x-pooler");
    expect(sslMode(resolved)).toBe("require");
  });

  it("não sobrescreve sslmode escolhido explicitamente", () => {
    const url = "postgresql://nextgen_app:senha@localhost:5432/nextgen?sslmode=disable";
    expect(sslMode(appDatabaseUrl({ APP_DATABASE_URL: url }))).toBe("disable");
  });

  it("denuncia ausência de sslmode quando a URL não carrega parâmetro", () => {
    expect(sslMode("postgresql://u:p@host/db")).toBe("ausente");
    expect(sslMode(undefined)).toBe("ausente");
  });

  it("monta a URL do papel de aplicação a partir das variáveis PG*", () => {
    const url = appDatabaseUrl({
      PGHOST: "ep-x-pooler.sa-east-1.aws.neon.tech",
      PGDATABASE: "nextgen",
      APP_DB_PASSWORD: "s3nh4",
    });

    expect(url).toContain("nextgen_app:s3nh4@");
    expect(url).toContain("pgbouncer=true");
    expect(url).toContain("connection_limit=1");
  });

  it("respeita o nome de senha da integração", () => {
    expect(
      appDatabaseUrl({
        PGHOST: "ep-x-pooler/nextgen",
        PGDATABASE: "nextgen",
        PGPASSWORD_APP: "outra",
      }),
    ).toContain("nextgen_app:outra@");
  });

  it("codifica senha com caractere especial em vez de quebrar a URL", () => {
    const url = appDatabaseUrl({
      PGHOST: "ep-x-pooler/nextgen",
      PGDATABASE: "nextgen",
      APP_DB_PASSWORD: "a@b/c:d",
    });
    expect(url).toContain("a%40b%2Fc%3Ad");
  });

  it("não monta nada sem senha: melhor falhar alto que conectar como dono", () => {
    expect(appDatabaseUrl({ PGHOST: "ep-x/nextgen", PGDATABASE: "nextgen" })).toBeUndefined();
  });
});

describe("resolveDatabaseConfig", () => {
  it("reporta a origem e o papel sem expor a senha", () => {
    const config = resolveDatabaseConfig({ APP_DATABASE_URL: OWNER });

    expect(config.appSource).toBe("APP_DATABASE_URL");
    expect(config.appUser).toBe("neondb_owner");
    expect(config.appIsOwner).toBe(true);
    expect(JSON.stringify(config)).not.toContain("senha");
    expect(config).not.toHaveProperty("appUrl");
  });

  it("reconhece o papel de aplicação como não-dono", () => {
    const config = resolveDatabaseConfig({
      APP_DATABASE_URL: "postgresql://nextgen_app:pw@host/nextgen",
    });
    expect(config.appIsOwner).toBe(false);
  });

  it("cai para DATABASE_URL quando nada mais existe", () => {
    const config = resolveDatabaseConfig({ DATABASE_URL: OWNER });
    expect(config.appSource).toBe("DATABASE_URL");
    expect(config.appIsOwner).toBe(true);
  });

  it("declara ausente quando não há nada", () => {
    expect(resolveDatabaseConfig({}).appSource).toBe("ausente");
  });
});

describe("userFromUrl", () => {
  it("lê só o usuário", () => {
    expect(userFromUrl("postgresql://nextgen_app:pw@host:5432/db")).toBe("nextgen_app");
  });

  it("aceita URL sem senha", () => {
    expect(userFromUrl("postgresql://nextgen_app@host/db")).toBe("nextgen_app");
  });

  it("devolve undefined para entrada vazia", () => {
    expect(userFromUrl(undefined)).toBeUndefined();
  });
});

describe("hostSource", () => {
  it("deriva do DATABASE_URL que já funcionava, trocando só o papel", () => {
    const config = resolveDatabaseConfig({
      DATABASE_URL: "postgresql://neondb_owner:senha@ep-ok-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true",
      PGHOST: "ep-rotacionado-pooler.sa-east-1.aws.neon.tech",
      APP_DB_PASSWORD: "app-pw",
    });

    expect(config.hostSource).toBe("DATABASE_URL");
    expect(config.appUser).toBe("nextgen_app");
    expect(config.appSource).toBe("montada");
  });

  it("mantém host e parâmetros do dono ao trocar credenciais", () => {
    const url = appDatabaseUrl({
      DATABASE_URL: "postgresql://owner:pw@ep-ok-pooler.neon.tech/neondb?sslmode=require&pgbouncer=true",
      PGHOST: "ep-rotacionado.neon.tech",
      APP_DB_PASSWORD: "app-pw",
    });

    expect(url).toContain("ep-ok-pooler.neon.tech");
    expect(url).toContain("pgbouncer=true");
    expect(url).not.toContain("ep-rotacionado");
  });

  it("usa PGHOST quando não há DATABASE_URL", () => {
    const config = resolveDatabaseConfig({
      PGHOST: "ep-x-pooler.neon.tech",
      PGDATABASE: "neondb",
      APP_DB_PASSWORD: "pw",
    });
    expect(config.hostSource).toBe("PGHOST");
  });
});
