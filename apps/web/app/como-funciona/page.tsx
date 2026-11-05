import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Como funciona — NextGen",
  description:
    "Matrícula, pedagogia, avaliação de habilidades, saúde e financeiro de uma escola de futebol, do cadastro do aluno à mensalidade do mês.",
};

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

const modules = [
  ["Matrícula e turma", "Escola, unidade, sala, categoria (Sub-8, Sub-9…), turma e horário. Vaga e lista de espera por turma."],
  ["Pessoas", "Responsável legal, aluno, professores e quem pode buscar a criança na saída."],
  ["Pedagogia", "Matérias, capítulos, vídeos, áudios, imagens e PDF. Plano de aula por professor e turma."],
  ["Avaliação", "16 atributos em quatro pilares — técnico, físico, tático e comportamental — com histórico por temporada."],
  ["Saúde", "Anamnese inicial, atualizações periódicas, restrições e contato de emergência. Acesso restrito."],
  ["Financeiro", "Mensalidade, vencimento, boleto, baixa de pagamento, despesas e balanço do mês."],
  ["Site da escola", "Página pública com logo, paleta, frase e endereço. Perfil de aluno é opt-in do responsável."],
];

export default function ComoFuncionaPage() {
  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Link href="/" className="brand" aria-label="NextGen — início">
            <BrandLogo height={26} />
          </Link>
          <nav className="nav">
            <Link href="/escola">Para escolas</Link>
            <Link href="/login">Entrar</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="wrap hero">
          <span className="eyebrow">Como funciona</span>
          <h1>
            A escola inteira em um lugar.
            <br />
            A criança protegida em primeiro.
          </h1>
          <p className="lead">
            O NextGen junta matrícula, pedagogia, avaliação de habilidades, saúde e
            financeiro. E resolve o ponto que todo mundo empurra com a barriga: aluno menor de
            idade, consentimento do responsável e dado sensível tratados como aquilo de que o
            resto do sistema depende.
          </p>
          <div className="hero-actions">
            <Link className="btn" href="/escola/solicitar">
              Cadastrar minha escola
            </Link>
            <Link className="btn btn-ghost" href="/login">
              Já tenho acesso
            </Link>
          </div>
        </section>

        <section className="wrap" style={{ paddingBottom: 48 }}>
          <div className="grid grid-3">
            {pillars.map((pillar) => (
              <article className="card" key={pillar.title}>
                <h3>{pillar.title}</h3>
                <p>{pillar.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="wrap" style={{ paddingBottom: 56 }}>
          <h2 className="section-title" style={{ marginBottom: 6 }}>
            O que tem dentro
          </h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 20, maxWidth: 640 }}>
            Um módulo por assunto, todos no mesmo cadastro de aluno. Nada de planilha paralela
            nem exportação de um sistema para outro.
          </p>
          <div className="grid grid-3">
            {modules.map(([title, body]) => (
              <article className="card" key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="wrap" style={{ paddingBottom: 56 }}>
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 10 }}>
              Menor de idade não é usuário do sistema
            </h2>
            <p style={{ marginTop: 0 }}>
              O aluno é um <strong>perfil tutelado</strong>: quem tem conta é o responsável
              legal. Não existe login para criança, não existe senha de aluno e não existe
              foto pública sem autorização específica. Abaixo de 16 anos, nenhum acesso
              próprio — o dado é do responsável, e é ele quem responde por ele.
            </p>
            <p className="muted" style={{ marginBottom: 0 }}>
              Cada finalidade de uso tem o seu consentimento: matrícula, imagem, avaliação
              publicada e comunicação. Revogar uma não derruba as outras, e todas ficam
              registradas com versão do termo, data e origem.
            </p>
          </div>
        </section>

        <section className="wrap" style={{ paddingBottom: 72 }}>
          <div className="card door">
            <h3>Comece pela sua escola</h3>
            <p>
              Contamos a estrutura e o NextGen entra no ar com os dados que você já tem:
              alunos, turmas, responsáveis e mensalidades.
            </p>
            <div className="door-actions">
              <Link className="btn" href="/escola/solicitar">
                Pedir cadastro
              </Link>
              <Link className="btn btn-ghost" href="/escola">
                Já tenho acesso
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
