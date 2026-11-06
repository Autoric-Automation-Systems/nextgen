import { describe, expect, it } from "vitest";
import { buildMagicLinkEmail } from "../magic-link-email";

const base = {
  url: "https://nextgen.test/api/auth/magic-link/verify?token=abc123&callbackURL=%2Fdashboard",
  email: "responsavel@exemplo.test",
  appUrl: "https://nextgen.test/",
};

describe("buildMagicLinkEmail", () => {
  it("assunto fixo, sem dado pessoal e sem emoji", () => {
    const { subject } = buildMagicLinkEmail(base);

    expect(subject).toBe("Seu link de acesso ao NextGen");
    // Emoji no assunto é o item que mais pesa em filtro de spam e não renderiza igual
    // em todos os clientes.
    expect(subject).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("leva o link no botão e também por extenso", () => {
    const { html } = buildMagicLinkEmail(base);
    const occurrences = html.split("token=abc123").length - 1;

    // Botão + caixa "copie o endereço" (dois `href`) + o endereço visível dentro dela:
    // dois caminhos, porque cliente corporativo costuma abrir o link em navegador
    // interno onde o botão não funciona.
    expect(occurrences).toBe(3);
    expect(html).toContain("Entrar no NextGen");
    expect(html).toContain("Copie o endereço abaixo");
  });

  it("escapa `&` do link: sem isso o token chega truncado no destino", () => {
    const { html } = buildMagicLinkEmail(base);

    expect(html).toContain("token=abc123&amp;callbackURL=");
    expect(html).not.toContain("token=abc123&callbackURL");
  });

  it("usa os logos do app e do desenvolvedor em URL absoluta", () => {
    const { html } = buildMagicLinkEmail(base);

    expect(html).toContain('src="https://nextgen.test/brand/mark.png"');
    expect(html).toContain('src="https://nextgen.test/dev/logo.png"');
    expect(html).toContain('href="https://www.autoric.com.br"');
  });

  it("normaliza a barra final do endereço base", () => {
    const { html } = buildMagicLinkEmail({ ...base, appUrl: "https://nextgen.test/" });

    expect(html).toContain("https://nextgen.test/brand/mark.png");
    expect(html).not.toContain("https://nextgen.test//brand");
  });

  it("diz o prazo em minutos, no HTML e no texto", () => {
    const five = buildMagicLinkEmail({ ...base, expiresInMinutes: 5 });

    expect(five.html).toContain("Válido por 5 minutos");
    expect(five.text).toContain("vale por 5 minutos");
  });

  it("a versão em texto traz o link cru e o aviso de segurança", () => {
    const { text } = buildMagicLinkEmail(base);

    expect(text).toContain(base.url);
    expect(text).toContain("Não foi você?");
    expect(text).toContain(base.email);
    // Texto puro não carrega marcação: um `<` aqui apareceria literalmente no cliente.
    expect(text).not.toContain("<");
  });

  it("menciona a escola quando o convite é de uma escola", () => {
    const { html, text } = buildMagicLinkEmail({ ...base, schoolName: "Escola Gol de Ouro" });

    expect(html).toContain("Escola Gol de Ouro");
    expect(text).toContain("escola Escola Gol de Ouro");
  });

  it("não deixa HTML do remetente entrar no corpo", () => {
    const { html, text } = buildMagicLinkEmail({
      ...base,
      email: '<script>alert(1)</script>@exemplo.test',
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(text).toContain("<script>");
  });

  it("não usa recurso que cliente de e-mail descarta", () => {
    const { html } = buildMagicLinkEmail(base);

    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("display:grid");
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("<style");
  });

  it("tem prévia escondida, que é o texto exibido ao lado do assunto", () => {
    const { html } = buildMagicLinkEmail(base);

    expect(html).toContain("max-height:0");
    expect(html).toContain("Seu link de uso único");
  });
});
