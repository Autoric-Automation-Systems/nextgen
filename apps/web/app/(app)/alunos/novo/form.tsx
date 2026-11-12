"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { GUARDIAN_RELATIONS, POSITIONS } from "@/lib/student-form";
import { createStudent, type StudentState } from "./actions";

const initial: StudentState = { status: "idle" };

export type StudentFormOptions = {
  plans: { id: string; name: string; monthlyAmount: string }[];
  groups: { id: string; name: string }[];
};

export function StudentForm({ plans, groups }: StudentFormOptions) {
  const [state, action, pending] = useActionState(createStudent, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Cadastro concluído: limpa os campos para o irmão seguinte. Sem isso, um segundo clique
  // em "Cadastrar" reenvia o mesmo formulário e cria o aluno duas vezes.
  useEffect(() => {
    if (state.status === "ok") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="stack">
      {state.status !== "idle" ? (
        <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status">
          {state.message}
          {state.status === "ok" && state.studentId ? (
            <>
              {" "}
              <Link href={`/alunos/${state.studentId}`}>Abrir o card do aluno</Link>
            </>
          ) : null}
        </p>
      ) : null}

      <fieldset className="field-group">
        <legend>Aluno</legend>

        <div className="field-row">
          <div className="field">
            <label htmlFor="student-name">Nome completo</label>
            <input id="student-name" name="fullName" required maxLength={120} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="student-nick">Apelido no card</label>
            <input id="student-nick" name="nickname" maxLength={30} placeholder="Luquinhas" />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="student-birth">Nascimento</label>
            <input id="student-birth" name="birthDate" type="date" required />
          </div>
          <div className="field">
            <label htmlFor="student-position">Posição</label>
            <select id="student-position" name="position" defaultValue="">
              <option value="">Ainda não definida</option>
              {POSITIONS.map((position) => (
                <option key={position.value} value={position.value}>
                  {position.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="field-group">
        <legend>Responsável</legend>

        <p className="muted" style={{ marginTop: 0 }}>
          O aluno não tem login. É o responsável que entra, assina o termo de consentimento e
          recebe a cobrança — por isso o e-mail é obrigatório e precisa ser dele.
        </p>

        <div className="field-row">
          <div className="field">
            <label htmlFor="guardian-name">Nome</label>
            <input id="guardian-name" name="guardianName" required maxLength={120} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="guardian-email">E-mail</label>
            <input id="guardian-email" name="guardianEmail" type="email" required autoComplete="off" />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="guardian-phone">Telefone</label>
            <input id="guardian-phone" name="guardianPhone" inputMode="tel" placeholder="+55 11 98888-7777" />
          </div>
          <div className="field">
            <label htmlFor="guardian-relation">Parentesco</label>
            <select id="guardian-relation" name="relation" defaultValue="mother">
              {GUARDIAN_RELATIONS.map((relation) => (
                <option key={relation.value} value={relation.value}>
                  {relation.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="field-group">
        <legend>Turma e mensalidade</legend>

        <div className="field-row">
          <div className="field">
            <label htmlFor="student-group">Turma</label>
            <select id="student-group" name="classGroupId" defaultValue="">
              <option value="">Matricular depois</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="student-plan">Plano</label>
            <select id="student-plan" name="tuitionPlanId" defaultValue="">
              <option value="">Definir depois</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {plan.monthlyAmount}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="student-due">Dia de vencimento</label>
            <input id="student-due" name="dueDay" type="number" min={1} max={31} defaultValue={10} required />
          </div>
        </div>

        <p className="muted" style={{ marginTop: 0 }}>
          O dia é a escolha do responsável, aluno por aluno. A mensalidade é gerada e enviada
          cinco dias antes, por PIX no e-mail dele. Dia 31 em fevereiro vence no último dia do mês.
        </p>
      </fieldset>

      <p className="muted" style={{ marginTop: 0 }}>
        Sem o termo de consentimento assinado, a matrícula fica em rascunho: o aluno aparece
        na turma, mas nada é liberado ao responsável.
      </p>

      <button className="btn" disabled={pending}>
        {pending ? "Cadastrando…" : "Cadastrar aluno"}
      </button>
    </form>
  );
}
