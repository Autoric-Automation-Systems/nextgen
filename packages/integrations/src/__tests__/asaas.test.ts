import { describe, expect, it } from "vitest";
import {
  AsaasClient,
  AsaasError,
  asaasConfigFromEnv,
  centsToReais,
  mapAsaasStatus,
  parseAsaasDate,
  reaisToCents,
  verifyWebhookToken,
} from "../asaas";

const config = { apiKey: "chave-teste", baseUrl: "https://sandbox.example/v3" };

function fakeFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, options: RequestInit) => {
    calls.push({ url: String(url), init: options });
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("asaasConfigFromEnv", () => {
  it("devolve null sem chave, para a tela não fingir cobrança", () => {
    expect(asaasConfigFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
    expect(asaasConfigFromEnv({ ASAAS_API_KEY: "   " } as NodeJS.ProcessEnv)).toBeNull();
  });

  it("usa produção por padrão e aceita sandbox", () => {
    expect(asaasConfigFromEnv({ ASAAS_API_KEY: "k" } as NodeJS.ProcessEnv)?.baseUrl).toBe(
      "https://api.asaas.com/v3",
    );
    expect(
      asaasConfigFromEnv({
        ASAAS_API_KEY: "k",
        ASAAS_BASE_URL: "https://sandbox.asaas.com/api/v3/",
      } as NodeJS.ProcessEnv)?.baseUrl,
    ).toBe("https://sandbox.asaas.com/api/v3");
  });
});

describe("mapAsaasStatus", () => {
  it("trata dinheiro fora do boleto como pago", () => {
    expect(mapAsaasStatus("RECEIVED_IN_CASH")).toBe("paid");
    expect(mapAsaasStatus("CONFIRMED")).toBe("paid");
  });

  it("cobre atraso, estorno e cancelamento", () => {
    expect(mapAsaasStatus("OVERDUE")).toBe("overdue");
    expect(mapAsaasStatus("REFUNDED")).toBe("refunded");
    expect(mapAsaasStatus("DELETED")).toBe("canceled");
  });

  it("status desconhecido fica pendente em vez de virar pago", () => {
    expect(mapAsaasStatus("AWAITING_RISK_ANALYSIS")).toBe("pending");
    expect(mapAsaasStatus("QUALQUER_COISA_NOVA")).toBe("pending");
  });
});

describe("dinheiro e data", () => {
  it("converte reais e centavos sem erro de ponto flutuante", () => {
    expect(reaisToCents(349.9)).toBe(34_990);
    expect(reaisToCents(0.1 + 0.2)).toBe(30);
    expect(centsToReais(34_990)).toBe(349.9);
  });

  it("lê a data do Asaas em UTC, sem perder um dia no Brasil", () => {
    expect(parseAsaasDate("2026-11-10").toISOString().slice(0, 10)).toBe("2026-11-10");
    expect(() => parseAsaasDate("10/11/2026")).toThrow(/data inválida/);
  });
});

describe("verifyWebhookToken", () => {
  it("só aceita o token exato", () => {
    expect(verifyWebhookToken("segredo", "segredo")).toBe(true);
    expect(verifyWebhookToken("segred0", "segredo")).toBe(false);
    expect(verifyWebhookToken("segredo", "segredos")).toBe(false);
    expect(verifyWebhookToken(null, "segredo")).toBe(false);
  });

  it("falha fechado quando o servidor não configurou token", () => {
    expect(verifyWebhookToken("qualquer", null)).toBe(false);
    expect(verifyWebhookToken("", "")).toBe(false);
  });
});

describe("AsaasClient", () => {
  it("cria cliente com referência externa e sem CPF vazio", async () => {
    const { impl, calls } = fakeFetch({ id: "cus_1" });
    const client = new AsaasClient(config, impl);

    await client.createCustomer({ name: "Escola Teste", externalReference: "school-1" });

    expect(calls[0]!.url).toBe("https://sandbox.example/v3/customers");
    expect(calls[0]!.init.method).toBe("POST");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.externalReference).toBe("school-1");
    expect(body).not.toHaveProperty("cpfCnpj");
  });

  it("cria assinatura mensal com valor em reais", async () => {
    const { impl, calls } = fakeFetch({ id: "sub_1", status: "ACTIVE", value: 349.9, nextDueDate: "2026-12-10" });
    const client = new AsaasClient(config, impl);

    await client.createSubscription({
      customerId: "cus_1",
      valueCents: 34_990,
      nextDueDate: "2026-12-10",
      description: "NextGen — plano Escola",
      externalReference: "school-1",
    });

    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.cycle).toBe("MONTHLY");
    expect(body.value).toBe(349.9);
    expect(body.billingType).toBe("UNDEFINED");
  });

  it("transforma resposta de erro em AsaasError com o status", async () => {
    const { impl } = fakeFetch({ errors: [{ description: "chave inválida" }] }, { ok: false, status: 401 });
    const client = new AsaasClient(config, impl);

    await expect(
      client.createSubscription({
        customerId: "cus_1",
        valueCents: 100,
        nextDueDate: "2026-12-10",
        description: "x",
        externalReference: "school-1",
      }),
    ).rejects.toBeInstanceOf(AsaasError);
  });

  it("envia o token no cabeçalho e não no corpo", async () => {
    const { impl, calls } = fakeFetch({ data: [] });
    const client = new AsaasClient(config, impl);

    await client.listSubscriptionPayments("sub_1");

    expect((calls[0]!.init.headers as Record<string, string>).access_token).toBe("chave-teste");
  });
});
