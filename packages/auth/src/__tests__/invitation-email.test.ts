import { describe, expect, it } from "vitest";
import { buildInvitationEmail } from "../invitation-email";

const base = {
  url: "https://nextgen.test/api/auth/reset-password/abc123?callbackURL=%2Fredefinir-senha",
  email: "responsavel@exemplo.test",
  appUrl: "https://nextgen.test/",
  schoolName: "Escola Gol de Ouro",
};

describe("buildInvitationEmail", () => {
  it("assina o convite com o nome da escola, não com um pedido da pessoa", () => {
    const { subject, html, text } = buildInvitationEmail(base);

    expect(subject).toBe("Escola Gol de Ouro criou seu acesso ao NextGen");
    expect(html).toContain("A escola <strong>Escola Gol de Ouro</strong> cadastrou");
    expect(text).toContain("A escola Escola Gol de Ouro cadastrou");
    // O texto antigo dizia "você pediu para entrar": quem não pediu nada desconfia.
    expect(html).not.toContain("Você pediu");
    expect(text).not.toContain("Você pediu");
  });

  it("o botão cria a senha; o e-mail não promete login por link", () => {
    const { html } = buildInvitationEmail(base);

    expect(html).toContain("Criar minha senha");
    expect(html).not.toContain("Entrar no NextGen");
    expect(html).toContain("/api/auth/reset-password/abc123");
    // O link do Better Auth precisa sobreviver escapado dentro do HTML.
    expect(html).toContain("callbackURL=%2Fredefinir-senha");
  });

  it("sem escola, o texto continua verdadeiro", () => {
    const { subject, html } = buildInvitationEmail({ ...base, schoolName: null });

    expect(subject).toBe("Sua escola criou seu acesso ao NextGen");
    expect(html).toContain("Sua escola");
  });

  it("não deixa o nome da escola quebrar o assunto", () => {
    const { subject } = buildInvitationEmail({
      ...base,
      schoolName: "Escola\r\nBcc: vitima@exemplo.test",
    });

    expect(subject).not.toContain("\n");
    expect(subject).not.toContain("\r");
  });

  it("escapa HTML vindo do nome da escola e do e-mail", () => {
    const { html } = buildInvitationEmail({
      ...base,
      schoolName: "<b>Futebol</b>",
      email: "<script>alert(1)</script>@exemplo.test",
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Futebol</b>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("diz o prazo em minutos, no HTML e no texto", () => {
    const invite = buildInvitationEmail({ ...base, expiresInMinutes: 30 });

    expect(invite.html).toContain("Válido por 30 minutos");
    expect(invite.text).toContain("vale por 30 minutos");
  });

  it("traz o link cru na versão em texto e o aviso para quem não conhece a escola", () => {
    const { text } = buildInvitationEmail(base);

    expect(text).toContain(base.url);
    expect(text).toContain("Não conhece esta escola?");
    expect(text).toContain(base.email);
    expect(text).not.toContain("<");
  });

  it("usa os logos em URL absoluta e não usa recurso que cliente de e-mail descarta", () => {
    const { html } = buildInvitationEmail({ ...base, appUrl: "https://nextgen.test/" });

    expect(html).toContain('src="https://nextgen.test/brand/mark.png"');
    expect(html).not.toContain("https://nextgen.test//brand");
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("<style");
  });
});
