import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/auth/forms";
import { AuthHeading } from "@/components/auth/heading";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function Page({ params }: PageProps<"/[lang]/reset-password">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <>
      <AuthHeading title={dict.auth.reset.title} subtitle={dict.auth.reset.subtitle} />
      <Suspense>
        <ResetPasswordForm dict={dict.auth} lang={lang} />
      </Suspense>
    </>
  );
}
