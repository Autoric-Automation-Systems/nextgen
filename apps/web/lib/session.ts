import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, resolveSession, type ResolvedSession } from "@nextgen/auth";
import { findSchoolIdForUser } from "@nextgen/db";

/**
 * Sessão + escola + ator, sempre resolvidos no servidor. O `schoolId` nunca vem de
 * query string ou header do cliente.
 */
export async function getCurrentSession(schoolSlug?: string): Promise<ResolvedSession | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const preferredSchoolId = schoolSlug
    ? await findSchoolIdForUser(session.user.id, schoolSlug)
    : null;

  return resolveSession({
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    preferredSchoolId,
  });
}

export async function requireSession(schoolSlug?: string): Promise<ResolvedSession> {
  const session = await getCurrentSession(schoolSlug);
  if (!session) redirect("/login");
  return session;
}
