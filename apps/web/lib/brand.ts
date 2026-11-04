/**
 * Identidade visual em um lugar só.
 *
 * Os componentes não conhecem caminho de arquivo: pedem uma variante e recebem o caminho.
 * Assim, trocar o logo é substituir um arquivo; trocar de nome é editar este manifesto; e
 * nenhuma tela precisa ser tocada nos dois casos.
 */

export type BrandVariant = "full" | "mark" | "wordmark";
export type Surface = "light" | "dark";

type Asset = {
  src: string;
  /** Proporção largura/altura do viewBox — usada para reservar espaço e evitar salto. */
  ratio: number;
  alt: string;
};

const LOGO: Asset = { src: "/brand/logo.svg", ratio: 168 / 40, alt: "NextGen" };
const LOGO_LIGHT: Asset = { src: "/brand/logo-light.svg", ratio: 168 / 40, alt: "NextGen" };
const MARK: Asset = { src: "/brand/mark.svg", ratio: 1, alt: "NextGen" };
const WORDMARK: Asset = { src: "/brand/wordmark.svg", ratio: 168 / 40, alt: "NextGen" };

/**
 * `undefined` quando a variante não muda com o fundo — repetir o caminho seria duplicar a
 * mesma informação em dois lugares.
 */
export function brandAsset(variant: BrandVariant, surface: Surface = "light"): Asset {
  if (variant === "mark") return MARK;
  if (variant === "wordmark") return WORDMARK;

  return surface === "dark" ? LOGO_LIGHT : LOGO;
}

export const FAVICON = "/brand/icon.svg";

/**
 * Assinatura do desenvolvedor.
 *
 * O domínio é dado, não decoração: fica aqui para o rodapé não espalhar string mágica e
 * para a checagem de link externo ser feita em um lugar só.
 */
export const DEV_CREDIT = {
  name: "Autoric",
  url: "https://www.autoric.com.br",
  logo: { src: "/dev/logo-dev.svg", ratio: 132 / 28, alt: "Autoric" },
  logoLight: { src: "/dev/logo-dev-light.svg", ratio: 132 / 28, alt: "Autoric" },
} as const;

export function devLogo(surface: Surface = "light") {
  return surface === "dark" ? DEV_CREDIT.logoLight : DEV_CREDIT.logo;
}

/**
 * Ícone de atributo do card (`CTL`, `PAS`, `DEF`…).
 *
 * Devolve `null` quando não existe arquivo para o código, e quem chama desenha o código em
 * texto. Sem isso, subir os ícones um a um deixaria quadrados quebrados no perfil.
 */
export function skillIconPath(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) return null;

  return `/icons/skills/${normalized}.svg`;
}
