/** Dinheiro em centavos, sempre inteiro. Nunca `float` (doc 05 §1). */

export type Cents = number;

export function toCents(value: string | number): Cents {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("valor inválido");
    return Math.round(value * 100);
  }

  const normalized = value.trim().replace(/\s/g, "").replace(/^R\$/, "");

  if (!/^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$|^-?\d+(,\d{1,2})?$|^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`valor monetário inválido: ${value}`);
  }

  const hasComma = normalized.includes(",");
  const decimalSeparator = hasComma ? "," : ".";
  const parts = normalized.split(decimalSeparator);

  const integerPart = hasComma ? parts[0]!.replace(/\./g, "") : parts[0]!;
  const fractionPart = parts[1] ?? "";

  const cents = Number(`${integerPart}.${fractionPart.padEnd(2, "0").slice(0, 2)}`) * 100;
  return Math.round(cents);
}

export function formatBRL(cents: Cents): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function applyDiscount(amount: Cents, discount: Cents): Cents {
  if (discount < 0) throw new Error("desconto não pode ser negativo");
  if (discount > amount) return 0;
  return amount - discount;
}

/** Proporcional por dias corridos no mês (matrícula no meio do mês). */
export function prorateMonthly(amount: Cents, startDay: number, daysInMonth: number): Cents {
  if (startDay < 1 || startDay > daysInMonth) throw new Error("dia inválido");
  const remaining = daysInMonth - startDay + 1;
  return Math.round((amount * remaining) / daysInMonth);
}

export function sum(values: Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}
