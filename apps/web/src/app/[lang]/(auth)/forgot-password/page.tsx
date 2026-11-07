import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ForgotPasswordForm } from "@/components/auth/forms";
import { AuthHeading } from "@/components/auth/heading";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function Page({ params }: PageProps<"/[lang]/forgot-password">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <>
      <AuthHeading title={dict.auth.forgot.title} subtitle={dict.auth.forgot.subtitle} />
      <Suspense>
        <ForgotPasswordForm dict={dict.auth} lang={lang} />
      </Suspense>
    </>
  );
}
