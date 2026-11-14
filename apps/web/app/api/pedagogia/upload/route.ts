import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import {
  FILE_KINDS,
  allowedMimeFor,
  kindFromMime,
  maxBytesFor,
  mimeForExtension,
} from "@/lib/pedagogy-rules";

/**
 * Upload direto do navegador para o store privado do Blob.
 *
 * O arquivo não passa pela função da Vercel (o corpo de uma requisição serverless é
 * limitado a poucos MB, e vídeo de treino não cabe). O que trafega por aqui é só o pedido
 * de token; o servidor decide o que o navegador pode enviar e para onde.
 */

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const session = await getCurrentSession();
  const workspace = session ? await resolveWorkspace(session) : null;
  if (!session || !workspace || !workspace.can("content:write")) {
    return Response.json({ error: "sem permissão para enviar arquivo" }, { status: 403 });
  }

  const token = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
  if (!token) {
    return Response.json(
      { error: "armazenamento não configurado neste ambiente; use um link externo" },
      { status: 503 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;
  const schoolId = workspace.schoolId;

  try {
    const json = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async (pathname) => {
        const [area, owner, folder, kind] = pathname.split("/");

        // O pathname vem do navegador: aqui é o único lugar que pode dizer não.
        if (area !== "private" || owner !== schoolId || folder !== "materials") {
          throw new Error("destino de upload fora da escola da sessão");
        }
        if (!(FILE_KINDS as readonly string[]).includes(kind ?? "")) {
          throw new Error("tipo de arquivo desconhecido");
        }

        const extension = pathname.slice(pathname.lastIndexOf(".") + 1);
        const mime = mimeForExtension(extension);
        if (!mime || kindFromMime(mime) !== kind) {
          throw new Error("extensão do arquivo não confere com o tipo escolhido");
        }

        return {
          allowedContentTypes: allowedMimeFor(kind as (typeof FILE_KINDS)[number]),
          maximumSizeInBytes: maxBytesFor(kind as (typeof FILE_KINDS)[number]),
          addRandomSuffix: false,
        };
      },
      onUploadCompleted: async () => {
        // O vínculo com o capítulo é gravado quando o formulário é enviado, não aqui:
        // upload concluído não significa conteúdo salvo.
      },
    });

    return Response.json(json);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "falha ao autorizar o upload" },
      { status: 400 },
    );
  }
}
