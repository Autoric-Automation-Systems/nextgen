import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mailTransport } from "../mail";

const managedKeys = ["MAIL_TRANSPORT", "RESEND_API_KEY", "MAIL_FROM", "VERCEL_ENV", "NODE_ENV"];

beforeEach(() => {
  for (const key of managedKeys) vi.stubEnv(key, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mailTransport", () => {
  it("usa console fora de produção, para o link aparecer no terminal", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(mailTransport()).toBe("console");
  });

  it("recusa console em produção: o log seria login de qualquer pessoa", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(mailTransport()).toBe("missing");
  });

  it("prefere Resend quando as credenciais existem", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "NextGen <noreply@escola.test>");
    expect(mailTransport()).toBe("resend");
  });

  it("aceita console explícito em preview", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MAIL_TRANSPORT", "console");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(mailTransport()).toBe("console");
  });

  it("ignora console explícito quando a Vercel diz produção", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MAIL_TRANSPORT", "console");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(mailTransport()).toBe("missing");
  });

  it("não considera Resend configurado pela metade", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    expect(mailTransport()).toBe("missing");
  });
});
