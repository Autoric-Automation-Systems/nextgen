import Link from "next/link";

const pillars = [
  {
    title: "Aluno no centro, não no banco",
    body: "Matrícula, turma, categoria e responsável em um cadastro só. Categoria derivada do ano de nascimento, sem conflito no meio da temporada.",
  },
  {
    title: "Consentimento com prova",
    body: "Responsável recebe o e-mail, assina o termo versionado e o sistema guarda hash, IP e data. Revogar é um clique e vale imediatamente.",
  },
  {
    title: "Avaliação que vira card",
    body: "Notas por pilar, evolução por temporada e um perfil público bonito — desligado por padrão e nunca para menor de 12.",
  },
  {
    title: "Financeiro que fecha",
    body: "Mensalidade com vencimento escolhido no cadastro, boleto no e-mail do responsável, inadimplência visível no painel.",
  },
];

export default function Home() {
  return (
    <main>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <div className="brand">
            <span className="brand-mark">NG</span>
            NextGen
          </div>
          <nav className="nav">
            <Link href="/login">Entrar</Link>
          </nav>
        </div>
      </header>

      <section className="wrap hero">
        <span className="eyebrow">Escolas de futebol</span>
        <h1>
          A escola inteira em um lugar.
          <br />
          A criança protegida em primeiro.
        </h1>
        <p className="lead">
          O NextGen junta matrícula, pedagogia, avaliação de habilidades, saúde e financeiro. E resolve o
          ponto que todo mundo empurra com a barriga: aluno menor de idade, consentimento do responsável
          e dado sensível tratados como o resto do sistema depende deles.
        </p>
        <Link className="btn" href="/login">
          Entrar no painel
        </Link>
        <p className="muted" style={{ marginTop: 16 }}>
          Ambiente de desenvolvimento. O acesso é por link mágico enviado ao e-mail cadastrado.
        </p>
      </section>

      <section className="wrap" style={{ paddingBottom: 72 }}>
        <div className="grid grid-3">
          {pillars.map((pillar) => (
            <article className="card" key={pillar.title}>
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
