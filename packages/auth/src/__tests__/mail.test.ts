import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mailTransport, smtpConfig } from "../mail";

const managedKeys = [
  "MAIL_TRANSPORT",
  "RESEND_API_KEY",
  "MAIL_FROM",
  "EMAIL_USER",
  "EMAIL_PASS",
  "EMAIL_HOST",
  "EMAIL_PORT",
  "EMAIL_SECURE",
  "VERCEL_ENV",
  "NODE_ENV",
];

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

  it("usa SMTP quando há usuário e senha de e-mail", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_USER", "escola@gmail.com");
    vi.stubEnv("EMAIL_PASS", "senha-de-app");
    expect(mailTransport()).toBe("smtp");
  });

  it("não considera SMTP configurado pela metade", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_USER", "escola@gmail.com");
    expect(mailTransport()).toBe("missing");
  });
});

describe("smtpConfig", () => {
  it("deriva o servidor do Gmail e o From da própria conta", () => {
    const config = smtpConfig({ EMAIL_USER: "escola@gmail.com", EMAIL_PASS: "p" });
    expect(config).toEqual({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      user: "escola@gmail.com",
      pass: "p",
      from: "NextGen <escola@gmail.com>",
    });
  });

  it("porta 587 desliga TLS implícito, porque sobe por STARTTLS", () => {
    const config = smtpConfig({
      EMAIL_USER: "escola@gmail.com",
      EMAIL_PASS: "p",
      EMAIL_PORT: "587",
    });
    expect(config?.port).toBe(587);
    expect(config?.secure).toBe(false);
  });

  it("domínio próprio exige EMAIL_HOST explícito", () => {
    expect(smtpConfig({ EMAIL_USER: "contato@escola.com.br", EMAIL_PASS: "p" })).toBeNull();
  });

  it("respeita From personalizado", () => {
    const config = smtpConfig({
      EMAIL_USER: "escola@gmail.com",
      EMAIL_PASS: "p",
      MAIL_FROM: "Escola Gol de Ouro <contato@escolagol.com.br>",
    });
    expect(config?.from).toBe("Escola Gol de Ouro <contato@escolagol.com.br>");
  });
});
