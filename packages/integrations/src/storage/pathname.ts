/**
 * Convenções de caminho no Vercel Blob.
 *
 * O pathname é sempre montado no servidor a partir de `school_id` + id interno.
 * Nunca aceitamos pathname do cliente: sem isso, um usuário autenticado na escola
 * A poderia pedir `escola-b/...` e ler mídia privada de outra escola.
 */

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StorageArea = "public" | "private";

export type StorageKind = "image" | "video" | "audio" | "document" | "avatar";

export const MAX_BYTES: Record<StorageKind, number> = {
  image: 5 * 1024 * 1024,
  avatar: 2 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  document: 20 * 1024 * 1024,
};

const ALLOWED_MIME: Record<StorageKind, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp"],
  avatar: ["image/jpeg", "image/png", "image/webp"],
  audio: ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  document: ["application/pdf"],
};

export function isAllowedMime(kind: StorageKind, mime: string): boolean {
  return ALLOWED_MIME[kind].includes(mime);
}

export function extensionFor(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "application/pdf": "pdf",
  };
  return map[mime] ?? "bin";
}

export type PathnameInput = {
  schoolId: string;
  area: StorageArea;
  kind: StorageKind;
  /** Ex.: `students/<uuid>/photo`. */
  scope: string;
  mime: string;
  /** Identificador curto gerado no servidor para evitar colisão. */
  token: string;
};

export function buildPathname(input: PathnameInput): string {
  if (!UUID_LIKE.test(input.schoolId)) throw new Error("schoolId inválido");
  if (!SAFE_SEGMENT.test(input.token)) throw new Error("token inválido");

  const scopeParts = input.scope.split("/");
  if (scopeParts.some((part) => !SAFE_SEGMENT.test(part) || part === "." || part === "..")) {
    throw new Error("scope inválido");
  }

  return `${input.area}/${input.schoolId}/${scopeParts.join("/")}-${input.token}.${extensionFor(input.mime)}`;
}

/** Verifica se o pathname pertence à escola antes de assinar qualquer URL. */
export function pathnameBelongsToSchool(pathname: string, schoolId: string): boolean {
  const parts = pathname.split("/");
  if (parts.length < 4) return false;
  const [area, owner, ...rest] = parts;
  if (area !== "public" && area !== "private") return false;
  if (rest.length === 0) return false;
  return owner === schoolId;
}
