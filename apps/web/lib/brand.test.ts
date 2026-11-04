import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEV_CREDIT, brandAsset, devLogo, skillIconPath } from "./brand";

const publicDir = path.join(__dirname, "..", "public");

function exists(publicPath: string) {
  return existsSync(path.join(publicDir, publicPath.replace(/^\//, "")));
}

describe("brandAsset", () => {
  it("aponta para um arquivo que existe", () => {
    for (const variant of ["full", "mark", "wordmark"] as const) {
      for (const surface of ["light", "dark"] as const) {
        expect(exists(brandAsset(variant, surface).src)).toBe(true);
      }
    }
  });

  it("troca o arquivo no fundo escuro, onde o texto escuro sumiria", () => {
    expect(brandAsset("full", "dark").src).not.toBe(brandAsset("full", "light").src);
  });

  it("mantém o mesmo símbolo nas duas superfícies", () => {
    expect(brandAsset("mark", "dark").src).toBe(brandAsset("mark", "light").src);
  });

  it("reserva a proporção do arquivo para o layout não pular", () => {
    expect(brandAsset("mark").ratio).toBe(1);
    expect(brandAsset("full").ratio).toBeGreaterThan(1);
  });
});

describe("DEV_CREDIT", () => {
  it("aponta para o site do desenvolvedor, com protocolo", () => {
    expect(DEV_CREDIT.url).toBe("https://www.autoric.com.br");
    expect(new URL(DEV_CREDIT.url).protocol).toBe("https:");
  });

  it("tem logo nas duas superfícies", () => {
    expect(exists(devLogo("light").src)).toBe(true);
    expect(exists(devLogo("dark").src)).toBe(true);
    expect(devLogo("dark").src).not.toBe(devLogo("light").src);
  });
});

describe("skillIconPath", () => {
  it("monta o caminho a partir do código", () => {
    expect(skillIconPath("def")).toBe("/icons/skills/DEF.svg");
  });

  it("recusa código que não tem três letras", () => {
    expect(skillIconPath("defesa")).toBeNull();
    expect(skillIconPath("../etc/passwd")).toBeNull();
  });
});
