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

  it("administração da plataforma vê as três seções", () => {
    const sections = labels({ isPlatformAdmin: true, role: null });

    expect(sections.map((section) => section.id)).toEqual(["escola", "plataforma"]);
    expect(sections[1]!.items).toContain("Escolas");
  });

  it("plataforma sem vínculo não ganha a seção da família", () => {
    const sections = labels({ isPlatformAdmin: true, role: null });

    // A seção da família é do responsável. Plataforma vê a escola em leitura, não a
    // área pessoal de um responsável que ela não é.
    expect(sections.map((section) => section.id)).not.toContain("familia");
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
