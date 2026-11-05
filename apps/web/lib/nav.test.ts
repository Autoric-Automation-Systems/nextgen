import { describe, expect, it } from "vitest";
import { navSectionsFor } from "./nav";

const labels = (viewer: Parameters<typeof navSectionsFor>[0]) =>
  navSectionsFor(viewer).map((section) => ({
    id: section.id,
    items: section.items.map((item) => item.label),
  }));

describe("navSectionsFor", () => {
  it("administração da escola vê as seções da escola, e não a da plataforma", () => {
    const sections = labels({ isPlatformAdmin: false, role: "admin" });

    expect(sections.map((section) => section.id)).toEqual(["escola"]);
    expect(sections[0]!.items).toContain("Financeiro");
    expect(sections[0]!.items).toContain("Site da escola");
  });

  it("professor não vê financeiro nem site da escola", () => {
    const items = labels({ isPlatformAdmin: false, role: "teacher" })[0]!.items;

    expect(items).toContain("Alunos");
    expect(items).not.toContain("Financeiro");
    expect(items).not.toContain("Site da escola");
  });

  it("responsável vê só a seção da família", () => {
    const sections = labels({ isPlatformAdmin: false, role: "guardian" });

    expect(sections.map((section) => section.id)).toEqual(["familia"]);
    expect(sections[0]!.items).toContain("Meus filhos");
  });

  it("administração da plataforma vê todas as seções", () => {
    const sections = labels({ isPlatformAdmin: true, role: null });

    expect(sections.map((section) => section.id)).toEqual(["escola", "familia", "plataforma"]);
    expect(sections[2]!.items).toContain("Escolas");
  });

  it("plataforma enxerga até a área da família, em leitura", () => {
    const family = labels({ isPlatformAdmin: true, role: null }).find(
      (section) => section.id === "familia",
    );

    // Suporte precisa reproduzir a tela que o responsável vê. Enxergar o item não dá
    // escrita: `resolveWorkspace` marca a visão sem vínculo como somente leitura.
    expect(family?.items).toContain("Meus filhos");
  });

  it("quem não tem papel não vê nada", () => {
    expect(navSectionsFor({ isPlatformAdmin: false, role: null })).toEqual([]);
  });

  it("itens planejados aparecem marcados como `soon`", () => {
    const soon = navSectionsFor({ isPlatformAdmin: false, role: "admin" })
      .flatMap((section) => section.items)
      .filter((item) => item.status === "soon")
      .map((item) => item.label);

    expect(soon).toContain("Financeiro");
    expect(soon).not.toContain("Painel");
  });
});
