import { skillIconPath } from "@/lib/brand";
import { publicAssetExists } from "@/lib/public-asset";

/**
 * Ícone de um atributo do card, com o código como reserva.
 *
 * A reserva não é enfeite: os ícones entram aos poucos, e um atributo sem arquivo precisa
 * continuar legível no perfil público em vez de virar quadrado quebrado.
 */
export function SkillIcon({ code, size = 20 }: { code: string; size?: number }) {
  const path = skillIconPath(code);
  const label = code.trim().toUpperCase();

  if (path && publicAssetExists(path)) {
    return (
      <img
        src={path}
        alt=""
        aria-hidden
        height={size}
        width={size}
        style={{ display: "block", height: size, width: size }}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <span className="skill-code" title={label} aria-label={label} style={{ fontSize: size * 0.5 }}>
      {label}
    </span>
  );
}
