import { describe, expect, it } from "vitest";
import { crc16, emvText, isValidPixPayload, normalizePixKey, pixPayload } from "../pix";

describe("CRC16/CCITT-FALSE", () => {
  it("bate o vetor de verificação padrão", () => {
    // "123456789" → 0x29B1 é o valor publicado para o CRC-16/CCITT-FALSE.
    expect(crc16("123456789")).toBe("29B1");
  });

  it("devolve sempre quatro dígitos hexadecimais maiúsculos", () => {
    for (const input of ["", "a", "000201", "br.gov.bcb.pix"]) {
      expect(crc16(input)).toMatch(/^[0-9A-F]{4}$/);
    }
  });
});

describe("normalização de texto EMV", () => {
  it("remove acento em vez de derrubar o payload", () => {
    expect(emvText("São Paulo", 15)).toBe("SAO PAULO");
    expect(emvText("Ação Futebol Clube", 25)).toBe("ACAO FUTEBOL CLUBE");
  });

  it("corta no limite do campo", () => {
    expect(emvText("Escola de Futebol NextGen Unidade Centro", 25)).toHaveLength(25);
    expect(emvText("Brasília", 15)).toBe("BRASILIA");
  });
});

describe("chave Pix", () => {
  it("tira a pontuação de CPF e CNPJ", () => {
    expect(normalizePixKey("123.456.789-01")).toBe("12345678901");
    expect(normalizePixKey("12.345.678/0001-90")).toBe("12345678000190");
  });

  it("completa telefone com +55 sem duplicar", () => {
    expect(normalizePixKey("(11) 98888-7777")).toBe("+5511988887777");
    expect(normalizePixKey("+5511988887777")).toBe("+5511988887777");
    expect(normalizePixKey("5511988887777")).toBe("+5511988887777");
  });

  it("mantém e-mail em minúsculas", () => {
    expect(normalizePixKey("Financeiro@Escola.com.br")).toBe("financeiro@escola.com.br");
  });
});

describe("BR Code", () => {
  const base = {
    key: "financeiro@escola.test",
    holder: "Escola Teste",
    city: "São Paulo",
  };

  it("monta os campos obrigatórios do padrão", () => {
    const { payload } = pixPayload({ ...base, amountCents: 45000 });

    expect(payload.startsWith("000201")).toBe(true);
    expect(payload).toContain("br.gov.bcb.pix");
    expect(payload).toContain("5303986");
    expect(payload).toContain("5802BR");
    expect(payload).toContain("5406450.00");
    expect(payload).toContain("5912ESCOLA TESTE");
    expect(payload).toContain("6009SAO PAULO");
    expect(isValidPixPayload(payload)).toBe(true);
  });

  it("omite o valor quando ele não é informado (QR de valor aberto)", () => {
    const { payload } = pixPayload(base);
    expect(payload).not.toContain("5405");
    expect(isValidPixPayload(payload)).toBe(true);
  });

  it("usa o identificador da cobrança como txid, sem pontuação", () => {
    const { payload } = pixPayload({ ...base, txid: "0f8b4a2e-1111-2222" });
    expect(payload).toContain("0516" + "0F8B4A2E11112222");
  });

  it("cai para o txid curinga quando não há identificador", () => {
    const { payload } = pixPayload(base);
    expect(payload).toContain("0503***");
  });

  it("recusa chave vazia em vez de gerar QR inválido", () => {
    expect(() => pixPayload({ ...base, key: "   " })).toThrow(/chave Pix ausente/);
  });

  it("rejeita um payload com CRC trocado", () => {
    const { payload } = pixPayload({ ...base, amountCents: 10000 });
    const tampered = `${payload.slice(0, -4)}0000`;
    expect(isValidPixPayload(tampered)).toBe(false);
    expect(isValidPixPayload("000201qualquercoisa")).toBe(false);
  });

  it("gera payloads diferentes para valores diferentes", () => {
    const a = pixPayload({ ...base, amountCents: 10000 }).payload;
    const b = pixPayload({ ...base, amountCents: 10001 }).payload;
    expect(a).not.toBe(b);
    expect(isValidPixPayload(a)).toBe(true);
    expect(isValidPixPayload(b)).toBe(true);
  });
});
