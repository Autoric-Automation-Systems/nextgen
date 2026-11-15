import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Fronteira cliente/servidor.
 *
 * Um `"use client"` que importa `@/lib/units` (ou qualquer módulo que chegue em
 * `@nextgen/db`) compila, o `next dev` responde 200 e a página quebra no navegador com
 * "a client-side exception has occurred" — o Prisma nem carrega sem `APP_DATABASE_URL`.
 * O tipo de erro não aparece em teste de unidade nem em `tsc`, então o guarda é estático.
 */

const ROOT = resolve(__dirname, "..");
const SCAN = ["app", "components", "lib"].map((dir) => join(ROOT, dir));
const SERVER_PACKAGES = ["@nextgen/db", "@nextgen/auth", "@nextgen/integrations"];
/** Subcaminhos públicos sem banco: só regras puras. */
const PURE_SUBPATHS = new Set(["@nextgen/auth/password-rules"]);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

/** Import de valor: `import type` some na compilação e não carrega módulo nenhum. */
function valueImports(source: string): string[] {
  const specs: string[] = [];
  for (const match of source.matchAll(/^\s*import\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/gm)) {
    const spec = match[2];
    if (!match[1] && spec) specs.push(spec);
  }
  return specs;
}

function localFile(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? join(ROOT, spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(from), spec)
      : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(candidate) && /\.tsx?$/.test(candidate)) return candidate;
  }
  return null;
}

function reachesServer(file: string, seen = new Set<string>()): string[] {
  if (seen.has(file)) return [];
  seen.add(file);
  const source = readFileSync(file, "utf8");
  // Módulo `"use server"` chega ao cliente como referência remota; o corpo fica no servidor.
  if (/^\s*["']use server["']/m.test(source)) return [];
  const hits: string[] = [];
  for (const spec of valueImports(source)) {
    if (PURE_SUBPATHS.has(spec)) continue;
    if (SERVER_PACKAGES.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`))) {
      hits.push(spec);
      continue;
    }
    const next = localFile(file, spec);
    if (next) hits.push(...reachesServer(next, seen));
  }
  return hits;
}

describe("fronteira cliente/servidor", () => {
  const clientFiles = SCAN.flatMap(walk).filter((file) =>
    /^\s*["']use client["']/m.test(readFileSync(file, "utf8")),
  );

  it("encontra os componentes de cliente", () => {
    expect(clientFiles.length).toBeGreaterThan(5);
  });

  it("nenhum componente de cliente alcança um pacote que instancia o banco", () => {
    const offenders = clientFiles
      .map((file) => ({ file: file.replace(`${ROOT}/`, ""), hits: reachesServer(file) }))
      .filter((entry) => entry.hits.length > 0)
      .map((entry) => `${entry.file} → ${[...new Set(entry.hits)].join(", ")}`);
    expect(offenders).toEqual([]);
  });
});
