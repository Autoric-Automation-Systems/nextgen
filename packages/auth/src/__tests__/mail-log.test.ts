import { describe, expect, it } from "vitest";
import { loggingMailer, maskAddress } from "../mail-log";

describe("maskAddress", () => {
  it("esconde a parte local e mantém o domínio", () => {
    expect(maskAddress("ana.silva@escola.com.br")).toBe("a***@escola.com.br");
  });

  it("não deixa a parte local vazar em endereço de um caractere", () => {
    expect(maskAddress("a@x.com")).toBe("a***@x.com");
  });

  it("trata entrada sem domínio sem quebrar", () => {
    expect(maskAddress("sem-arroba")).toBe("***");
  });
});

describe("loggingMailer: rótulo do motivo", () => {
  it("usa o kind da mensagem quando o chamador informa", async () => {
    const calls: unknown[] = [];
    const inner = {
      async send(message: { kind?: string }) {
        calls.push(message.kind);
      },
    };
    // Sem banco no teste, `record` falha em silêncio por desenho; o que importa aqui é
    // que o rótulo do chamador vence o padrão do transporte.
    const mailer = loggingMailer(inner, "acesso");

    await mailer.send({ to: "a@b.test", subject: "s", text: "t", kind: "convite" });
    await mailer.send({ to: "a@b.test", subject: "s", text: "t" });

    expect(calls).toEqual(["convite", undefined]);
  });
});
