import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <SiteHeader
        links={[
          { href: "/como-funciona", label: "Como funciona" },
          { href: "/escola", label: "Para escolas" },
        ]}
      />
      <SignupForm error={error} />
      <SiteFooter />
    </>
  );
}
