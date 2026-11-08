import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  Mail,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense, type ComponentType } from "react";

import { ResendVerification } from "@/components/app/session-actions";
import { PageSkeleton, PageTitle } from "@/components/dashboard/page-title";
import { Panel, RoleBadge } from "@/components/dashboard/ui";
import { LocalTime } from "@/components/dashboard/local-time";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { apiGet, getMe } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import { describeAction } from "@/lib/dash-format";
import { fmt } from "@/lib/format";
import { canManageMembers, canReadAudit } from "@/lib/permissions";
import type { AuditPage, Invitation, Member } from "@/lib/types";

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-abyss/70 p-5">
      <p className="flex items-center gap-2 text-xs text-muted">
        <Icon className="size-4 text-teal" />
        {label}
      </p>
      <div className="mt-3 text-2xl font-semibold text-ink">{value}</div>
    </div>
  );
}

async function Overview({
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
  const [members, invitations, audit] = await Promise.all([
    apiGet<Member[]>(`/orgs/${org.id}/members`),
    manager
      ? apiGet<Invitation[]>(`/orgs/${org.id}/invitations`)
      : Promise.resolve({ status: 200, data: [] as Invitation[] }),
    canReadAudit(org.role)
      ? apiGet<AuditPage>(`/orgs/${org.id}/audit-logs?limit=5`)
      : Promise.resolve({ status: 200, data: null }),
  ]);
  const memberCount = members.data?.length ?? 0;
  const steps = [
    { label: d.overview.steps.verify, done: me.user.email_verified },
    { label: d.overview.steps.org, done: true },
    {
      label: d.overview.steps.invite,
      done: memberCount > 1,
      href: `/${lang}/app/${org.id}/team`,
    },
    { label: d.overview.steps.decision, done: false, soon: true },
  ];
  const firstName = me.user.full_name.split(" ")[0];

  return (
    <>
      {!me.user.email_verified && (
        <div
          role="status"
          className="mb-6 flex flex-col gap-3 rounded-2xl border border-risk-moderate/40 bg-risk-moderate/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-2 text-sm text-ink">
            <Mail className="size-4 shrink-0 text-risk-moderate" aria-hidden />
            {d.verify.text}
          </span>
          <span className="text-risk-moderate">
            <ResendVerification
              label={d.verify.resend}
              doneLabel={d.verify.sent}
            />
          </span>
        </div>
      )}

      <PageTitle
        title={fmt(d.overview.hello, { name: firstName })}
        subtitle={fmt(d.overview.subtitle, { org: org.name })}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat icon={Users} label={d.overview.members} value={memberCount} />
        {manager && (
          <Stat
            icon={Clock3}
            label={d.overview.pending}
            value={invitations.data?.length ?? 0}
          />
        )}
        <Stat
          icon={Shield}
          label={d.overview.role}
          value={<RoleBadge role={org.role} label={d.roles[org.role]} />}
        />
        <Stat
          icon={Sparkles}
          label={d.overview.plan}
          value={(d.plans as Record<string, string>)[org.plan] ?? org.plan}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel title={d.overview.decisionsTitle}>
          <div className="flex flex-col items-start gap-4 py-4">
            <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-night">
              <FileText className="size-5 text-muted" aria-hidden />
            </span>
            <p className="max-w-lg text-sm leading-relaxed text-muted">
              {d.overview.decisionsEmpty}
            </p>
            <Link
              href={`/${lang}/contact`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:text-ink"
            >
              {d.overview.decisionsCta}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </Panel>

        <Panel title={d.overview.nextTitle}>
          <ul className="space-y-3">
            {steps.map((s) => {
              const Icon = s.done ? CheckCircle2 : Circle;
              const body = (
                <span className="flex items-center gap-3 text-sm">
                  <Icon
                    className={`size-[1.1rem] shrink-0 ${s.done ? "text-teal" : "text-muted/60"}`}
                    aria-hidden
                  />
                  <span
                    className={
                      s.done
                        ? "text-muted line-through decoration-muted/40"
                        : "text-ink"
                    }
                  >
                    {s.label}
                  </span>
                  {s.soon && (
                    <span className="ml-auto rounded-full border border-line px-2 py-0.5 text-[0.65rem] text-muted">
                      {d.overview.soonTag}
                    </span>
                  )}
                </span>
              );
              return (
                <li key={s.label}>
                  {s.href && !s.done ? (
                    <Link
                      href={s.href}
                      className="block rounded-lg hover:text-teal"
                    >
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {audit.data && (
        <div className="mt-6">
          <Panel
            title={d.overview.activityTitle}
            action={
              <Link
                href={`/${lang}/app/${org.id}/activity`}
                className="text-sm text-teal hover:text-ink"
              >
                {d.overview.activityAll}
              </Link>
            }
          >
            {audit.data.items.length ? (
              <ul className="divide-y divide-line">
                {audit.data.items.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm text-ink">
                      <span className="font-medium">
                        {e.actor_name ?? d.activity.system}
                      </span>{" "}
                      {describeAction(d, e)}
                    </span>
                    <span className="text-xs text-muted">
                      <LocalTime iso={e.created_at} lang={lang} withTime />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{d.overview.activityEmpty}</p>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}

export default async function Page({
  params,
}: PageProps<"/[lang]/app/[orgId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview params={params} />
    </Suspense>
  );
}
