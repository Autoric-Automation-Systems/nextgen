import Link from "next/link";
import { addCompetences, competenceLabel } from "@nextgen/core";
import { currentCompetence } from "@/lib/billing";

export const STATE_LABEL = {
  paga: "Paga",
  aberta: "Em aberto",
  vencida: "Vencida",
  cancelada: "Cancelada",
} as const;

export const STATE_BADGE = {
  paga: "badge",
  aberta: "badge neutral",
  vencida: "badge danger",
  cancelada: "badge neutral",
} as const;

/**
 * Navegação de competência.
 *
 * `base` existe porque cada seção recarrega a própria rota com `?mes=`; perder a seção ao
 * trocar de mês obrigaria a pessoa a navegar de novo.
 */
export function CompetenceNav({ competence, base }: { competence: string; base: string }) {
  const previous = addCompetences(competence, -1);
  const next = addCompetences(competence, 1);

  return (
    <div className="checks" style={{ gap: 8 }}>
      <Link className="btn btn-ghost" href={`${base}?mes=${previous}`} aria-label={`Mês anterior, ${competenceLabel(previous)}`}>
        ← {competenceLabel(previous)}
      </Link>
      <Link className="btn btn-ghost" href={`${base}?mes=${currentCompetence()}`}>
        Mês atual
      </Link>
      <Link className="btn btn-ghost" href={`${base}?mes=${next}`} aria-label={`Próximo mês, ${competenceLabel(next)}`}>
        {competenceLabel(next)} →
      </Link>
    </div>
  );
}

/**
 * Mesma mensagem do layout. A página precisa devolvê-la em vez de redirecionar para
 * `/financeiro`: o layout é quem barra o acesso, e um `redirect` aqui viraria laço.
 */
export function FinanceDenied() {
  return (
    <p className="muted">
      O financeiro é da administração da escola. Se você é responsável, suas mensalidades ficam
      em <Link href="/meus-boletos">Mensalidades</Link>.
    </p>
  );
}
