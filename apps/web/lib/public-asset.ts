import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Diz se um arquivo de `public/` existe antes de montar a tag.
 *
 * Existe para o mesmo motivo que a marca tem fallback: arquivo ausente não pode virar
 * ícone quebrado na tela. Custa um `stat` por render, e o resultado é memorizado pelo
 * processo — o conteúdo de `public/` só muda em deploy.
 */
const cache = new Map<string, boolean>();

export function publicAssetExists(publicPath: string): boolean {
  const known = cache.get(publicPath);
  if (known !== undefined) return known;

  const exists = existsSync(path.join(process.cwd(), "public", publicPath.replace(/^\//, "")));
  cache.set(publicPath, exists);

  return exists;
}
