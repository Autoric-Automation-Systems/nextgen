import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:net";
import { verifySmtp } from "../mail";

/**
 * O caso que motiva `verifySmtp`: a porta abre e a autenticação é recusada. Sem separar
 * as duas coisas, "smtp alcançável" faz o diagnóstico parar no lugar errado.
 */
describe("verifySmtp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("devolve nao-configurado sem credenciais no ambiente", async () => {
    vi.stubEnv("EMAIL_USER", "");
    vi.stubEnv("EMAIL_PASS", "");

    expect(await verifySmtp(500)).toMatchObject({ ok: false, code: "nao-configurado" });
  });

  it("aceita servidor que recusa AUTH e informa o código", async () => {
    // Servidor mínimo: aceita conexão, recusa o login e mantém o protocolo vivo.
    const server = createServer((socket) => {
      socket.write("220 teste ESMTP\r\n");
      socket.on("data", (chunk) => {
        const line = chunk.toString();

        // Sem anunciar AUTH, o verify() do nodemailer só confere a conexão.
        if (/^EHLO/i.test(line)) socket.write("250-teste\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n");
        else if (/^HELO/i.test(line)) socket.write("250 teste\r\n");
        else if (/^AUTH/i.test(line)) socket.write("535 5.7.8 credencial recusada\r\n");
        else socket.write("250 OK\r\n");
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;

    vi.stubEnv("EMAIL_USER", "teste@gmail.com");
    vi.stubEnv("EMAIL_PASS", "senha-errada");
    vi.stubEnv("EMAIL_HOST", "127.0.0.1");
    vi.stubEnv("EMAIL_PORT", String(port));
    vi.stubEnv("EMAIL_SECURE", "false");

    try {
      const result = await verifySmtp(2_000);

      expect(result.ok).toBe(false);
      expect(result.code).toBe("EAUTH");
      expect(result.detail).toContain("535");
      expect(result.detail).not.toContain("senha-errada");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
