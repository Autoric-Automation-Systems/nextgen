import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooter } from "@/components/site-footer";

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
        <section className="wrap hero-compact">
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
