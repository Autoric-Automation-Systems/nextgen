import { z } from "zod";

/**
 * Validação do pedido de cadastro de escola.
 *
 * Fica fora da server action para ser testada sem banco: é aqui que a entrada pública é
 * filtrada, e erro aqui vira dado ruim na triagem de quem ativa a escola.
 */
export const schoolLeadSchema = z.object({
  schoolName: z.string().trim().min(2, "informe o nome da escola").max(120),
  contactName: z.string().trim().min(2, "informe o nome de quem responde").max(120),
  email: z.string().trim().toLowerCase().email("e-mail inválido").max(160),
  // Telefone e cidade são opcionais e aceitam o que a pessoa digitar: exigir máscara
  // recusa fixo de escola e número de outro país por um detalhe de formatação.
  phone: optionalText(40),
  city: optionalText(120),
  studentCount: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(100_000)])
    .transform((value) => (value === "" ? null : Number(value)))
    .nullable()
    .default(null),
  message: optionalText(1_000),
});

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null);
}

export type SchoolLeadInput = z.infer<typeof schoolLeadSchema>;

/**
 * Campo que só um robô preenche. Devolve `true` quando há suspeita, e a action responde
 * sucesso sem gravar — dizer "bloqueado" ensina o robô a evitar o campo na próxima vez.
 */
export function looksLikeBot(formData: FormData): boolean {
  return String(formData.get("website") ?? "").trim() !== "";
}

/** Quantos pedidos por janela. Baixo de propósito: escola real manda um, não dez. */
const LIMIT = 3;
const WINDOW_MS = 10 * 60 * 1000;

const attempts = new Map<string, number[]>();

/**
 * Limite por origem, em memória.
 *
 * Vale por instância: na Vercel cada função tem a sua e ela recicla. Serve para conter
 * envio repetido acidental (duplo clique, formulário reenviado), não ataque distribuído —
 * esse depende de limite na borda ou no WAF.
 */
export function allowRequest(key: string, now = Date.now()): boolean {
  const recent = (attempts.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= LIMIT) {
    attempts.set(key, recent);
    return false;
  }

  recent.push(now);
  attempts.set(key, recent);

  // Sem expurgo, o mapa guarda uma entrada por origem que já visitou o site.
  if (attempts.size > 5_000) {
    for (const [origin, times] of attempts) {
      if (times.every((at) => now - at >= WINDOW_MS)) attempts.delete(origin);
    }
  }

  return true;
}
