/**
 * Asaas: gateway da **assinatura da escola com a NextGen** (doc 18).
 *
 * Não é o gateway da mensalidade do aluno. Ali o Pix é gerado no BR Code da própria
 * escola e o dinheiro nunca passa pela NextGen (doc 07) — intermediação exigiria
 * arranjo de pagamento. Aqui é o contrário: quem recebe é a NextGen, então precisa de
 * gateway de verdade, com boleto, Pix e cartão.
 *
 * O cliente recebe `fetch` por injeção para o teste não depender de rede.
 */

export type AsaasConfig = {
  apiKey: string;
  /** `https://sandbox.asaas.com/api/v3` em desenvolvimento. */
  baseUrl: string;
};

export const ASAAS_PRODUCTION_URL = "https://api.asaas.com/v3";
export const ASAAS_SANDBOX_URL = "https://sandbox.asaas.com/api/v3";

/**
 * Sem chave, o app não deve fingir que cobra: a tela mostra "assinatura não configurada"
 * em vez de criar uma fatura que nunca chega ao dono da escola.
 */
export function asaasConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AsaasConfig | null {
  const apiKey = env.ASAAS_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = env.ASAAS_BASE_URL?.trim() || ASAAS_PRODUCTION_URL;
  return { apiKey, baseUrl: baseUrl.replace(/\/+$/, "") };
}

export type AsaasCustomer = { id: string };

export type AsaasSubscription = {
  id: string;
  status: string;
  value: number;
  nextDueDate: string;
};

export type AsaasPayment = {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  paymentDate?: string | null;
  billingType?: string | null;
  invoiceUrl?: string | null;
  subscription?: string | null;
};

export type AsaasChargeStatus = "pending" | "paid" | "overdue" | "refunded" | "canceled";

/**
 * Traduz o status do Asaas para o nosso. `RECEIVED_IN_CASH` conta como pago: dinheiro
 * entrou, mesmo que fora do boleto.
 */
export function mapAsaasStatus(status: string): AsaasChargeStatus {
  switch (status.toUpperCase()) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "paid";
    case "OVERDUE":
      return "overdue";
    case "REFUNDED":
    case "REFUND_REQUESTED":
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
      return "refunded";
    case "DELETED":
    case "CANCELED":
      return "canceled";
    default:
      return "pending";
  }
}

/** Reais (o que o Asaas devolve) para centavos (o que o banco guarda). */
export function reaisToCents(value: number): number {
  return Math.round(value * 100);
}

export function centsToReais(cents: number): number {
  return Math.round(cents) / 100;
}

/** `2026-11-10` → `Date` em UTC, sem depender do fuso do servidor. */
export function parseAsaasDate(value: string): Date {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`data inválida do Asaas: ${value}`);
  return date;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * O Asaas manda o token do webhook no cabeçalho `asaas-access-token`, configurado no
 * painel. Sem ele, qualquer requisição marcaria fatura como paga — então a comparação é
 * obrigatória e em tempo constante.
 */
export function verifyWebhookToken(received: string | null, expected: string | null): boolean {
  if (!expected) return false;
  if (!received) return false;
  if (received.length !== expected.length) return false;

  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return diff === 0;
}

export class AsaasError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AsaasError";
  }
}

type FetchLike = typeof fetch;

export class AsaasClient {
  constructor(
    private readonly config: AsaasConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.config.baseUrl}${path}`, {
      method,
      headers: {
        access_token: this.config.apiKey,
        "Content-Type": "application/json",
        // O Asaas exige um User-Agent identificável; sem ele responde 403 em produção.
        "User-Agent": "NextGen/1.0",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new AsaasError(response.status, text.slice(0, 500) || `Asaas ${response.status}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  createCustomer(input: {
    name: string;
    email?: string | null;
    cpfCnpj?: string | null;
    externalReference: string;
  }): Promise<AsaasCustomer> {
    return this.request<AsaasCustomer>("POST", "/customers", {
      name: input.name,
      email: input.email ?? undefined,
      cpfCnpj: input.cpfCnpj ?? undefined,
      externalReference: input.externalReference,
    });
  }

  createSubscription(input: {
    customerId: string;
    valueCents: number;
    nextDueDate: string;
    description: string;
    externalReference: string;
    billingType?: "BOLETO" | "PIX" | "UNDEFINED";
  }): Promise<AsaasSubscription> {
    return this.request<AsaasSubscription>("POST", "/subscriptions", {
      customer: input.customerId,
      billingType: input.billingType ?? "UNDEFINED",
      value: centsToReais(input.valueCents),
      nextDueDate: input.nextDueDate,
      cycle: "MONTHLY",
      description: input.description,
      externalReference: input.externalReference,
    });
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.request<unknown>("DELETE", `/subscriptions/${subscriptionId}`);
  }

  listSubscriptionPayments(subscriptionId: string): Promise<{ data: AsaasPayment[] }> {
    return this.request<{ data: AsaasPayment[] }>(
      "GET",
      `/subscriptions/${subscriptionId}/payments`,
    );
  }
}
