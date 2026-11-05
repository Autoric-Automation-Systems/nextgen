import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEV_CREDIT, FAVICONS, MARK, MARK_2X, devLogo, skillIconPath } from "./brand";

const publicDir = path.join(__dirname, "..", "public");

function exists(publicPath: string) {
  return existsSync(path.join(publicDir, publicPath.replace(/^\//, "")));
}

describe("MARK", () => {
  it("aponta para o arquivo nas duas densidades", () => {
    expect(exists(MARK.src)).toBe(true);
    expect(exists(MARK_2X)).toBe(true);
  });

  it("declara a proporção real do recorte, para o cabeçalho não pular", () => {
    expect(MARK.ratio).toBeGreaterThan(1);
    expect(MARK.ratio).toBeLessThan(2);
  });
});

describe("FAVICONS", () => {
  it("todo arquivo do pacote de ícones existe", () => {
    for (const publicPath of Object.values(FAVICONS)) {
      expect(exists(publicPath), publicPath).toBe(true);
    }
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
