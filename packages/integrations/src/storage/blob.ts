import { issueSignedToken, presignUrl, put } from "@vercel/blob";
import {
  MAX_BYTES,
  buildPathname,
  isAllowedMime,
  pathnameBelongsToSchool,
  type PathnameInput,
  type StorageKind,
} from "./pathname";

/**
 * Dois stores (doc 06 §4):
 *  - `public`: material de vitrine, site da escola, card público;
 *  - `private`: prontuário, anamnese, vídeo de treino, contrato.
 *
 * O store privado é lido por URL assinada de curta duração. O pathname entra aqui
 * já validado contra a escola da sessão.
 */

const PUBLIC_TTL_SECONDS = 60 * 15;

export type UploadInput = {
  schoolId: string;
  kind: StorageKind;
  scope: string;
  mime: string;
  bytes: Blob | ArrayBuffer;
  filename?: string;
};

export type UploadResult = {
  pathname: string;
  url: string;
  size: number;
  contentType: string;
};

function assertUpload(input: UploadInput): void {
  if (!isAllowedMime(input.kind, input.mime)) {
    throw new Error(`tipo não permitido para ${input.kind}: ${input.mime}`);
  }
  const size = input.bytes instanceof Blob ? input.bytes.size : input.bytes.byteLength;
  if (size === 0) throw new Error("arquivo vazio");
  if (size > MAX_BYTES[input.kind]) {
    throw new Error(`arquivo acima do limite de ${MAX_BYTES[input.kind]} bytes`);
  }
}

function pathnameFor(input: UploadInput, area: "public" | "private"): string {
  const token = globalThis.crypto.randomUUID();
  const pathnameInput: PathnameInput = {
    schoolId: input.schoolId,
    area,
    kind: input.kind,
    scope: input.scope,
    mime: input.mime,
    token,
  };
  return buildPathname(pathnameInput);
}

export async function uploadPublic(input: UploadInput): Promise<UploadResult> {
  assertUpload(input);
  const pathname = pathnameFor(input, "public");

  const blob = await put(pathname, input.bytes, {
    access: "public",
    contentType: input.mime,
    addRandomSuffix: false,
    // Conteúdo de vitrine pode ficar em cache de borda.
    cacheControlMaxAge: 60 * 60 * 24 * 30,
  });

  return {
    pathname: blob.pathname,
    url: blob.url,
    size: input.bytes instanceof Blob ? input.bytes.size : input.bytes.byteLength,
    contentType: input.mime,
  };
}

export async function uploadPrivate(input: UploadInput): Promise<UploadResult> {
  assertUpload(input);
  const pathname = pathnameFor(input, "private");

  const blob = await put(pathname, input.bytes, {
    access: "private",
    contentType: input.mime,
    addRandomSuffix: false,
  });

  return {
    pathname: blob.pathname,
    url: blob.url,
    size: input.bytes instanceof Blob ? input.bytes.size : input.bytes.byteLength,
    contentType: input.mime,
  };
}

/**
 * URL assinada para mídia privada. Recusa pathname que não pertença à escola da
 * sessão — a checagem fica aqui para não depender de cada rota lembrar.
 */
export async function presignPrivateDownload(options: {
  schoolId: string;
  pathname: string;
  ttlSeconds?: number;
  /** Bypassa o CDN quando o arquivo acabou de ser substituído. */
  useCache?: boolean;
}): Promise<string> {
  if (!pathnameBelongsToSchool(options.pathname, options.schoolId)) {
    throw new Error("pathname fora da escola da sessão");
  }

  const ttl = options.ttlSeconds ?? PUBLIC_TTL_SECONDS;
  const validUntil = Date.now() + ttl * 1000;

  const token = await issueSignedToken({
    pathname: options.pathname,
    operations: ["get"],
    validUntil,
  });

  const { presignedUrl } = await presignUrl(token, {
    operation: "get",
    pathname: options.pathname,
    validUntil,
    access: "private",
    useCache: options.useCache ?? true,
  });

  return presignedUrl;
}
