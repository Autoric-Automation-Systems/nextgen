/**
 * BR Code — o "Pix copia e cola" do Banco Central (manual EMV® QRCPS-MPM).
 *
 * Gerado aqui, sem gateway e sem API: a chave é da escola e o dinheiro cai direto na
 * conta dela (ADR-004). Um gateway entra depois só para boleto e cartão — o Pix estático
 * continua sendo o caminho que funciona sem contrato, sem webhook e sem certificado.
 */

type Field = { id: string; value: string };

/** TLV: id (2) + tamanho (2, com zero à esquerda) + valor. */
function tlv(id: string, value: string): string {
  const size = String(value.length).padStart(2, "0");
  if (value.length > 99) throw new Error(`campo ${id} excede 99 caracteres`);
  return `${id}${size}${value}`;
}

/**
 * CRC16/CCITT-FALSE — polinômio 0x1021, valor inicial 0xFFFF, sem reflexão.
 *
 * É o algoritmo que o manual do Banco Central define para o campo 63. O cálculo inclui
 * o próprio "6304", por isso o `payload + "6304"` antes de fechar.
 */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * O padrão aceita só ASCII maiúsculo nos campos de texto. Acento vira letra sem acento
 * em vez de derrubar o payload inteiro — "SÃO PAULO" não é rejeitado por um banco.
 */
export function emvText(value: string, max: number): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 .,\-/]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max);
}

export type PixInput = {
  /** Chave Pix: CPF/CNPJ (só dígitos), e-mail, telefone (+55...) ou aleatória. */
  key: string;
  /** Nome do recebedor, até 25 caracteres no padrão. */
  holder: string;
  /** Cidade do recebedor, até 15 caracteres no padrão. */
  city: string;
  amountCents?: number;
  /** Identificador da cobrança; o padrão permite até 25 caracteres alfanuméricos. */
  txid?: string;
};

export type PixPayload = {
  payload: string;
  /** Nome/ cidade já normalizados, para a tela mostrar o que foi de fato enviado. */
  holder: string;
  city: string;
  amountCents?: number;
};

/**
 * Chave normalizada: CPF/CNPJ perde pontuação, telefone ganha +55, e-mail em minúsculas.
 *
 * A ordem importa: 11 dígitos podem ser CPF ou telefone. Parênteses, espaço e hífen de
 * telefone aparecem antes de qualquer coisa; CPF/CNPJ só tem ponto, barra e hífen.
 */
export function normalizePixKey(key: string): string {
  const value = key.trim();
  if (value.includes("@")) return value.toLowerCase();
  if (/[()\s]/.test(value)) {
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 13) {
      return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
    }
  }
  if (/^[\d.\-/]+$/.test(value)) {
    const digits = value.replace(/\D/g, "");
    // 12 ou 13 dígitos com DDI 55 só podem ser telefone: CPF tem 11, CNPJ 14.
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
      return `+${digits}`;
    }
    // Celular sem DDI: 11 dígitos com 9 depois do DDD.
    if (digits.length === 11 && /^\d{2}9/.test(digits)) return `+55${digits}`;
    return digits;
  }
  return value;
}

export function pixPayload(input: PixInput): PixPayload {
  const key = normalizePixKey(input.key);
  if (!key) throw new Error("chave Pix ausente");

  const holder = emvText(input.holder, 25) || "RECEBEDOR";
  const city = emvText(input.city, 15) || "BRASIL";
  const txid =
    (input.txid ?? "***").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 25) || "***";

  const merchant = tlv("00", "br.gov.bcb.pix") + tlv("01", key);
  const fields: Field[] = [
    { id: "00", value: "01" },
    // 12 = uso único: o app não deixa reaproveitar o mesmo QR para outra cobrança.
    { id: "01", value: "12" },
    { id: "26", value: merchant },
    { id: "52", value: "0000" },
    { id: "53", value: "986" },
    ...(input.amountCents && input.amountCents > 0
      ? [{ id: "54", value: (input.amountCents / 100).toFixed(2) }]
      : []),
    { id: "58", value: "BR" },
    { id: "59", value: holder },
    { id: "60", value: city },
    { id: "62", value: tlv("05", txid) },
  ];

  const body = fields.map((field) => tlv(field.id, field.value)).join("");
  const withCrcId = `${body}6304`;

  return {
    payload: `${withCrcId}${crc16(withCrcId)}`,
    holder,
    city,
    amountCents: input.amountCents,
  };
}

/** Confere o dígito de um payload colado, para não gerar QR inválido em produção. */
export function isValidPixPayload(payload: string): boolean {
  if (!payload.startsWith("000201")) return false;
  if (!payload.includes("6304")) return false;
  const body = payload.slice(0, payload.length - 4);
  return crc16(body) === payload.slice(-4).toUpperCase();
}
