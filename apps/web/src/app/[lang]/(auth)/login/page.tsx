import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/forms";
import { AuthHeading } from "@/components/auth/heading";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function Page({ params }: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <>
      <AuthHeading title={dict.auth.login.title} subtitle={dict.auth.login.subtitle} />
      <Suspense>
        <LoginForm dict={dict.auth} lang={lang} />
      </Suspense>
    </>
  );
}
