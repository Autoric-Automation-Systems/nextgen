"use client";

import { useActionState } from "react";
import { createLessonPlan, type PedagogyState } from "../pedagogia/actions";

const initial: PedagogyState = { status: "idle" };

const today = () => new Date().toISOString().slice(0, 10);

export function NewLessonPlanForm({ classes }: { classes: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createLessonPlan, initial);

  if (classes.length === 0) {
    return (
      <p className="notice">
        Você ainda não tem turma ativa. O plano de aula nasce de uma turma — abra a turma antes.
      </p>
    );
  }

  return (
    <form action={action}>
      {state.status !== "idle" ? (
        <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status">
          {state.message}
        </p>
      ) : null}

      <div className="field-row">
        <div className="field">
          <label htmlFor="plan-class">Turma</label>
          <select id="plan-class" name="classGroupId" required defaultValue={classes[0]?.id}>
            {classes.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="plan-date">Data da aula</label>
          <input id="plan-date" name="plannedFor" type="date" required defaultValue={today()} />
        </div>

        <div className="field">
          <label htmlFor="plan-duration">Duração (min)</label>
          <input
            id="plan-duration"
            name="durationMinutes"
            type="number"
            min={15}
            max={180}
            step={5}
            defaultValue={60}
            required
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="plan-title">Título</label>
        <input
          id="plan-title"
          name="title"
          required
          maxLength={120}
          placeholder="Passe e recepção sob pressão"
        />
      </div>

      <div className="field">
        <label htmlFor="plan-objective">Objetivo</label>
        <input
          id="plan-objective"
          name="objective"
          maxLength={300}
          placeholder="O aluno decide o passe antes de receber"
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="plan-warmup">Aquecimento</label>
          <textarea id="plan-warmup" name="warmup" rows={3} maxLength={2000} />
        </div>
        <div className="field">
          <label htmlFor="plan-main">Parte principal</label>
          <textarea id="plan-main" name="mainPart" rows={3} maxLength={2000} />
        </div>
        <div className="field">
          <label htmlFor="plan-game">Jogo</label>
          <textarea id="plan-game" name="gamePart" rows={3} maxLength={2000} />
        </div>
        <div className="field">
          <label htmlFor="plan-cooldown">Volta à calma</label>
          <textarea id="plan-cooldown" name="cooldown" rows={3} maxLength={2000} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="plan-notes">Observações (opcional)</label>
        <textarea id="plan-notes" name="notes" rows={2} maxLength={2000} />
      </div>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Criar plano"}
      </button>
    </form>
  );
}
