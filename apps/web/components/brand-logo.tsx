import { BRAND_NAME, MARK, MARK_2X, type BrandVariant } from "@/lib/brand";

type Props = {
  variant?: BrandVariant;
  /** Altura do símbolo em pixels. A largura sai da proporção do arquivo. */
  height?: number;
  className?: string;
};

/**
 * A marca em todas as telas: símbolo + nome.
 *
 * O nome é texto e não imagem, então acompanha a fonte do site e não borra ao ampliar.
 * `alt` fica no conjunto, com o texto marcado `aria-hidden`: quem usa leitor de tela ouve
 * "NextGen" uma vez, não duas.
 */
export function BrandLogo({ variant = "full", height = 28, className }: Props) {
  const showSymbol = variant !== "wordmark";
  const showName = variant !== "mark";

  return (
    <span className={`brand-lockup${className ? ` ${className}` : ""}`} data-brand={variant}>
      {showSymbol ? (
        <img
          src={MARK.src}
          srcSet={`${MARK.src} 1x, ${MARK_2X} 2x`}
          alt={showName ? "" : MARK.alt}
          aria-hidden={showName ? true : undefined}
          height={height}
          width={Math.round(height * MARK.ratio)}
          decoding="async"
          // Logo acima da dobra: esperar o JS atrasaria a pintura do cabeçalho.
          fetchPriority="high"
          style={{ display: "block", height, width: "auto" }}
        />
      ) : null}

      {showName ? (
        <span className="brand-wordmark" aria-hidden={showSymbol ? true : undefined}>
          {BRAND_NAME}
        </span>
      ) : null}
    </span>
  );
}
