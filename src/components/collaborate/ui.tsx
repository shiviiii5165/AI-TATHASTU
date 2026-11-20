"use client";

import { AlertTriangle, BadgeCheck, CalendarClock, FlaskConical, GraduationCap, Laptop, Loader2, MapPin, Rocket, Trophy, Users } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import type { PublicPost } from "@/lib/collaborations/public";

import s from "./collaborate.module.css";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Collaborate's dark palette, through the app's `dark:` variant. Pair with the module's `.root` (light tokens). */
export const DARK_TOKENS =
  "dark:[--c-ink:#e6f6f8] dark:[--c-text:#dcedf0] dark:[--c-muted:#9ebcc4] dark:[--c-surface:#0e1d23] dark:[--c-surface-2:#12262d] dark:[--c-border:#1f3c45] dark:[--c-border-strong:#2b5260] dark:[--c-accent:#3cc6d2] dark:[--c-accent-strong:#66d7e0] dark:[--c-accent-soft:#123a42] dark:[--c-cyan:#48d1e2] dark:[--c-mint:#4fd6a6] dark:[--c-warn:#f2b45c] dark:[--c-warn-soft:#3a2a10] dark:[--c-danger:#ff8fa6] dark:[--c-danger-soft:#3b1520] dark:[--c-focus:#66d7e0] dark:[--c-hero-a:#061a20] dark:[--c-hero-b:#0b3640]";
export const themed = (root: string) => `${root} ${DARK_TOKENS}`;

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-focus)]";

export const btn = {
  primary: cx("inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--c-accent)] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--c-accent-strong)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 dark:text-[#06181d]", focus),
  secondary: cx("inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--c-border-strong)] bg-[var(--c-surface)] px-4 text-sm font-semibold text-[var(--c-text)] transition-colors duration-150 hover:bg-[var(--c-surface-2)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55", focus),
  ghost: cx("inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[var(--c-muted)] transition-colors duration-150 hover:bg-[var(--c-surface-2)] hover:text-[var(--c-text)] disabled:opacity-55", focus),
  danger: cx("inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--c-danger)]/40 bg-[var(--c-danger-soft)] px-4 text-sm font-semibold text-[var(--c-danger)] transition-colors duration-150 hover:border-[var(--c-danger)] disabled:opacity-55", focus),
};

export const inputCls = cx(
  "w-full min-h-10 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-text)] placeholder:text-[var(--c-muted)]/80 aria-[invalid=true]:border-[var(--c-danger)]",
  "focus-visible:border-[var(--c-accent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--c-focus)]",
);

export const CATEGORY_ICON: Record<PublicPost["category"], ComponentType<{ className?: string }>> = {
  project: Rocket,
  hackathon: Trophy,
  research: FlaskConical,
  learning_group: GraduationCap,
};

export const MODE_LABEL: Record<PublicPost["mode"], string> = { remote: "Remote", hybrid: "Hybrid", in_person: "In person" };
export const STAGE_LABEL: Record<PublicPost["stage"], string> = { idea: "Idea", planning: "Planning", prototype: "Prototype", building: "Building", launched: "Launched" };

const STATUS_TONE: Partial<Record<PublicPost["status"], string>> = {
  recruiting: "bg-[var(--c-accent-soft)] text-[var(--c-accent-strong)]",
  team_full: "bg-[var(--c-surface-2)] text-[var(--c-text)]",
  in_progress: "bg-[var(--c-surface-2)] text-[var(--c-text)]",
  paused: "bg-[var(--c-warn-soft)] text-[var(--c-warn)]",
  expired: "bg-[var(--c-warn-soft)] text-[var(--c-warn)]",
  suspended: "bg-[var(--c-danger-soft)] text-[var(--c-danger)]",
};

export function StatusBadge({ status, label }: { status: PublicPost["status"]; label: string }) {
  return <span className={cx("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold", STATUS_TONE[status] ?? "bg-[var(--c-surface-2)] text-[var(--c-muted)]")}>{label}</span>;
}

export function CreatorBadge({ creator }: { creator: PublicPost["creator"] }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--c-muted)]">
      {creator.verified && <BadgeCheck aria-hidden className="size-3.5 text-[var(--c-accent)]" />}
      {creator.label}
      {creator.verified && <span className="sr-only"> (verified by AI Tathastu)</span>}
    </span>
  );
}

export function Initials({ name, size = "size-7" }: { name: string; size?: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "AT";
  return <span aria-hidden className={cx(size, "inline-flex shrink-0 items-center justify-center rounded-full border-2 border-[var(--c-surface)] bg-[var(--c-accent-soft)] text-[10px] font-bold text-[var(--c-accent-strong)]")}>{initials}</span>;
}

/** Filled seats as dots, so team shape reads at a glance. */
export function Seats({ members, capacity }: { members: number; capacity: number }) {
  const shown = Math.min(capacity, 10);
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`${members} of ${capacity} positions filled`}>
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: shown }, (_, i) => (
          <span key={i} className={cx("size-2 rounded-full", i < Math.min(members, shown) ? "bg-[var(--c-accent)]" : "border border-[var(--c-border-strong)]")} />
        ))}
      </span>
      <span className="text-[11px] font-semibold tabular-nums text-[var(--c-muted)]">{members}/{capacity}</span>
    </span>
  );
}

export const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
export const fmtAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export function PostCard({ p, onOpen, footer }: { p: PublicPost; onOpen: (id: string) => void; footer?: ReactNode }) {
  const Icon = CATEGORY_ICON[p.category];
  return (
    <li className={cx(s.card, s.enter, "relative flex flex-col rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-offset-2 has-[button:focus-visible]:outline-[var(--c-focus)]")}>
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-accent-soft)] px-2 py-1 text-[11px] font-bold text-[var(--c-accent-strong)]">
          <Icon aria-hidden className="size-3.5" /> {p.categoryLabel}
        </span>
        <StatusBadge status={p.status} label={p.statusLabel} />
      </div>
      <h3 className="mt-3 text-[15px] font-bold leading-snug text-[var(--c-ink)]">
        <button type="button" onClick={() => onOpen(p.id)} className="text-left after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none">
          {p.title}
        </button>
      </h3>
      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--c-muted)]">{p.summary}</p>
      {p.roles.length > 0 && (
        <p className="mt-3 text-xs text-[var(--c-text)]">
          <span className="font-semibold">Looking for: </span>
          {p.roles.slice(0, 3).map((r) => `${r.title}${r.count > 1 ? ` ×${r.count}` : ""}`).join(", ")}
          {p.roles.length > 3 ? ` +${p.roles.length - 3} more` : ""}
        </p>
      )}
      {p.skills.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label="Skills">
          {p.skills.slice(0, 5).map((sk) => (
            <li key={sk} className="rounded-md border border-[var(--c-border)] px-1.5 py-0.5 text-[11px] text-[var(--c-muted)]">{sk}</li>
          ))}
        </ul>
      )}
      <div className="mt-auto pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--c-border)] pt-3">
          <span className="flex min-w-0 items-center gap-2">
            <Initials name={p.creator.name} />
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-[var(--c-text)]">{p.creator.name}</span>
              <CreatorBadge creator={p.creator} />
            </span>
          </span>
          <Seats members={p.members} capacity={p.capacity} />
        </div>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--c-muted)]">
          <span className="inline-flex items-center gap-1">{p.mode === "remote" ? <Laptop aria-hidden className="size-3" /> : <MapPin aria-hidden className="size-3" />}{MODE_LABEL[p.mode]}{p.location && p.mode !== "remote" ? ` · ${p.location}` : ""}</span>
          <span className="inline-flex items-center gap-1"><Users aria-hidden className="size-3" />{STAGE_LABEL[p.stage]}</span>
          {p.deadline && <span className="inline-flex items-center gap-1 font-semibold text-[var(--c-warn)]"><CalendarClock aria-hidden className="size-3" />Apply by {fmtDay(p.deadline)}</span>}
        </p>
        {footer && <div className="relative z-10 mt-3">{footer}</div>}
      </div>
    </li>
  );
}

export function StateBox({ tone = "empty", title, body, action }: { tone?: "empty" | "error"; title: string; body?: string; action?: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-2xl px-5 py-8 text-center", tone === "error" ? "border border-[var(--c-danger)]/30 bg-[var(--c-danger-soft)]" : "border border-dashed border-[var(--c-border-strong)] bg-[var(--c-surface)]")}>
      {tone === "error" && <AlertTriangle aria-hidden className="mx-auto mb-2 size-5 text-[var(--c-danger)]" />}
      <p className="text-sm font-bold text-[var(--c-ink)]">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-[var(--c-muted)]">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading collaborations">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="h-60 animate-pulse rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 motion-reduce:animate-none">
          <div className="h-5 w-24 rounded bg-[var(--c-surface-2)]" />
          <div className="mt-4 h-4 w-3/4 rounded bg-[var(--c-surface-2)]" />
          <div className="mt-2 h-3 w-full rounded bg-[var(--c-surface-2)]" />
          <div className="mt-1 h-3 w-2/3 rounded bg-[var(--c-surface-2)]" />
        </li>
      ))}
    </ul>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-xs text-[var(--c-muted)]">
      <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> {label}…
    </span>
  );
}

export function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return <p id={id} className="mt-1 text-xs font-medium text-[var(--c-danger)]">{msg}</p>;
}

export function Banner({ tone, children }: { tone: "ok" | "error" | "info"; children: ReactNode }) {
  const cls = { ok: "border-[var(--c-mint)]/40 bg-[var(--c-accent-soft)] text-[var(--c-accent-strong)]", error: "border-[var(--c-danger)]/30 bg-[var(--c-danger-soft)] text-[var(--c-danger)]", info: "border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-text)]" }[tone];
  return <p role={tone === "error" ? "alert" : "status"} className={cx("rounded-xl border px-3 py-2 text-xs font-medium", cls)}>{children}</p>;
}
