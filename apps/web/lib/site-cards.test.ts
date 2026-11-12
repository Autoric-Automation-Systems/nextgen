import { existsSync } from "node:fs";
import path from "node:path";
import { canShowCardRating } from "@nextgen/core";
import { describe, expect, it } from "vitest";
import { SHOWCASE_CARDS } from "./site-cards";

const publicDir = path.join(__dirname, "..", "public");

describe("vitrine da página inicial", () => {
  it("todo retrato aponta para um arquivo existente", () => {
    for (const item of SHOWCASE_CARDS) {
      const file = path.join(publicDir, item.portrait.src.replace(/^\//, ""));
      expect(existsSync(file), item.portrait.src).toBe(true);
    }
  });

  /**
   * A regra que o produto cobra da escola vale para a peça de venda: foto de menor só com
   * liberação identificada. Sem isso, alguém troca a ilustração por uma foto "achada na
   * internet" e o site passa a fazer exatamente o que o contrato proíbe.
   */
  it("foto de pessoa real exige liberação registrada e crédito", () => {
    for (const item of SHOWCASE_CARDS) {
      if (item.portrait.kind !== "photo") continue;
      expect(item.portrait.release?.guardian, item.portrait.src).toBeTruthy();
      expect(item.portrait.release?.term, item.portrait.src).toBeTruthy();
      expect(item.portrait.release?.grantedOn, item.portrait.src).toBeTruthy();
      expect(item.portrait.credit, item.portrait.src).toBeTruthy();
    }
  });

  it("o card mostra nota acima de 12 e barras abaixo", () => {
    const ages = SHOWCASE_CARDS.map((item) => item.data.age);
    expect(ages.some((age) => canShowCardRating(age))).toBe(true);
    expect(ages.some((age) => !canShowCardRating(age))).toBe(true);
  });
});
