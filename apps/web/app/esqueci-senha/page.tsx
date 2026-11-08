import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ForgotForm } from "./forgot-form";

export default function ForgotPasswordPage() {
  return (
    <>
      <SiteHeader
        links={[
          { href: "/como-funciona", label: "Como funciona" },
          { href: "/escola", label: "Para escolas" },
        ]}
      />
      <ForgotForm />
      <SiteFooter />
    </>
  );
}
