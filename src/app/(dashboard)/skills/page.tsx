import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileUp } from "lucide-react";
import { Suspense } from "react";

import { SkillsOverview } from "@/components/dashboard/mockup-sections/skills-overview";
import { SkillCollection } from "@/components/skills/skill-collection";
import { roleLabel } from "@/components/dashboard/widgets/labels";
import { db } from "@/db";
import { profileViews } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/dal";
import type { GapState, ProfileViewDoc, RoleAnalysis } from "@/lib/dashboard/types";

export const metadata: Metadata = {
  title: "Skills | AI Tathastu",
};

export default function SkillsPage() {
  return (
    <Suspense fallback={<SkillsSkeleton />}>
      <SkillsContent />
    </Suspense>
  );
}

function SkillsSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto max-w-7xl animate-pulse space-y-6">
      <div className="h-10 w-64 rounded-xl bg-muted" />
      <div className="h-96 rounded-2xl bg-muted" />
    </div>
  );
}

const STATE_LABEL: Record<GapState, string> = {
  met: "At level",
  underdeveloped: "Below expected",
  unverified: "Not shown yet",
  inferred: "Only suggested",
  missing: "No evidence",
  not_assessed: "Not assessed",
};

async function SkillsContent() {
  const { user } = await requireOnboardedUser();
  const [row] = await db.select().from(profileViews).where(eq(profileViews.userId, user.id));
  const intelligence = (row?.view as ProfileViewDoc | undefined)?.intelligence;
  const hasSkills = Boolean(intelligence && intelligence.skills.length + intelligence.inferred.length > 0);

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-16">
      <div>
        <Link href="/dashboard" className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:text-foreground">
          <ArrowLeft aria-hidden className="size-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <h1 className="editorial-title text-3xl tracking-tight text-foreground sm:text-4xl">Skills</h1>
        <p className="mt-1 text-sm text-muted-foreground">Each skill, the level your evidence supports, and where that evidence comes from.</p>
      </div>

      {!intelligence ? (
        <div role="status" className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm font-semibold text-foreground">Being updated</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">Your skills are recalculated from your evidence the next time your profile is processed.</p>
        </div>
      ) : !hasSkills ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm font-semibold text-foreground">No skills found yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">Add your resume or connect GitHub, and your skills will appear here with their evidence.</p>
          <Link href="/onboarding/resume" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity duration-150 hover:opacity-90">
            <FileUp aria-hidden className="size-4" />
            <span>Upload resume</span>
          </Link>
        </div>
      ) : (
        <>
          <SkillsOverview skillGraph={intelligence.graph} maxNodes={Number.POSITIVE_INFINITY} fullView />
          <SkillCollection skills={intelligence.skills} inferred={intelligence.inferred} />
          {intelligence.roles.map((role) => (
            <RoleTable key={role.role} role={role} />
          ))}
        </>
      )}
    </div>
  );
}

function RoleTable({ role }: { role: RoleAnalysis }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs sm:p-6">
      <h2 className="text-base font-bold text-foreground">{roleLabel(role.role)}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {role.assessed && role.alignment
          ? `${role.alignment.label}: ${role.alignment.requiredMet} of ${role.alignment.required} required skills shown at the expected level.`
          : "Not enough evidence to assess this role. That isn't the same as having gaps."}
      </p>
      {/* Phones: one stacked row per skill (no sideways scrolling). Same data as the table. */}
      <ul className="mt-3 divide-y divide-border sm:hidden">
        {role.skills.map((row) => (
          <li key={row.skill} className="py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-foreground" title={row.skill}>{row.skill}</span>
              <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">{row.priority}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {STATE_LABEL[row.state]} · now {row.level} · needs {row.expectedLevel}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-3 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[480px] text-left text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3 font-semibold">Skill</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Priority</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Expected</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Current</th>
              <th scope="col" className="py-2 font-semibold">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {role.skills.map((row) => (
              <tr key={row.skill}>
                <th scope="row" className="py-2 pr-3 font-semibold text-foreground">{row.skill}</th>
                <td className="py-2 pr-3 text-muted-foreground">{row.priority}</td>
                <td className="py-2 pr-3 text-muted-foreground">{row.expectedLevel}</td>
                <td className="py-2 pr-3 text-muted-foreground">{row.level}</td>
                <td className="py-2 text-foreground">{STATE_LABEL[row.state]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
