/**
 * Envio da cobrança ao responsável (doc 07 §6).
 *
 * A escola escolhe **se** o envio sai sozinho e **em que dia do mês**. O dia é da
 * competência, não do vencimento: quem vence dia 10 costuma querer o lembrete dia 3, e
 * quem vence dia 30 quer dia 25. Duas informações diferentes, dois campos.
 *
 * "Já enviado" é derivado de `lastSentAt` versus a competência, não de uma coluna `sent`.
 * Assim o job pode rodar quantas vezes for: no máximo um e-mail por cobrança por mês.
 */

import { competenceOf, daysInMonth, parseCompetence, todayUtc, type Competence } from "./billing";

export type DeliverySettings = {
  /** `false` = o envio é sempre manual, botão por cobrança. */
  automatic: boolean;
  /** Dia do mês em que o e-mail sai. */
  sendDay: number;
};

export const DEFAULT_DELIVERY: DeliverySettings = { automatic: false, sendDay: 5 };

/**
 * Dia 29 a 31 não existe em todo mês. O limite é 28 de propósito: um envio configurado
 * para "dia 31" simplesmente não aconteceria em fevereiro — e a escola não descobriria
 * pelo calendário, só pela reclamação do responsável.
 */
export const MAX_SEND_DAY = 28;

export function isValidSendDay(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_SEND_DAY;
}

export function normalizeSendDay(value: number | null | undefined): number {
  return value !== null && value !== undefined && isValidSendDay(value) ? value : DEFAULT_DELIVERY.sendDay;
}

/** Data do envio dentro da competência, presa ao último dia do mês. */
export function deliveryDateFor(competence: Competence, sendDay: number): Date {
  if (!isValidSendDay(sendDay)) {
    throw new Error(`dia de envio inválido: ${sendDay} (use 1 a ${MAX_SEND_DAY})`);
  }
  const { year, month } = parseCompetence(competence);
  const day = Math.min(sendDay, daysInMonth(year, month));
  return new Date(Date.UTC(year, month - 1, day));
}

export type DeliveryInput = {
  settings: DeliverySettings;
  competence: Competence;
  /** Nulo quando a cobrança nunca foi enviada. */
  lastSentAt: Date | null;
  /** Cobrança cancelada não é enviada, mesmo no dia. */
  canceled?: boolean;
  /** Já pago não precisa de lembrete. */
  paid?: boolean;
  today?: Date;
};

/** Quem decide se o job de hoje pega esta cobrança. */
export function shouldDeliverToday({
  settings,
  competence,
  lastSentAt,
  canceled = false,
  paid = false,
  today = todayUtc(),
}: DeliveryInput): boolean {
  if (!settings.automatic) return false;
  if (canceled || paid) return false;

  const scheduled = deliveryDateFor(competence, settings.sendDay);
  if (dayNumber(today) < dayNumber(scheduled)) return false;

  // Um envio por competência. Mudar o dia no meio do mês não manda o segundo e-mail: o
  // responsável já tem o código, e o reenvio manual continua ali para quem precisa.
  return lastSentAt === null || competenceOf(lastSentAt) !== competence;
}

/**
 * Aviso mostrado na tela de configuração. Não bloqueia: enviar depois do vencimento é
 * escolha legítima de quem cobra na mão, e o texto só precisa ser honesto sobre o efeito.
 */
export function deliveryHint(settings: DeliverySettings, dueDay: number | null): string | null {
  if (!settings.automatic) return "O envio fica no botão de cada cobrança.";
  if (dueDay !== null && settings.sendDay >= dueDay) {
    return `O envio sai no dia ${settings.sendDay}, depois do vencimento (dia ${dueDay}) da maioria dos planos.`;
  }
  return null;
}

export function describeDelivery(settings: DeliverySettings): string {
  return settings.automatic
    ? `Envio automático todo dia ${settings.sendDay}`
    : "Envio manual, cobrança por cobrança";
}

function dayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
}
