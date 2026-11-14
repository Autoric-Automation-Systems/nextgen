import { NextResponse } from "next/server";
import { withTenant } from "@nextgen/db";
import { presignPrivateDownload, uploadsConfigured } from "@nextgen/integrations";
import { getCurrentSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";

/**
 * Entrega de mídia privada (vídeo de treino, áudio, PDF).
 *
 * O link assinado dura 5 minutos e é gerado a cada acesso: não existe URL permanente
 * circulando em grupo de WhatsApp. O recorte por papel fica aqui porque o arquivo não
 * passa pela RLS — o `storagePath` sim, e é ele que autoriza a assinatura.
 */

export const runtime = "nodejs";

const SIGNED_TTL_SECONDS = 5 * 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const session = await getCurrentSession();
  const workspace = session ? await resolveWorkspace(session) : null;
  if (!session || !workspace || !workspace.can("content:read")) {
    return new Response("não encontrado", { status: 404 });
  }

  const material = await withTenant({ schoolId: workspace.schoolId, userId: session.userId }, (tx) =>
    tx.material.findFirst({
      where: { id, deletedAt: null },
      select: { storagePath: true, isPublished: true },
    }),
  );

  if (!material?.storagePath) return new Response("não encontrado", { status: 404 });

  // Rascunho é da equipe; a família só abre o que foi publicado.
  if (workspace.role === "guardian" && !material.isPublished) {
    return new Response("não encontrado", { status: 404 });
  }

  if (!uploadsConfigured("private")) {
    return new Response("armazenamento não configurado neste ambiente", { status: 503 });
  }

  const url = await presignPrivateDownload({
    schoolId: workspace.schoolId,
    pathname: material.storagePath,
    ttlSeconds: SIGNED_TTL_SECONDS,
  });

  return NextResponse.redirect(url, 302);
}
