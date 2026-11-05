/**
 * Identidade visual em um lugar só.
 *
 * Os componentes não conhecem caminho de arquivo: pedem uma variante e recebem o caminho.
 * Assim, trocar o logo é substituir um arquivo; trocar de nome é editar este manifesto; e
 * nenhuma tela precisa ser tocada nos dois casos.
 *
 * O símbolo é o único ativo raster do produto: chegou como PNG (não existe vetor) e é
 * servido em duas densidades. O nome "NextGen" é texto, não imagem — acompanha a fonte da
 * interface e continua nítido em qualquer zoom.
 */

export type BrandVariant = "full" | "mark" | "wordmark";
/** Só o logo do desenvolvedor muda com o fundo; o símbolo do produto não. */
export type Surface = "light" | "dark";

export type Asset = {
  src: string;
  /** Proporção largura/altura do arquivo — usada para reservar espaço e evitar salto. */
  ratio: number;
  alt: string;
};

/** Recorte do ícone de 512px, sem a margem transparente. */
export const MARK: Asset = { src: "/brand/mark.png", ratio: 494 / 354, alt: "NextGen" };
export const MARK_2X = "/brand/mark@2x.png";

export const BRAND_NAME = "NextGen";
/** Verde profundo da paleta, o mesmo usado em `theme-color`. */
export const BRAND_COLOR = "#10331f";

/**
 * Favicon e manifest.
 *
 * O navegador pede `/favicon.ico` mesmo sem `<link>`, então esse nome é fixo. Os demais
 * entram pelo `metadata` do layout raiz.
 */
export const FAVICONS = {
  ico: "/favicon.ico",
  png32: "/favicon-32x32.png",
  png16: "/favicon-16x16.png",
  apple: "/apple-touch-icon.png",
  manifest: "/site.webmanifest",
} as const;

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
