"use client";

import { useActionState, useState } from "react";
import { upload } from "@vercel/blob/client";
import { createMaterial, type PedagogyState } from "../actions";
import {
  FILE_KINDS,
  MATERIAL_KINDS,
  MATERIAL_KIND_LABEL,
  allowedMimeFor,
  extensionForMime,
  formatBytes,
  isFileKind,
  kindFromMime,
  maxBytesFor,
  type MaterialKind,
} from "@/lib/pedagogy-rules";

const initial: PedagogyState = { status: "idle" };

export function MaterialForm({
  chapterId,
  schoolId,
  uploadsEnabled,
}: {
  chapterId: string;
  schoolId: string;
  uploadsEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(createMaterial, initial);
  const [kind, setKind] = useState<MaterialKind>("text");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const kinds = MATERIAL_KINDS.filter((entry) => uploadsEnabled || !isFileKind(entry));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");

    if (!isFileKind(kind)) return;

    // Arquivo não cabe no corpo de uma server action: sobe direto para o Blob e o
    // formulário segue só com o pathname devolvido.
    event.preventDefault();
    setUploadError(null);

    if (!(file instanceof File) || file.size === 0) {
      setUploadError("Escolha o arquivo.");
      return;
    }
    if (kindFromMime(file.type) !== kind) {
      setUploadError(`O arquivo não é ${MATERIAL_KIND_LABEL[kind].toLowerCase()}.`);
      return;
    }
    if (file.size > maxBytesFor(kind)) {
      setUploadError(`O arquivo passa do limite de ${formatBytes(maxBytesFor(kind))}.`);
      return;
    }

    const extension = extensionForMime(file.type);
    if (!extension) {
      setUploadError("Formato não aceito.");
      return;
    }

    setUploading(true);
    try {
      const blob = await upload(
        `private/${schoolId}/materials/${kind}/${crypto.randomUUID()}.${extension}`,
        file,
        {
          access: "private",
          handleUploadUrl: "/api/pedagogia/upload",
          contentType: file.type,
          multipart: file.size > 8 * 1024 * 1024,
        },
      );

      data.set("storagePath", blob.pathname);
      data.set("mime", file.type);
      data.set("sizeBytes", String(file.size));
      data.delete("file");
      formAction(data);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Falha ao enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  const busy = pending || uploading;
  const accept = FILE_KINDS.includes(kind as (typeof FILE_KINDS)[number])
    ? allowedMimeFor(kind).join(",")
    : undefined;

  return (
    <form action={formAction} onSubmit={onSubmit}>
      <input type="hidden" name="chapterId" value={chapterId} />

      {state.status !== "idle" ? (
        <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status">
          {state.message}
        </p>
      ) : null}
      {uploadError ? (
        <p className="notice error" role="status">
          {uploadError}
        </p>
      ) : null}

      <div className="field-row">
        <div className="field">
          <label htmlFor={`kind-${chapterId}`}>Tipo</label>
          <select
            id={`kind-${chapterId}`}
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as MaterialKind)}
          >
            {kinds.map((entry) => (
              <option key={entry} value={entry}>
                {MATERIAL_KIND_LABEL[entry]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`title-${chapterId}`}>Título</label>
          <input
            id={`title-${chapterId}`}
            name="title"
            required
            maxLength={120}
            placeholder="Passe de primeira — apoio"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor={`description-${chapterId}`}>Descrição (opcional)</label>
        <input
          id={`description-${chapterId}`}
          name="description"
          maxLength={300}
          placeholder="O que o aluno deve observar"
        />
      </div>

      {kind === "text" ? (
        <div className="field">
          <label htmlFor={`body-${chapterId}`}>Texto</label>
          <textarea id={`body-${chapterId}`} name="bodyText" rows={5} maxLength={20000} required />
        </div>
      ) : null}

      {kind === "link" ? (
        <div className="field">
          <label htmlFor={`url-${chapterId}`}>Endereço</label>
          <input
            id={`url-${chapterId}`}
            name="url"
            type="url"
            required
            placeholder="https://youtu.be/…"
          />
          <span className="muted">
            Vale YouTube, Vimeo, Drive ou o site da escola. O link fica visível para quem tem
            acesso.
          </span>
        </div>
      ) : null}

      {isFileKind(kind) ? (
        <div className="field">
          <label htmlFor={`file-${chapterId}`}>
            Arquivo ({MATERIAL_KIND_LABEL[kind]}, até {formatBytes(maxBytesFor(kind))})
          </label>
          <input id={`file-${chapterId}`} name="file" type="file" accept={accept} required />
          <span className="muted">
            Fica no armazenamento privado: cada abertura gera um link assinado de 5 minutos.
          </span>
        </div>
      ) : null}

      <button className="btn" type="submit" disabled={busy}>
        {uploading ? "Enviando arquivo…" : pending ? "Salvando…" : "Adicionar conteúdo"}
      </button>
      <span className="muted" style={{ marginLeft: 10 }}>
        Entra como rascunho; publicar é um segundo clique.
      </span>
    </form>
  );
}
