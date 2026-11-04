import { brandAsset, type BrandVariant, type Surface } from "@/lib/brand";

type Props = {
  variant?: BrandVariant;
  surface?: Surface;
  /** Altura em pixels. A largura sai da proporção do arquivo. */
  height?: number;
  className?: string;
};

/**
 * A marca em todas as telas. Usa `<img>` e não `next/image` porque o otimizador recusa
 * SVG sem `dangerouslyAllowSVG` global — flag que vale para toda imagem do site, e não
 * se paga para servir cinco SVGs próprios que já são pequenos e escaláveis.
 */
export function BrandLogo({ variant = "full", surface = "light", height = 28, className }: Props) {
  const asset = brandAsset(variant, surface);

  return (
    <img
      src={asset.src}
      alt={asset.alt}
      height={height}
      width={Math.round(height * asset.ratio)}
      className={className}
      data-brand={variant}
      decoding="async"
      // Logo acima da dobra: esperar o JS atrasaria a pintura do cabeçalho.
      fetchPriority="high"
      style={{ display: "block", height, width: "auto" }}
    />
  );
}
