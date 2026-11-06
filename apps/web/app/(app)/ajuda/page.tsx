import type { Metadata } from "next";
import Link from "next/link";
import { DEV_CREDIT } from "@/lib/brand";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";

export const metadata: Metadata = {
  title: "Ajuda — NextGen",
  description: "Guias por perfil, regras de consentimento e perguntas frequentes do NextGen.",
};

type Guide = {
  title: string;
  who: string;
  steps: { label: string; href?: string }[];
};

/**
 * Guia do primeiro dia, por perfil.
 *
 * Cada passo aponta para uma tela que já existe. O que ainda não existe aparece sem link,
 * marcado como "em breve": prometer caminho que não abre é pior do que dizer que falta.
 */
const GUIDES: Record<string, Guide> = {
  admin: {
    title: "Administração da escola",
    who: "Você cadastra alunos, professores e o site da escola.",
    steps: [
      { label: "Veja os números do mês no Painel", href: "/dashboard" },
      { label: "Cadastre o aluno e o responsável", href: "/alunos" },
      { label: "Abra o card de um aluno e compare com a versão pública" },
      { label: "Turmas, pedagogia, avaliação e financeiro entram em breve" },
    ],
  },
  coordinator: {
    title: "Coordenação",
    who: "Você acompanha alunos e avaliações da escola.",
    steps: [
      { label: "Veja os números do mês no Painel", href: "/dashboard" },
      { label: "Consulte os alunos matriculados", href: "/alunos" },
      { label: "Avaliação por ciclo entra em breve" },
    ],
  },
  teacher: {
    title: "Professor",
    who: "Você acompanha as turmas e alimenta a avaliação.",
    steps: [
      { label: "Veja os alunos das suas turmas", href: "/alunos" },
      { label: "Abra o card do aluno para conferir o que ele mostra" },
      { label: "Lançar notas por ciclo entra em breve" },
    ],
  },
  guardian: {
    title: "Responsável",
    who: "Você acompanha a matrícula, os consentimentos e a evolução do seu filho.",
    steps: [
      { label: "Veja os filhos vinculados à sua conta", href: "/alunos" },
      { label: "Confira o card de evolução de cada um" },
      { label: "Consentimentos e mensalidades entram em breve" },
    ],
  },
  platform_support: {
    title: "Plataforma",
    who: "Você opera o NextGen e atende as escolas.",
    steps: [
      { label: "Abra o diretório de escolas", href: "/sistema" },
      { label: "Revise o card na versão interna e na pública", href: "/sistema/card" },
      { label: "Fila de pedidos de cadastro entra em breve" },
    ],
  },
};

const FAQ: { title: string; items: { q: string; a: React.ReactNode }[] }[] = [
  {
    title: "Acesso e login",
    items: [
      {
        q: "Como eu entro no NextGen?",
        a: (
          <>
            Você informa o e-mail em <Link href="/login">/login</Link> e recebe um link de
            acesso. Não existe senha para vazar, e o link vale 15 minutos, uma vez. O mesmo
            formulário serve para todo mundo: o sistema descobre se você é responsável,
            professor, coordenação, administração da escola ou da plataforma, e abre o menu do
            seu grupo.
          </>
        ),
      },
      {
        q: "Meu e-mail não é reconhecido. Por quê?",
        a: (
          <>
            Quem cria acesso é a escola, não o site. Se o seu e-mail ainda não está no cadastro
            dela, peça à secretaria para incluir — não existe auto-cadastro. Isso é proposital:
            um sistema com dado de criança não pode aceitar qualquer conta que apareça.
          </>
        ),
      },
      {
        q: "O link não chegou.",
        a: (
          <>
            Confira a caixa de spam e se o endereço é exatamente o que a escola cadastrou. O
            link é de uso único: se você já clicou uma vez, peça outro. Se continuar sem
            chegar, a escola consegue confirmar qual e-mail está no seu cadastro.
          </>
        ),
      },
      {
        q: "Quem vê o quê?",
        a: (
          <>
            Responsável vê os próprios filhos. Professor vê as turmas e os alunos da escola.
            Administração vê a escola inteira, inclusive o financeiro. Quem opera a plataforma
            vê todas as telas, em modo leitura quando não tem vínculo com a escola. Item
            escondido no menu não é o que protege o dado: cada tela confere o papel no servidor.
          </>
        ),
      },
    ],
  },
  {
    title: "Aluno, consentimento e LGPD",
    items: [
      {
        q: "Meu filho tem login próprio?",
        a: (
          <>
            Não antes dos 16 anos. O aluno é um perfil tutelado: quem autentica é o responsável
            legal, e o card do aluno é o que a escola publica — não uma conta da criança. Dos
            16 aos 17 anos a conta própria existe, com o responsável ainda acompanhando.
          </>
        ),
      },
      {
        q: "Para que serve o termo de consentimento?",
        a: (
          <>
            Cada finalidade — matrícula, saúde, imagem, card público — tem o seu consentimento,
            versionado e assinado pelo responsável. O sistema guarda a versão do texto, a data,
            o IP e um hash. Sem o termo de matrícula o aluno fica em rascunho: conteúdo,
            avaliação e card não ficam disponíveis antes disso.
          </>
        ),
      },
      {
        q: "Posso revogar o uso da imagem depois?",
        a: (
          <>
            Sim, e vale na hora. A revogação entra como um novo registro — o histórico não é
            apagado, porque provar o que foi autorizado e quando também é obrigação legal.
            Peça à escola enquanto a tela de consentimentos do responsável não está no ar.
          </>
        ),
      },
    ],
  },
  {
    title: "Avaliação e card",
    items: [
      {
        q: "Por que o card do meu filho não mostra nota?",
        a: (
          <>
            Abaixo de 12 anos não existe nota geral (OVR): o card mostra a idade, as barras por
            pilar e a evolução do ciclo. Um número numa criança de 9 anos vira ranking entre
            pais, e ranking entre pais não forma jogador. Acima de 12, a nota aparece.
          </>
        ),
      },
      {
        q: "O que exatamente aparece no card público?",
        a: (
          <>
            Só o que o responsável autorizou: apelido, categoria, posição e os pilares técnico,
            físico e tático. Comportamento (disciplina, foco, resiliência) nunca aparece em
            superfície pública — é conversa entre escola e família. O card público é desligado
            por padrão e exige consentimento de imagem e de card público.
          </>
        ),
      },
    ],
  },
  {
    title: "Financeiro",
    items: [
      {
        q: "Onde vejo os boletos?",
        a: (
          <>
            O módulo financeiro — mensalidade por boleto no e-mail do responsável, vencimento
            escolhido no cadastro, gastos da escola e balanço do mês — ainda está em
            desenvolvimento e aparece apagado como &ldquo;em breve&rdquo; no menu. Enquanto
            isso, a cobrança continua pelo canal que a escola já usa.
          </>
        ),
      },
    ],
  },
];

export default async function HelpPage() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  const guide =
    GUIDES[workspace?.role ?? (session.isPlatformAdmin ? "platform_support" : "")] ?? GUIDES.guardian!;

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>Ajuda</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 720 }}>
          Três caminhos: usar o sistema, entender as regras de consentimento ou falar com
          alguém. O que está marcado &ldquo;em breve&rdquo; no menu ainda não pode ser usado —
          esta página não promete tela que não abre.
        </p>
      </div>

      <section className="card">
        <span className="badge">Seu perfil</span>
        <h2 className="section-title" style={{ margin: "10px 0 4px" }}>{guide.title}</h2>
        <p className="muted" style={{ margin: 0 }}>{guide.who}</p>
        <ol className="help-steps">
          {guide.steps.map((step) => (
            <li key={step.label}>
              {step.href ? <Link href={step.href}>{step.label}</Link> : <span>{step.label}</span>}
            </li>
          ))}
        </ol>
      </section>

      {FAQ.map((group) => (
        <section key={group.title} className="stack" style={{ gap: 10 }}>
          <h2 className="section-title">{group.title}</h2>
          <div className="faq">
            {group.items.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}

      <section className="grid grid-2">
        <article className="card">
          <h3>Falar com a escola</h3>
          <p>
            Matrícula, dados cadastrais, cobrança e autorizações passam pela secretaria
            {workspace?.schoolName ? ` de ${workspace.schoolName}` : " da escola"}. É quem
            corrige o cadastro e registra a sua autorização — o NextGen não altera isso por
            você.
          </p>
        </article>

        <article className="card">
          <h3>Falar com a Autoric</h3>
          <p>
            Erro no sistema, tela em branco, sugestão de melhoria: o canal é o site da Autoric,
            que desenvolve o NextGen.
          </p>
          <a
            className="btn btn-ghost"
            href={DEV_CREDIT.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginTop: 12 }}
          >
            Abrir {DEV_CREDIT.name}
          </a>
        </article>
      </section>
    </div>
  );
}
