import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { Suspense } from "react";

import { roleLabel } from "@/components/dashboard/widgets/labels";
import { db } from "@/db";
import { profileViews } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/dal";
import type { EngineRoadmap, LearningRecommendation, ProfileViewDoc } from "@/lib/dashboard/types";
import { ALIGNMENT_TEXT } from "@/lib/roadmap/view";

export const metadata: Metadata = {
  title: "Learning & Roadmap | AI Tathastu",
};

export default function LearningPage() {
  return (
    <Suspense fallback={<LearningSkeleton />}>
      <LearningContent />
    </Suspense>
  );
}

function LearningSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto max-w-7xl animate-pulse space-y-6">
      <div className="h-10 w-64 rounded-xl bg-muted" />
      <div className="h-96 rounded-2xl bg-muted" />
    </div>
  );
}

async function LearningContent() {
  const { user } = await requireOnboardedUser();
  const [row] = await db.select().from(profileViews).where(eq(profileViews.userId, user.id));
  const intelligence = (row?.view as ProfileViewDoc | undefined)?.intelligence;

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-16">
      <div>
        <Link href="/dashboard" className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:text-foreground">
          <ArrowLeft aria-hidden className="size-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <h1 className="editorial-title text-3xl tracking-tight text-foreground sm:text-4xl">Learning &amp; Roadmap</h1>
        <p className="mt-1 text-sm text-muted-foreground">What to work on next, chosen from the gaps your evidence shows for your goals.</p>
      </div>

      {!intelligence ? (
        <Notice title="Being updated" body="Your plan is recalculated from your evidence the next time your profile is processed." />
      ) : (
        <>
          {intelligence.roadmap ? <Roadmap roadmap={intelligence.roadmap} /> : <Notice title="No roadmap yet" body="Choose a career goal that has a competency framework." href="/settings" action="Your settings" />}
          <section aria-labelledby="recommendations">
            <h2 id="recommendations" className="mb-3 text-base font-bold text-foreground">
              Recommendations
            </h2>
            {intelligence.recommendations.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {intelligence.recommendations.map((r) => (
                  <Recommendation key={r.skill} item={r} />
                ))}
              </div>
            ) : (
              <Notice
                title="No recommendations yet"
                body={intelligence.hasEvidenceBase ? "They appear when your evidence shows a gap for your goal." : "Add a resume or connect GitHub first, so these fit you."}
                href={intelligence.hasEvidenceBase ? undefined : "/connections"}
                action={intelligence.hasEvidenceBase ? undefined : "Add evidence"}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Notice({ title, body, href, action }: { title: string; body: string; href?: string; action?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{body}</p>
      {href && action && (
        <Link href={href} className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">
          {action}
        </Link>
      )}
    </div>
  );
}

function Roadmap({ roadmap }: { roadmap: EngineRoadmap }) {
  return (
    <section aria-labelledby="roadmap" className="rounded-2xl border border-border bg-card p-5 shadow-2xs sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="roadmap" className="text-base font-bold text-foreground">
          Towards {roleLabel(roadmap.role)}
        </h2>
        <p className="text-xs text-muted-foreground">{roadmap.currentPosition ? `Now: ${roadmap.currentPosition}` : "Current position not on your profile"}</p>
      </div>
      {roadmap.alignment && (
        <p className="mt-3 text-sm font-semibold text-foreground" data-testid="learning-alignment">
          {ALIGNMENT_TEXT[roadmap.alignment]}
        </p>
      )}
      {roadmap.completed.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Already at the expected level: {roadmap.completed.join(", ")}</p>}

      {roadmap.stages.length > 0 ? (
        <ol className="mt-5 grid gap-5 lg:grid-cols-3">
          {roadmap.stages.map((stage) => (
            <li key={stage.key}>
              <h3 className="text-sm font-semibold text-foreground">{stage.title}</h3>
              {stage.optional && <p className="text-[11px] text-muted-foreground">Optional for this goal</p>}
              <ul className="mt-2 space-y-3">
                {stage.milestones.map((m) => (
                  <li key={m.skill} className="flex gap-2 text-xs">
                    {m.done ? <CheckCircle2 aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" /> : <Circle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{m.skill}</p>
                      <p className="text-muted-foreground">{m.deliverable}</p>
                      <p className="text-[11px] text-muted-foreground">Done when: {m.criterion}</p>
                      {m.requires.length > 0 && <p className="text-[11px] text-muted-foreground">After: {m.requires.join(", ")}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm font-semibold text-foreground">Every skill for this goal is at its expected level.</p>
      )}
      <p className="mt-5 border-t border-border pt-3 text-[11px] text-muted-foreground">{roadmap.assumption}</p>
    </section>
  );
}

function Recommendation({ item }: { item: LearningRecommendation }) {
  const { resource } = item;
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-2xs">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-sm font-bold text-foreground">{item.skill}</h3>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground">{item.priority}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{item.why}</p>
      <p className="mt-2 text-xs text-foreground">
        {item.currentLevel} to {item.targetLevel}
      </p>
      {item.currentEvidence.length > 0 && <p className="mt-1 truncate text-[11px] text-muted-foreground" title={item.currentEvidence.join(", ")}>Evidence so far: {item.currentEvidence.join(", ")}</p>}
      {item.prerequisites.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">Start with: {item.prerequisites.map((p) => `${p.skill}${p.met ? " (met)" : ""}`).join(", ")}</p>
      )}

      <div className="mt-3 border-t border-border pt-3 text-xs">
        {resource ? (
          <>
            <a href={resource.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 font-semibold text-primary hover:underline">
              <span>{resource.title}</span>
              <ExternalLink aria-hidden className="mt-0.5 size-3 shrink-0" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {[resource.provider, resource.difficulty, resource.duration ?? "Duration not stated"].filter(Boolean).join(" · ")}
            </p>
            <p className="text-[11px] text-muted-foreground">Link checked {resource.linkCheckedOn}{resource.linkStale ? ". Not rechecked recently, so it may have moved." : ""}</p>
          </>
        ) : (
          <p className="text-muted-foreground">We have no course we&apos;ve checked for this skill.</p>
        )}
      </div>

      <div className="mt-3 border-t border-border pt-3 text-xs">
        <p className="font-semibold text-foreground">Show it with</p>
        <p className="mt-0.5 text-muted-foreground">{item.demonstration}</p>
      </div>
      <p className="mt-auto pt-3 text-[11px] text-muted-foreground">{item.status === "in_progress" ? "In progress: some evidence found" : "Not started: no evidence yet"}</p>
    </article>
  );
}
