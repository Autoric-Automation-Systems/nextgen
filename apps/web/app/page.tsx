import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooter } from "@/components/site-footer";
import { PlayerCard } from "@/components/player-card";

export const metadata: Metadata = {
  title: "NextGen — gestão para escolas de futebol",
  description:
    "Matrícula, turma, avaliação, saúde e mensalidade de escolas de futebol em um sistema só, com consentimento do responsável desde o primeiro cadastro.",
};

/**
 * A raiz responde uma pergunta: "é para mim?". Quem quer detalhe clica em "Como funciona";
 * quem já sabe o que quer escolhe a porta. Três parágrafos aqui empurram as duas portas
 * para baixo da dobra e não convencem ninguém.
 */
/**
 * Card de exemplo da chamada. Dado fictício, e escrito aqui — não vem do banco, para a
 * página inicial continuar estática e não depender de escola nenhuma existir.
 */
const SAMPLE_CARD = {
  nickname: "Tiaguinho",
  category: "Sub-13 · 2026",
  position: "Atacante",
  jerseyNumber: 11,
  age: 13,
  schoolName: "Escola Teste",
  cycleLabel: "2º ciclo",
  scores: [
    { code: "CTL", score: 4 },
    { code: "PAS", score: 4 },
    { code: "FIN", score: 5 },
    { code: "DRI", score: 5 },
    { code: "VEL", score: 5 },
    { code: "AGI", score: 4 },
    { code: "RES", score: 4 },
    { code: "FOR", score: 3 },
    { code: "POS", score: 4 },
    { code: "DEF", score: 2 },
    { code: "VIS", score: 4 },
    { code: "MOV", score: 5 },
    { code: "DIS", score: 4 },
    { code: "EQU", score: 4 },
    { code: "RESI", score: 3 },
    { code: "FOC", score: 4 },
  ],
  previousScores: [
    { code: "CTL", score: 4 },
    { code: "PAS", score: 4 },
    { code: "FIN", score: 4 },
    { code: "DRI", score: 4 },
    { code: "VEL", score: 4 },
    { code: "AGI", score: 4 },
    { code: "RES", score: 4 },
    { code: "FOR", score: 3 },
    { code: "POS", score: 4 },
    { code: "DEF", score: 2 },
    { code: "VIS", score: 4 },
    { code: "MOV", score: 4 },
    { code: "DIS", score: 4 },
    { code: "EQU", score: 4 },
    { code: "RESI", score: 3 },
    { code: "FOC", score: 4 },
  ],
  badges: 7,
  consentNote: "perfil autorizado pelo responsável",
};

export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Link href="/" className="brand" aria-label="NextGen — início">
            <BrandLogo height={26} />
          </Link>
          <nav className="nav">
            <Link href="/como-funciona">Como funciona</Link>
            <Link href="/login">Entrar</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="wrap hero-compact hero-split">
          <div>
            <span className="eyebrow">Escolas de futebol</span>
            <h1>A escola inteira em um lugar.</h1>
            <p className="lead">
              Matrícula, turma, categoria, avaliação, saúde e mensalidade. E o consentimento do
              responsável tratado como parte do sistema, não como anexo.
            </p>
            <div className="hero-actions">
              <Link className="btn" href="/como-funciona">
                Saiba mais
              </Link>
              <Link className="btn btn-ghost" href="/login">
                Já tenho acesso
              </Link>
            </div>
            <p className="muted hero-card-note">
              O card do aluno é o mesmo que o professor alimenta na avaliação. Acima de 12 anos ele
              mostra a nota; abaixo disso, só barras de evolução — comparar criança por número é
              competição entre pais, não formação.
            </p>
          </div>

          <figure className="hero-card">
            <PlayerCard data={SAMPLE_CARD} variant="public" />
            <figcaption>Exemplo de card: só técnico, físico e tático.</figcaption>
          </figure>
        </section>

        <section className="wrap" style={{ paddingBottom: 72 }}>
          <div className="grid grid-2">
            <article className="card door">
              <h3>Sou responsável</h3>
              <p>
                Acompanhe matrícula, boletos e a evolução do seu filho. O acesso é pelo
                e-mail que você cadastrou na escola — e é seu, não da criança.
              </p>
              <Link className="btn" href="/login">
                Entrar como responsável
              </Link>
            </article>

            <article className="card door">
              <h3>Sou administrador de escola</h3>
              <p>
                Matrícula, pedagogia, avaliação e financeiro sob o mesmo cadastro. Entre na
                escola que você já administra ou peça o cadastro da sua.
              </p>
              <div className="door-actions">
                <Link className="btn" href="/login">
                  Entrar
                </Link>
                {/* Direto no formulário: `/escola` existe para quem chega por link ou
                    busca, não para custar um toque a quem já decidiu. */}
                <Link className="btn btn-ghost" href="/escola/solicitar">
                  Cadastrar escola
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
