# 18 — Assinatura da NextGen e envio da cobrança

Duas coisas que parecem a mesma e não são. A confusão entre elas é o erro mais caro que
este produto pode cometer: quem recebe o dinheiro muda a natureza jurídica da operação.

## 1. Os dois dinheiros

| | Mensalidade do aluno | Assinatura da NextGen |
|---|---|---|
| Quem paga | responsável financeiro | dono da escola |
| Quem recebe | **a escola** | **a NextGen** |
| Como | Pix copia-e-cola com a chave da escola (+ boleto da escola) | Asaas (Pix, boleto ou cartão) |
| Passa por gateway? | não | sim |
| Tabela | `invoices` | `saas_charges` / `saas_subscriptions` |
| Tela | `/financeiro/*` e `/meus-boletos` | `/assinatura` |

O Asaas só entrou no produto para o lado direito da tabela. Se um dia a escola quiser
cobrar o responsável por gateway, isso é uma decisão nova (doc 07, modelo B), não uma
configuração.

## 2. Envio da cobrança ao responsável

A escola escolhe **se** o envio sai sozinho e **em que dia do mês**, em
`/financeiro/envio`. O e-mail leva o código Pix, o valor, o aluno e o vencimento.

**Regras**
- Dia de envio entre 1 e 28. Dia 29–31 não existe em fevereiro, e uma escola configurada
  para "31" nunca receberia aviso em fevereiro — descobriria pela reclamação.
- O dia do **envio** é independente do dia do **vencimento**. Quem vence dia 10 costuma
  querer o lembrete dia 3.
- **Um envio por cobrança por competência.** A garantia é `invoices.last_sent_at`
  comparado com a competência, não uma coluna `sent`. Mudar o dia no meio do mês não gera
  segundo e-mail; rodar o job várias vezes no dia também não.
- Reenvio é sempre manual, botão por linha em Mensalidades (`force: true`).
- Cobrança paga ou cancelada não entra no envio automático.
- Sem chave Pix cadastrada, o e-mail sai assim mesmo, avisando que o boleto está na
  secretaria — silêncio seria pior que a verdade.

**Job.** `GET /api/cron/cobrancas`, uma vez por dia (`apps/web/vercel.json`, 11h UTC),
protegido por `Authorization: Bearer $CRON_SECRET`. Lista as escolas com envio automático
pelo cliente administrativo (job de sistema, sem sessão), e faz cada envio dentro do
`withTenant` daquela escola. Se o job não rodar no dia certo, ele alcança a cobrança no dia
seguinte: melhor um aviso atrasado que nenhum.

**Um caminho só.** Manual e automático chamam `sendInvoiceEmail`
(`apps/web/lib/invoice-mail.ts`). Dois códigos divergiriam no primeiro ajuste de texto ou na
regra de quem recebe — e o responsável financeiro é sempre `StudentGuardian.isFinancial`,
nunca o aluno.

## 3. Assinatura da NextGen

**Fluxo**
1. A escola nasce em teste de 14 dias (`School.trialEndsAt`).
2. Em `/assinatura`, o administrador escolhe o plano e informa CPF/CNPJ.
3. A NextGen cria (ou reaproveita) o cliente no Asaas e uma assinatura mensal com o valor
   do plano.
4. O primeiro vencimento é o **fim do teste**; teste vencido cobra no dia da contratação.
5. O webhook atualiza o espelho local; a tela mostra as faturas com link para pagar.

**Planos** (fonte: `packages/core/src/saas.ts`; tabela comercial no doc 12)

| Plano | Alunos | Preço |
|---|---|---|
| Campo | até 80 | R$ 199 fixo |
| Escola | 81–300 | R$ 3,50/aluno, mínimo R$ 349 |
| Clube | 300+ | R$ 2,80/aluno, mínimo R$ 899 |

O valor é congelado em `saas_subscriptions.price_cents` na contratação. Reajustar a tabela
não muda a fatura de ninguém sem uma ação explícita — o histórico fica na fatura e no Asaas.

**LGPD.** O CNPJ é digitado a cada contratação e enviado só ao Asaas. O banco guarda apenas
`cnpj_hash` e `cnpj_last4` (doc 02), então não há como reenviar o documento a partir do
nosso lado — e é assim que deve ser. O e-mail do cliente no Asaas é o do administrador que
contratou, nunca o de um responsável.

**Webhook.** `POST /api/webhooks/asaas`, autenticado por `asaas-access-token`
(`ASAAS_WEBHOOK_TOKEN`, comparação em tempo constante). Idempotente por
`saas_charges.asaas_payment_id`.

| Evento Asaas | Efeito |
|---|---|
| `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` / `RECEIVED_IN_CASH` | fatura `paid`; assinatura `active`, próximo vencimento +1 mês |
| `PAYMENT_OVERDUE` | fatura `overdue`; assinatura `past_due` |
| `PAYMENT_REFUNDED` | fatura `refunded` |
| `PAYMENT_DELETED` | fatura `canceled`; assinatura `canceled` |

Nenhum caminho do webhook toca `invoices`. Um pagamento no Asaas **não** baixa a mensalidade
de um aluno: são dinheiros de donos diferentes.

**Sincronizar** existe porque webhook mal configurado é comum no começo: o botão consulta
`/subscriptions/{id}/payments` e faz o mesmo upsert. É idempotente e não substitui o webhook,
só cobre o intervalo.

## 4. Modelo de dados

```
schools
  invoice_send_automatic  boolean  -- liga o envio mensal
  invoice_send_day        int      -- 1..28

invoices
  last_sent_at            timestamptz  -- último envio ao responsável
  send_count              int          -- quantos envios, para auditoria

saas_subscriptions  (1 por escola)
  plan_code, status, price_cents, seats, trial_ends_at,
  current_period_end, next_due_date,
  asaas_customer_id (único), asaas_subscription_id (único), canceled_at

saas_charges  (espelho das faturas do Asaas)
  asaas_payment_id (único), status, amount_cents, due_date,
  paid_at, billing_type, invoice_url, competence
```

RLS: as duas tabelas novas têm `tenant_isolation` por `school_id` e uma política de leitura
para `app.is_platform_staff()`. A operação da plataforma precisa cobrar e dar suporte sem
impersonar a escola; escrita continua exigindo o tenant.

## 5. Onde está o quê

| Arquivo | Papel |
|---|---|
| `packages/core/src/dunning.ts` | quando enviar, dia válido, aviso de envio depois do vencimento |
| `packages/core/src/saas.ts` | planos, preço, trial, status efetivo, primeiro vencimento |
| `packages/integrations/src/asaas.ts` | cliente HTTP, mapa de status, verificação do token |
| `apps/web/lib/invoice-mail.ts` | montagem e envio do e-mail da cobrança |
| `apps/web/lib/delivery.ts` | configuração e cobranças do dia |
| `apps/web/lib/saas.ts` | leitura da assinatura para a tela |
| `apps/web/app/(app)/financeiro/envio` | seletor de envio |
| `apps/web/app/(app)/assinatura` | plano, faturas, contratar, sincronizar, cancelar |
| `apps/web/app/api/cron/cobrancas` | job diário |
| `apps/web/app/api/webhooks/asaas` | webhook idempotente |

## 6. Configuração

```bash
ASAAS_API_KEY=""              # obrigatório para contratar; sem ele a tela avisa
ASAAS_BASE_URL=""             # sandbox.asaas.com/api/v3 fora de produção
ASAAS_WEBHOOK_TOKEN=""        # o mesmo configurado no painel do Asaas
CRON_SECRET=""                # openssl rand -base64 32
```

No painel do Asaas: cadastrar o webhook apontando para `/api/webhooks/asaas`, marcar os
eventos de pagamento e informar o token. Sem token configurado, o endpoint responde 401 —
falha fechada, porque aceitar qualquer requisição significaria aceitar "fatura paga" de
qualquer um.

## 7. O que ainda não existe

- **Cobrança de excedente de alunos**: o plano contratado congela `seats`; crescer 40 alunos
  no mês não gera fatura proporcional. Decidir entre recálculo mensal e fatura de ajuste.
- **Régua da assinatura**: hoje um aviso em tela quando está `past_due`. Falta e-mail antes
  do vencimento, retentativa e suspensão gradual (primeiro o site público, depois o app).
- **Nota fiscal** da assinatura e conciliação contábil.
- **Rateio de reajuste**: aplicar novo preço a quem já contratou exige lote com aviso prévio.
- **Idempotência de envio sob concorrência**: dois jobs simultâneos podem enviar o mesmo
  e-mail; a janela é de segundos e o custo é um aviso duplicado. Resolver com `advisory lock`
  por cobrança quando o volume justificar.

## 8. Testes

Sem banco no ambiente de desenvolvimento, a regra ficou nas funções puras:

- `dunning.test.ts`: dia válido, prendedor de fim de mês, antes/depois do dia, um envio por
  competência, manual/paga/cancelada.
- `saas.test.ts`: preço por faixa com piso, plano sugerido, ciclo de vencimento, teste
  vencido vira atraso, primeiro vencimento.
- `asaas.test.ts`: mapa de status (incluindo `RECEIVED_IN_CASH`), conversão de reais,
  cabeçalho do token, verificação do webhook, erro HTTP virando `AsaasError`.
