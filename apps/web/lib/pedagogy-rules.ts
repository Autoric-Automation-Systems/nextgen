/**
 * Regras da biblioteca pedagógica (matéria → capítulo → conteúdo).
 *
 * Ficam aqui, sem banco e sem React, porque são o que os testes de unidade cobrem:
 * tipo de arquivo aceito, tamanho, endereço externo válido e a forma exata de cada
 * conteúdo. O banco repete a parte estrutural (`materials_source_check`) de propósito —
 * a constraint é a última linha de defesa, não a única.
 */

export const MATERIAL_KINDS = ["text", "link", "video", "audio", "image", "pdf"] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export const MATERIAL_KIND_LABEL: Record<MaterialKind, string> = {
  text: "Texto",
  link: "Link externo",
  video: "Vídeo",
  audio: "Áudio",
  image: "Imagem",
  pdf: "PDF",
};

export const FILE_KINDS = ["video", "audio", "image", "pdf"] as const;

export function isFileKind(kind: MaterialKind): kind is (typeof FILE_KINDS)[number] {
  return (FILE_KINDS as readonly string[]).includes(kind);
}

const MIME_BY_KIND: Record<(typeof FILE_KINDS)[number], string[]> = {
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav"],
  image: ["image/jpeg", "image/png", "image/webp"],
  pdf: ["application/pdf"],
};

const MAX_BYTES_BY_KIND: Record<(typeof FILE_KINDS)[number], number> = {
  video: 500 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
  image: 5 * 1024 * 1024,
  pdf: 20 * 1024 * 1024,
};

const EXTENSION_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function extensionForMime(mime: string): string | null {
  const normalized = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  return EXTENSION_BY_MIME[normalized] ?? null;
}

export function mimeForExtension(extension: string): string | null {
  const normalized = extension.replace(/^\./, "").toLowerCase();
  const entry = Object.entries(EXTENSION_BY_MIME).find(([, value]) => value === normalized);
  return entry?.[0] ?? null;
}

export function kindFromMime(mime: string): MaterialKind | null {
  const normalized = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  for (const kind of FILE_KINDS) {
    if (MIME_BY_KIND[kind].includes(normalized)) return kind;
  }
  return null;
}

export function allowedMimeFor(kind: MaterialKind): string[] {
  return isFileKind(kind) ? MIME_BY_KIND[kind] : [];
}

export function maxBytesFor(kind: MaterialKind): number {
  return isFileKind(kind) ? MAX_BYTES_BY_KIND[kind] : 0;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1).replace(".", ",")} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Endereço externo. Só `http` e `https`: `javascript:` num `href` é execução de script
 * na sessão de quem abriu, e `file:` é leitura local. "www." é completado por conforto.
 */
export function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidate = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!parsed.hostname.includes(".")) return null;
  if (parsed.username || parsed.password) return null;

  return parsed.toString();
}

export type MaterialDraft = {
  kind: MaterialKind;
  title: string;
  description?: string | null;
  bodyText?: string | null;
  url?: string | null;
  storagePath?: string | null;
  mime?: string | null;
  sizeBytes?: number | null;
};

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 300;
export const BODY_MAX = 20000;

/** Devolve a primeira objeção, ou `null` quando o conteúdo pode ser gravado. */
export function materialDraftIssue(draft: MaterialDraft): string | null {
  const title = draft.title.trim();
  if (!title) return "Dê um título ao conteúdo.";
  if (title.length > TITLE_MAX) return `O título cabe em ${TITLE_MAX} caracteres.`;
  if ((draft.description ?? "").length > DESCRIPTION_MAX) {
    return `A descrição cabe em ${DESCRIPTION_MAX} caracteres.`;
  }

  if (draft.kind === "text") {
    if (!(draft.bodyText ?? "").trim()) return "Escreva o texto do conteúdo.";
    if ((draft.bodyText ?? "").length > BODY_MAX) return "O texto passou do limite de 20 mil caracteres.";
    return null;
  }

  if (draft.kind === "link") {
    if (!normalizeHttpUrl(draft.url ?? "")) {
      return "Cole um endereço que comece com https:// (YouTube, Drive ou site da escola).";
    }
    return null;
  }

  return storagePathIssue(draft.storagePath ?? "", draft.mime ?? "", draft.kind, draft.sizeBytes ?? 0);
}

/**
 * Confere o arquivo já enviado ao Blob. O pathname chega do navegador, então é aqui que
 * ele deixa de ser confiável: precisa estar na pasta da escola da sessão.
 */
export function storagePathIssue(
  pathname: string,
  mime: string,
  kind: MaterialKind,
  sizeBytes: number,
  schoolId?: string,
): string | null {
  if (!isFileKind(kind)) return "Tipo de conteúdo sem arquivo.";
  if (!pathname) return "Envie o arquivo antes de salvar.";
  if (schoolId && !pathname.startsWith(`private/${schoolId}/materials/`)) {
    return "O arquivo não pertence a esta escola.";
  }
  if (kindFromMime(mime) !== kind) return "O arquivo enviado não é do tipo escolhido.";
  if (sizeBytes <= 0) return "O arquivo chegou vazio.";
  if (sizeBytes > maxBytesFor(kind)) {
    return `O arquivo passa do limite de ${formatBytes(maxBytesFor(kind))}.`;
  }
  return null;
}

/** Data do plano de aula como `YYYY-MM-DD`, validada no calendário (não só no formato). */
export function parseDateInput(raw: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1) {
    return null;
  }
  if (date.getUTCDate() !== Number(day)) return null;

  return date;
}

export function durationIssue(minutes: number): string | null {
  if (!Number.isInteger(minutes)) return "Duração em minutos inteiros.";
  if (minutes < 15 || minutes > 180) return "A aula dura entre 15 e 180 minutos.";
  return null;
}

/** Posição de exibição: 1, 2, 3… sem buracos, mesmo depois de arquivar um item. */
export function nextPosition(positions: number[]): number {
  const highest = positions.reduce((max, value) => (value > max ? value : max), 0);
  return highest + 1;
}
