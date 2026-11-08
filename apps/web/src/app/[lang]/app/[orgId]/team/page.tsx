import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import {
  InviteForm,
  MembersList,
  PendingInvitations,
} from "@/components/dashboard/forms";
import { PageSkeleton, PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/dashboard/ui";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { apiGet, getMe } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import { fmt } from "@/lib/format";
import { canManageMembers } from "@/lib/permissions";
import type { Invitation, Member } from "@/lib/types";

async function Team({
  params,
}: {
  params: Promise<{ lang: string; orgId: string }>;
}) {
  const { lang: raw, orgId } = await params;
  if (!hasLocale(raw)) notFound();
  const lang: Locale = raw;
  const [me, dict, org] = await Promise.all([
    getMe(),
    getDictionary(lang),
    loadOrg(lang, orgId),
  ]);
  if (!me) redirect(`/${lang}/login`);
  const d = dict.dash;
  const manager = canManageMembers(org.role);
  const [members, invitations] = await Promise.all([
    apiGet<Member[]>(`/orgs/${org.id}/members`),
    manager
      ? apiGet<Invitation[]>(`/orgs/${org.id}/invitations`)
      : Promise.resolve({ status: 200, data: [] as Invitation[] }),
  ]);
  return (
    <>
      <PageTitle
        title={d.team.title}
        subtitle={fmt(d.team.subtitle, { org: org.name })}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel title={`${d.team.membersTitle} · ${members.data?.length ?? 0}`}>
          <MembersList
            d={d}
            lang={lang}
            org={org}
            members={members.data ?? []}
            meId={me.user.id}
          />
        </Panel>
        {manager && (
          <div className="space-y-6">
            <Panel title={d.team.inviteTitle} description={d.team.inviteBody}>
              <InviteForm d={d} org={org} />
            </Panel>
            <Panel title={d.team.pendingTitle}>
              <PendingInvitations
                d={d}
                lang={lang}
                org={org}
                invitations={invitations.data ?? []}
              />
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}

export default async function Page({
  params,
}: PageProps<"/[lang]/app/[orgId]/team">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Team params={params} />
    </Suspense>
  );
}
