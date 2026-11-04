import { SMTPServer } from "smtp-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { probeSmtp, smtpMailer } from "../mail";

/**
 * Sobe um servidor SMTP real em porta efêmera. O teste passa pelo protocolo de
 * verdade (EHLO, AUTH LOGIN, MAIL FROM, RCPT TO, DATA), e não por um mock do
 * nodemailer — mock aqui esconderia justamente o que quebra em produção.
 */
const received: { from: string; to: string[]; raw: string }[] = [];
let server: SMTPServer;
let port = 0;

beforeAll(async () => {
  server = new SMTPServer({
    authOptional: false,
    disabledCommands: ["STARTTLS"],
    onAuth(auth, _session, callback) {
      if (auth.username === "escola@teste.local" && auth.password === "senha-de-app") {
        callback(null, { user: auth.username });
      } else {
        callback(new Error("credenciais inválidas"));
      }
    },
    onData(stream, session, callback) {
      let raw = "";
      stream.on("data", (chunk) => {
        raw += chunk.toString();
      });
      stream.on("end", () => {
        received.push({
          from: session.envelope.mailFrom ? String(session.envelope.mailFrom.address) : "",
          to: (session.envelope.rcptTo ?? []).map((r) => r.address),
          raw,
        });
        callback();
      });
    },
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.server.address();
      port = typeof address === "object" && address ? address.port : 0;
      resolve();
    });
    server.on("error", reject);
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("smtpMailer", () => {
  it("entrega assunto, destinatário e corpo pelo protocolo", async () => {
    received.length = 0;
    const mailer = smtpMailer({
      host: "127.0.0.1",
      port,
      secure: false,
      user: "escola@teste.local",
      pass: "senha-de-app",
      from: "NextGen <escola@teste.local>",
    });

    await mailer.send({
      to: "responsavel@exemplo.test",
      subject: "Seu link de acesso ao NextGen",
      text: "Link válido por 10 minutos.",
      html: "<p>Link válido por 10 minutos.</p>",
    });

    expect(received).toHaveLength(1);
    const message = received[0];
    if (!message) throw new Error("servidor SMTP não recebeu a mensagem");
    expect(message.to).toEqual(["responsavel@exemplo.test"]);
    expect(message.from).toBe("escola@teste.local");
    // Quoted-printable / MIME quebra linha: normalizar antes de procurar.
    const normalized = message.raw.replace(/\r\n\s+/g, " ");
    expect(normalized).toContain("Subject: Seu link de acesso ao NextGen");
    expect(normalized).toContain("Link v");
  });

  it("falha alto quando o provedor recusa a credencial, sem vazar a senha", async () => {
    const mailer = smtpMailer({
      host: "127.0.0.1",
      port,
      secure: false,
      user: "escola@teste.local",
      pass: "senha-errada",
      from: "NextGen <escola@teste.local>",
    });

    const error = await mailer
      .send({ to: "responsavel@exemplo.test", subject: "x", text: "y" })
      .catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/SMTP recusou o envio/);
    expect((error as Error).message).not.toContain("senha-errada");
  });
});

describe("probeSmtp", () => {
  it("detecta servidor no ar e devolve o banner", async () => {
    const { createServer } = await import("node:net");
    const greeter = createServer((socket) => socket.write("220 smtp.local ESMTP pronto\r\n"));
    await new Promise<void>((resolve) => greeter.listen(0, "127.0.0.1", resolve));
    const address = greeter.address();
    const probePort = typeof address === "object" && address ? address.port : 0;

    try {
      const result = await probeSmtp({ host: "127.0.0.1", port: probePort });
      expect(result.reachable).toBe(true);
      expect(result.banner).toContain("ESMTP");
    } finally {
      await new Promise<void>((resolve) => greeter.close(() => resolve()));
    }
  });

  it("reporta porta fechada com o código de rede", async () => {
    // Porta efêmera fechada: nada escuta ali.
    const result = await probeSmtp({ host: "127.0.0.1", port: 1 }, 1_000);
    expect(result.reachable).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
