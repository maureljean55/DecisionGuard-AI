import { notFound } from "next/navigation";

import { CreateOrgForm } from "@/components/dashboard/forms";
import { PageTitle } from "@/components/dashboard/page-title";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function Page({ params }: PageProps<"/[lang]/app/new">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const d = (await getDictionary(lang)).dash;
  return (
    <>
      <PageTitle title={d.newOrg.title} subtitle={d.newOrg.subtitle} />
      <div className="rounded-2xl border border-line bg-abyss/70 p-6">
        <CreateOrgForm d={d} lang={lang} />
      </div>
    </>
  );
}
