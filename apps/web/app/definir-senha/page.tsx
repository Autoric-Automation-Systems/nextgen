import { redirect } from "next/navigation";
import { hasPassword } from "@nextgen/auth";
import { SiteFooter } from "@/components/site-footer";
import { requireSession } from "@/lib/session";
import { SetPasswordForm } from "./set-password-form";

/**
 * Só existe para quem ainda não tem senha. Quem já tem cai no painel: a página não pode
 * virar um "trocar senha" sem pedir a senha atual.
 */
export default async function SetPasswordPage() {
  const session = await requireSession();
  if (await hasPassword(session.userId)) redirect("/dashboard");

  return (
    <>
      <SetPasswordForm email={session.email} />
      <SiteFooter />
    </>
  );
}
