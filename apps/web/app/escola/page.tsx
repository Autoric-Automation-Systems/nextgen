import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Para escolas — NextGen",
  description: "Entre na escola que você administra ou peça o cadastro da sua.",
};

/**
 * Porta de entrada da escola.
 *
 * Login é o mesmo da família — um mecanismo só, e-mail com link. O que muda é o público e
 * a expectativa de quem chega: quem administra quer criar escola, cadastrar turma e
 * fechar o mês; quem é responsável quer o boleto e a evolução do filho.
 */
export default function EscolaPage() {
  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <a href="/" className="brand" aria-label="NextGen — início">
            <BrandLogo height={26} />
          </a>
          <nav className="nav">
            <a href="/como-funciona">Como funciona</a>
            <a href="/login">Entrar</a>
          </nav>
        </div>
      </header>

      <main className="wrap" style={{ padding: "56px 24px 72px" }}>
        <span className="eyebrow">Para escolas</span>
        <h1 style={{ maxWidth: 680 }}>
          Você administra uma escola de futebol?
        </h1>
        <p className="lead">
          Matrícula, turma, categoria, avaliação, saúde e mensalidade no mesmo lugar — com o
          consentimento do responsável registrado desde o primeiro cadastro.
        </p>

        <div className="grid grid-2" style={{ marginTop: 8 }}>
          <section className="card door">
            <h3>Já tenho acesso</h3>
            <p>
              Entre com o e-mail que a escola cadastrou. O link chega na hora e vale 15
              minutos.
            </p>
            <a className="btn" href="/login">
              Entrar
            </a>
          </section>

          <section className="card door">
            <h3>Ainda não tenho cadastro</h3>
            <p>
              O cadastro é feito por nós: você informa os dados da escola e recebe o convite
              para criar o acesso de administração.
            </p>
            <a className="btn btn-ghost" href="/escola/solicitar">
              Cadastrar minha escola
            </a>
          </section>
        </div>

        <p className="muted" style={{ marginTop: 28, maxWidth: 640 }}>
          Por que não é automático: a escola é quem responde pelos dados dos alunos. Criar
          uma escola é criar um controlador de dados — fecha contrato, define quem acessa o
          quê e só então libera o cadastro de menores.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
