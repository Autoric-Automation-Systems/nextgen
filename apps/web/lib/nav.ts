import type { Role } from "@nextgen/core";
import type { ResolvedSession } from "@nextgen/auth";

/**
 * Mapa do menu, em dados.
 *
 * A regra "quem vê o quê" mora aqui, em uma função pura, e não espalhada em `if` dentro do
 * componente. Isso mantém o menu testável e evita o clássico: item escondido no HTML mas
 * rota aberta. Esconder item **não** autoriza nada — cada página continua checando o papel.
 */

export type NavItem = {
  href: string;
  label: string;
  /** Explica em uma linha o que a tela resolve. */
  hint?: string;
  /** Papéis de escola que enxergam o item. */
  roles: Role[];
  /** Visível para a administração da plataforma (em modo leitura). */
  platform?: boolean;
  /** `soon` = planejado; aparece apagado, sem link, para o mapa ficar honesto. */
  status?: "ready" | "soon";
  /** Destino fora do app: abre em outra aba e não passa pelo roteador do Next. */
  external?: boolean;
};

export type NavSection = {
  id: "escola" | "familia" | "plataforma" | "ajuda";
  title: string;
  items: NavItem[];
};

export const NAV: NavSection[] = [
  {
    id: "escola",
    title: "Escola",
    items: [
      { href: "/dashboard", label: "Painel", hint: "Visão do mês", roles: ["admin", "coordinator", "teacher"], platform: true },
      { href: "/alunos", label: "Alunos", hint: "Cadastro e matrícula", roles: ["admin", "coordinator", "teacher"], platform: true },
      { href: "/turmas", label: "Turmas", hint: "Categorias, horários e matrícula", roles: ["admin", "coordinator", "teacher"], platform: true },
      { href: "/avaliacao", label: "Avaliação", hint: "Ciclos, notas e card", roles: ["admin", "coordinator", "teacher"], platform: true, status: "soon" },
      { href: "/pedagogia", label: "Pedagogia", hint: "Matérias, capítulos e conteúdo", roles: ["admin", "coordinator", "teacher"], platform: true, status: "soon" },
      { href: "/financeiro", label: "Financeiro", hint: "Mensalidades, boletos e gastos", roles: ["admin"], platform: true },
      { href: "/site", label: "Site da escola", hint: "Página pública, logo e cores", roles: ["admin"], platform: true, status: "soon" },
    ],
  },
  {
    id: "familia",
    title: "Aluno e família",
    items: [
      { href: "/alunos", label: "Meus filhos", hint: "Matrícula, card e evolução", roles: ["guardian"] },
      { href: "/meus-boletos", label: "Mensalidades", hint: "Boletos e vencimentos", roles: ["guardian"] },
      { href: "/consentimentos", label: "Consentimentos", hint: "Imagem, saúde e o que você autorizou", roles: ["guardian"], status: "soon" },
    ],
  },
  {
    id: "plataforma",
    title: "Plataforma",
    items: [
      { href: "/sistema", label: "Escolas", hint: "Diretório da plataforma", roles: [], platform: true },
      { href: "/sistema/card", label: "Card do aluno", hint: "Revisão da versão interna e da pública", roles: [], platform: true },
      { href: "/sistema/email", label: "E-mail do acesso", hint: "Prévia do link mágico", roles: [], platform: true },
      { href: "/sistema/pedidos", label: "Pedidos de cadastro", hint: "Quem pediu para entrar", roles: [], platform: true, status: "soon" },
    ],
  },
  {
    id: "ajuda",
    title: "Ajuda",
    items: [
      // `roles` vazio de propósito: quem libera esta seção é a seção, não o papel.
      { href: "/ajuda", label: "Central de ajuda", hint: "Guias por perfil e perguntas frequentes", roles: [] },
      { href: "/como-funciona", label: "Como o NextGen funciona", hint: "Visão geral do produto", roles: [] },
      {
        href: "https://www.autoric.com.br",
        label: "Falar com a Autoric",
        hint: "Quem desenvolve o NextGen",
        roles: [],
        external: true,
      },
    ],
  },
];

export type NavViewer = Pick<ResolvedSession, "isPlatformAdmin"> & {
  role: Role | null;
};

/**
 * Plataforma enxerga todos os itens de todas as seções; qualquer outro vê só o que o seu
 * papel alcança. Ajuda é a exceção: fica visível para toda sessão, inclusive para quem
 * ficou sem vínculo — é justamente quem mais precisa saber a quem perguntar.
 *
 * Quem opera o SaaS precisa conseguir olhar a tela que a escola e a família veem — é assim
 * que se responde "o boleto não aparece para o responsável" sem pedir print. Enxergar o
 * menu não concede escrita: `resolveWorkspace` entrega essas telas em modo leitura quando
 * não há vínculo, e cada página continua checando o papel.
 */
export function navSectionsFor(viewer: NavViewer): NavSection[] {
  const isPlatform = viewer.isPlatformAdmin;

  return NAV.map((section) => {
    const items = section.items.filter((item) => {
      if (isPlatform) return true;
      if (section.id === "ajuda") return true;
      if (section.id === "plataforma") return false;
      return viewer.role !== null && item.roles.includes(viewer.role);
    });

    return { ...section, items };
  }).filter((section) => section.items.length > 0);
}
