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

    expect(sections.map((section) => section.id)).toEqual(["escola", "ajuda"]);
    expect(sections[0]!.items).toContain("Financeiro");
    expect(sections[0]!.items).toContain("Site da escola");
  });

  it("professor não vê financeiro nem site da escola", () => {
    const items = labels({ isPlatformAdmin: false, role: "teacher" })[0]!.items;

    expect(items).toContain("Alunos");
    expect(items).not.toContain("Financeiro");
    expect(items).not.toContain("Site da escola");
  });

  it("responsável vê a seção da família e a Ajuda", () => {
    const sections = labels({ isPlatformAdmin: false, role: "guardian" });

    expect(sections.map((section) => section.id)).toEqual(["familia", "ajuda"]);
    expect(sections[0]!.items).toContain("Meus filhos");
  });

  it("administração da plataforma vê todas as seções", () => {
    const sections = labels({ isPlatformAdmin: true, role: null });

    expect(sections.map((section) => section.id)).toEqual(["escola", "familia", "plataforma", "ajuda"]);
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

  it("quem não tem papel vê só a Ajuda, que é para onde ele precisa ir", () => {
    const sections = labels({ isPlatformAdmin: false, role: null });

    expect(sections.map((section) => section.id)).toEqual(["ajuda"]);
    expect(sections[0]!.items).toContain("Central de ajuda");
  });

  it("a Ajuda fecha o menu, depois das seções de trabalho", () => {
    const ids = labels({ isPlatformAdmin: false, role: "admin" }).map((section) => section.id);

    expect(ids.at(-1)).toBe("ajuda");
  });

  it("a Ajuda aparece para o responsável", () => {
    const ids = labels({ isPlatformAdmin: false, role: "guardian" }).map((section) => section.id);

    expect(ids).toEqual(["familia", "ajuda"]);
  });

  it("itens planejados aparecem marcados como `soon`", () => {
    const soon = navSectionsFor({ isPlatformAdmin: false, role: "admin" })
      .flatMap((section) => section.items)
      .filter((item) => item.status === "soon")
      .map((item) => item.label);

    expect(soon).toContain("Avaliação");
    expect(soon).not.toContain("Painel");
  });

  it("pedagogia e planos de aula já estão liberados", () => {
    const items = navSectionsFor({ isPlatformAdmin: false, role: "teacher" }).flatMap(
      (section) => section.items,
    );

    expect(items.find((item) => item.href === "/pedagogia")?.status).toBeUndefined();
    expect(items.find((item) => item.href === "/aulas")?.status).toBeUndefined();
  });

  it("financeiro e mensalidades já estão liberados", () => {
    const admin = navSectionsFor({ isPlatformAdmin: false, role: "admin" })
      .flatMap((section) => section.items)
      .find((item) => item.label === "Financeiro");
    const guardian = navSectionsFor({ isPlatformAdmin: false, role: "guardian" })
      .flatMap((section) => section.items)
      .find((item) => item.label === "Mensalidades");

    expect(admin?.status).toBeUndefined();
    expect(admin?.href).toBe("/financeiro");
    expect(guardian?.status).toBeUndefined();
    expect(guardian?.href).toBe("/meus-boletos");
  });
});

describe("menu depois do consentimento e da equipe", () => {
  const items = (viewer: Parameters<typeof navSectionsFor>[0]) =>
    navSectionsFor(viewer).flatMap((section) => section.items);

  it("responsável alcança os consentimentos, e a tela não está mais marcada como futura", () => {
    const item = items({ isPlatformAdmin: false, role: "guardian" }).find((entry) => entry.href === "/consentimentos");

    expect(item?.label).toBe("Consentimentos");
    expect(item?.status).toBeUndefined();
  });

  it("administração vê a equipe e as pendências de consentimento; professor não", () => {
    const admin = items({ isPlatformAdmin: false, role: "admin" }).map((entry) => entry.href);
    const teacher = items({ isPlatformAdmin: false, role: "teacher" }).map((entry) => entry.href);

    expect(admin).toContain("/equipe");
    expect(admin).toContain("/consentimentos");
    expect(teacher).not.toContain("/equipe");
    expect(teacher).not.toContain("/consentimentos");
  });
});
