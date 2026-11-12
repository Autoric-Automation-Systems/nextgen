import { PILLARS, SKILLS, canShowCardRating, cardRating, type Pillar, type Score } from "@nextgen/core";

/**
 * Card do aluno no estilo de jogo, dentro das regras do doc 08 §6.
 *
 * Duas regras não são estilo, são política:
 * - abaixo de 12 anos **não existe nota**: o card mostra barras e a idade, nunca um "OVR".
 *   Um "62" numa criança de 9 anos vira ranking entre pais;
 * - comportamento (DIS, EQU, RESI, FOC) nunca aparece em superfície pública — na variante
 *   `public` o pilar é simplesmente omitido.
 *
 * O componente não busca dado: recebe pronto. O mesmo card serve painel, responsável e
 * página pública, com a mesma aparência e a mesma regra.
 */

export type PlayerCardData = {
  nickname: string;
  /** Nome da turma do aluno; a escola escolhe o rótulo. */
  team: string | null;
  position: string | null;
  jerseyNumber: number | null;
  age: number;
  schoolName: string;
  cycleLabel: string;
  /** Notas do ciclo atual, escala 1–5. */
  scores: Score[];
  /** Notas do ciclo anterior, para a variação. */
  previousScores?: Score[];
  badges?: number;
  consentNote?: string | null;
  accent?: string;
  /**
   * Retrato do aluno. Sem ele o card cai na inicial do apelido — nunca num espaço vazio,
   * porque um card "quebrado" parece aluno sem cadastro.
   */
  photo?: { src: string; alt: string };
};

const PILLAR_ORDER: Pillar[] = ["technical", "physical", "tactical", "behavioral"];
const PRIVATE_PILLAR: Pillar = "behavioral";

function averageOf(scores: Score[], pillar: Pillar): number | null {
  const entries = scores.filter((entry) => SKILLS.find((skill) => skill.code === entry.code)?.pillar === pillar);
  if (entries.length === 0) return null;
  return entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length;
}

export function PlayerCard({
  data,
  variant = "internal",
}: {
  data: PlayerCardData;
  variant?: "internal" | "public";
}) {
  const showNumbers = canShowCardRating(data.age);
  const pillars = variant === "public" ? PILLAR_ORDER.filter((pillar) => pillar !== PRIVATE_PILLAR) : PILLAR_ORDER;
  const skills = variant === "public" ? SKILLS.filter((skill) => skill.pillar !== PRIVATE_PILLAR) : SKILLS;

  const overall = cardRating(data.scores);
  const previous = data.previousScores?.length ? cardRating(data.previousScores) : null;
  const improvement = previous !== null && overall !== null ? overall - previous : null;

  return (
    <figure className="player-card" style={{ ["--card-accent" as string]: data.accent ?? "var(--accent)" }}>
      <header className="player-card-top">
        <span className="player-card-cat">{data.team ?? "Sem turma"}</span>
        <span className="player-card-cycle">{data.cycleLabel}</span>
      </header>

      <div className="player-card-id">
        <div className="player-card-photo" aria-hidden={data.photo ? undefined : true}>
          {data.photo ? (
            <img src={data.photo.src} alt={data.photo.alt} width={60} height={60} decoding="async" />
          ) : (
            data.nickname.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="player-card-name">
          <strong>{data.nickname}</strong>
          <span>
            {data.position ?? "—"}
            {data.jerseyNumber ? ` · #${data.jerseyNumber}` : ""}
          </span>
          {data.badges ? <span className="player-card-badges">★ {data.badges}</span> : null}
        </div>
        <div className={showNumbers && overall !== null ? "player-card-ovr" : "player-card-ovr is-age"}>
          <strong>{showNumbers && overall !== null ? overall : data.age}</strong>
          <span>{showNumbers && overall !== null ? "OVR" : "anos"}</span>
        </div>
      </div>

      <ul className="player-card-bars">
        {pillars.map((pillar) => {
          const average = averageOf(data.scores, pillar);
          const pct = average === null ? 0 : (average / 5) * 100;

          return (
            <li key={pillar}>
              <span className="player-card-bar-label">{PILLARS[pillar].short}</span>
              <span className="player-card-bar">
                <span style={{ width: `${pct}%` }} />
              </span>
              {showNumbers && average !== null ? <span className="player-card-bar-num">{average.toFixed(1)}</span> : null}
            </li>
          );
        })}
      </ul>

      {/* Abaixo de 12 o card não tem nota — nem a geral, nem por fundamento. Em vez de
          doze "·" que parecem dado faltando, o card diz o motivo. */}
      {showNumbers ? (
        <dl className="player-card-grid">
          {skills.map((skill) => {
            const entry = data.scores.find((score) => score.code === skill.code);
            return (
              <div key={skill.code}>
                <dt>{skill.code}</dt>
                <dd>{entry ? entry.score : "—"}</dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="player-card-locked">Sem nota até os 12 anos · evolução só pelas barras</p>
      )}

      {showNumbers && improvement ? (
        <p className="player-card-delta">
          <strong>{improvement > 0 ? `↑ +${improvement}` : `↓ ${improvement}`}</strong> desde o ciclo anterior
        </p>
      ) : null}

      <footer className="player-card-foot">
        <span>{data.schoolName}</span>
        {data.consentNote ? <span className="player-card-seal">✓ {data.consentNote}</span> : null}
      </footer>
    </figure>
  );
}
