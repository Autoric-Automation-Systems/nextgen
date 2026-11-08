"use client";

import { useActionState } from "react";
import { createExpense, createPlan, generateMonth, savePixSettings, type FinanceState } from "./actions";

const initial: FinanceState = { status: "idle" };

function Feedback({ state }: { state: FinanceState }) {
  if (state.status === "idle") return null;
  return (
    <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status">
      {state.message}
    </p>
  );
}

export function PlanForm() {
  const [state, action, pending] = useActionState(createPlan, initial);

  return (
    <form action={action}>
      <Feedback state={state} />
      <div className="field-row">
        <div className="field">
          <label htmlFor="plan-name">Nome do plano</label>
          <input id="plan-name" name="name" required maxLength={60} placeholder="Mensalidade 3x semana" />
        </div>
        <div className="field">
          <label htmlFor="plan-amount">Valor mensal</label>
          <input id="plan-amount" name="monthlyAmount" required inputMode="decimal" placeholder="450,00" />
        </div>
        <div className="field">
          <label htmlFor="plan-due">Dia padrão</label>
          <input id="plan-due" name="dueDay" type="number" min={1} max={31} defaultValue={10} required />
        </div>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        O dia padrão vale para quem não escolheu outro na matrícula. Dia 31 em fevereiro vence no
        último dia do mês.
      </p>
      <button className="btn" disabled={pending}>
        {pending ? "Criando…" : "Criar plano"}
      </button>
    </form>
  );
}

export function GenerateForm({ competence, billable }: { competence: string; billable: number }) {
  const [state, action, pending] = useActionState(generateMonth, initial);

  return (
    <form action={action}>
      <Feedback state={state} />
      <input type="hidden" name="competence" value={competence} />
      <p className="muted" style={{ marginTop: 0 }}>
        {billable === 0
          ? "Nenhum aluno com plano e matrícula ativa ainda. Defina o plano no aluno para poder cobrar."
          : `${billable} aluno(s) com plano e matrícula ativa vão receber cobrança deste mês. Quem já tem a competência não é cobrado de novo.`}
      </p>
      <button className="btn" disabled={pending || billable === 0}>
        {pending ? "Gerando…" : `Gerar mensalidades de ${competence}`}
      </button>
    </form>
  );
}

export function ExpenseForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(createExpense, initial);

  return (
    <form action={action}>
      <Feedback state={state} />
      <div className="field-row">
        <div className="field">
          <label htmlFor="expense-category">Categoria</label>
          <select id="expense-category" name="category" defaultValue="campo">
            <option value="campo">Campo e aluguel</option>
            <option value="salario">Salário e pró-labore</option>
            <option value="material">Material esportivo</option>
            <option value="transporte">Transporte</option>
            <option value="administrativo">Administrativo</option>
            <option value="outros">Outros</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="expense-description">Descrição</label>
          <input id="expense-description" name="description" required maxLength={120} placeholder="Aluguel do campo — novembro" />
        </div>
        <div className="field">
          <label htmlFor="expense-amount">Valor</label>
          <input id="expense-amount" name="amount" required inputMode="decimal" placeholder="1.200,00" />
        </div>
        <div className="field">
          <label htmlFor="expense-due">Vencimento</label>
          <input id="expense-due" name="dueDate" type="date" required defaultValue={today} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="expense-supplier">Fornecedor (opcional)</label>
        <input id="expense-supplier" name="supplier" maxLength={80} placeholder="Arena Vila Nova" />
      </div>
      <button className="btn" disabled={pending}>
        {pending ? "Lançando…" : "Lançar despesa"}
      </button>
    </form>
  );
}

export function PixForm({
  defaultKey,
  defaultHolder,
  defaultCity,
}: {
  defaultKey: string;
  defaultHolder: string;
  defaultCity: string;
}) {
  const [state, action, pending] = useActionState(savePixSettings, initial);

  return (
    <form action={action}>
      <Feedback state={state} />
      <div className="field-row">
        <div className="field">
          <label htmlFor="pix-key">Chave Pix</label>
          <input id="pix-key" name="pixKey" required defaultValue={defaultKey} placeholder="CNPJ, e-mail, telefone ou chave aleatória" />
        </div>
        <div className="field">
          <label htmlFor="pix-holder">Titular da conta</label>
          <input id="pix-holder" name="pixHolder" required defaultValue={defaultHolder} maxLength={40} placeholder="Escola Teste Ltda" />
        </div>
        <div className="field">
          <label htmlFor="pix-city">Cidade</label>
          <input id="pix-city" name="pixCity" defaultValue={defaultCity} maxLength={15} placeholder="São Paulo" />
        </div>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        O dinheiro cai direto na conta da escola — a NextGen não intermedia. Cidade e titular vão no
        código Pix; acento é removido automaticamente porque o padrão só aceita ASCII.
      </p>
      <button className="btn" disabled={pending}>
        {pending ? "Salvando…" : "Salvar chave Pix"}
      </button>
    </form>
  );
}
