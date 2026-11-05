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
};

export type NavSection = {
  id: "escola" | "familia" | "plataforma";
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
      { href: "/turmas", label: "Turmas", hint: "Categorias e horários", roles: ["admin", "coordinator", "teacher"], platform: true, status: "soon" },
      { href: "/pedagogia", label: "Pedagogia", hint: "Matérias, capítulos e conteúdo", roles: ["admin", "coordinator", "teacher"], platform: true, status: "soon" },
      { href: "/avaliacao", label: "Avaliação", hint: "Ciclos, notas e card", roles: ["admin", "coordinator", "teacher"], platform: true, status: "soon" },
      { href: "/financeiro", label: "Financeiro", hint: "Mensalidades, boletos e gastos", roles: ["admin"], platform: true, status: "soon" },
      { href: "/site", label: "Site da escola", hint: "Página pública, logo e cores", roles: ["admin"], platform: true, status: "soon" },
    ],
  },
  {
    id: "familia",
    title: "Aluno e família",
    items: [
      { href: "/alunos", label: "Meus filhos", hint: "Matrícula, card e evolução", roles: ["guardian"] },
      { href: "/meus-boletos", label: "Mensalidades", hint: "Boletos e vencimentos", roles: ["guardian"], status: "soon" },
      { href: "/consentimentos", label: "Consentimentos", hint: "Imagem, saúde e o que você autorizou", roles: ["guardian"], status: "soon" },
    ],
  },
  {
    id: "plataforma",
    title: "Plataforma",
    items: [
      { href: "/sistema", label: "Escolas", hint: "Diretório da plataforma", roles: [], platform: true },
      { href: "/sistema/card", label: "Card do aluno", hint: "Revisão da versão interna e da pública", roles: [], platform: true },
      { href: "/sistema/pedidos", label: "Pedidos de cadastro", hint: "Quem pediu para entrar", roles: [], platform: true, status: "soon" },
    ],
  },
];

export type NavViewer = Pick<ResolvedSession, "isPlatformAdmin"> & {
  role: Role | null;
};

/**
 * Plataforma enxerga as três seções; qualquer outro vê só a seção do seu papel.
 *
 * A restrição é por seção, e não por item, de propósito: a administração da plataforma
 * precisa da visão completa para dar suporte, mas o item "Financeiro" continua existindo
 * porque ela verá a tela — não porque ganhou permissão de escrita nela.
 */
export function navSectionsFor(viewer: NavViewer): NavSection[] {
  const isPlatform = viewer.isPlatformAdmin;

  return NAV.map((section) => {
    const items = section.items.filter((item) => {
      if (section.id === "plataforma") return isPlatform;
      if (isPlatform) return item.platform === true;
      return viewer.role !== null && item.roles.includes(viewer.role);
    });

    return { ...section, items };
  }).filter((section) => section.items.length > 0);
}
