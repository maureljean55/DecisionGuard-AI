import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AcceptInvitation } from "@/components/auth/forms";
import { AuthHeading } from "@/components/auth/heading";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { getMe } from "@/lib/api";

async function InvitationWithSession({ dict, lang }: { dict: Dictionary["auth"]; lang: Locale }) {
  const me = await getMe();
  return <AcceptInvitation dict={dict} lang={lang} signedInEmail={me?.user.email ?? null} />;
}

export default async function Page({ params }: PageProps<"/[lang]/invite">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <>
      <AuthHeading title={dict.auth.invite.title} />
      <Suspense>
        <InvitationWithSession dict={dict.auth} lang={lang} />
      </Suspense>
    </>
  );
}
