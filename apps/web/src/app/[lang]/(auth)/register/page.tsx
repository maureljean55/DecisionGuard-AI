import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RegisterForm } from "@/components/auth/forms";
import { AuthHeading } from "@/components/auth/heading";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function Page({ params }: PageProps<"/[lang]/register">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <>
      <AuthHeading title={dict.auth.register.title} subtitle={dict.auth.register.subtitle} />
      <Suspense>
        <RegisterForm dict={dict.auth} lang={lang} />
      </Suspense>
    </>
  );
}
