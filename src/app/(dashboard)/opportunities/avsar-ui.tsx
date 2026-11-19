"use client";

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { RotateCw } from "lucide-react";

import s from "./avsar.module.css";

/** AVSAR's signature briefcase. Pure SVG + CSS; fixed box so it never shifts layout. */
export function AvsarBriefcase({ size = 220, decorative = true }: { size?: number; decorative?: boolean }) {
  // Unique gradient ids: two briefcases can be in the DOM at once (one hidden per breakpoint).
  const uid = useId().replace(/:/g, "");
  const body = `avsar-body-${uid}`, flap = `avsar-flap-${uid}`, glow = `avsar-glow-${uid}`;
  return (
    <svg
      width="100%"
      height="100%"
      style={{ maxWidth: size, maxHeight: size }}
      viewBox="0 0 240 240"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      className="block shrink-0 overflow-visible"
    >
      <defs>
        <linearGradient id={body}x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3B6FE0" />
          <stop offset="60%" stopColor="#5B4FE0" />
          <stop offset="100%" stopColor="#7C4DDB" />
        </linearGradient>
        <linearGradient id={flap}x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={glow}cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8B7CFF" stopOpacity="0.35" />
          <stop offset="55%" stopColor="#14B8A6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="120" cy="118" r="104" fill={`url(#${glow})`} className={s.glow} />
      <ellipse cx="120" cy="206" rx="62" ry="7" fill="#1E2A4A" className={s.shadow} />

      {/* Small opportunity accents: teal check, amber star, coral dot */}
      <g className={s.chip}>
        <rect x="22" y="58" width="34" height="34" rx="10" fill="#ffffff" stroke="#E7EAF3" />
        <path d="M31 75l5 5 10-11" fill="none" stroke="#0F9F8A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className={`${s.chip} ${s.chipDelay}`}>
        <rect x="186" y="44" width="32" height="32" rx="10" fill="#ffffff" stroke="#E7EAF3" />
        <path d="M202 51l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6-4.5-4.1 6-.7z" fill="#F59E0B" />
      </g>
      <circle cx="200" cy="150" r="5" fill="#F0506E" className={`${s.chip} ${s.chipDelay}`} />

      <g className={s.float}>
        {/* Handle */}
        <path d="M94 72v-12a12 12 0 0 1 12-12h28a12 12 0 0 1 12 12v12" fill="none" stroke="#2A3558" strokeWidth="9" strokeLinecap="round" />
        {/* Body */}
        <rect x="44" y="70" width="152" height="118" rx="20" fill={`url(#${body})`} />
        {/* Lid seam and sheen */}
        <rect x="44" y="70" width="152" height="52" rx="20" fill={`url(#${flap})`} />
        <path d="M44 120h152" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2" />
        {/* Latch */}
        <g className={s.latch}>
          <rect x="106" y="110" width="28" height="22" rx="6" fill="#FBBF24" />
          <rect x="114" y="117" width="12" height="7" rx="2" fill="#B45309" opacity="0.55" />
        </g>
        {/* Highlight */}
        <path d="M60 84c10-6 26-8 40-8" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="4" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

/** Re-runs the server fetch for this page without a full reload. */
export function RetryButton({ label = "Try again" }: { label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => router.refresh())}
      disabled={pending}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#E7EAF3] bg-white px-3.5 py-2 text-xs font-semibold text-[#11182B] transition-colors hover:border-[#1D5FC4]/40 hover:text-[#1D5FC4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D5FC4] active:bg-[#F4F6F9] disabled:cursor-wait disabled:opacity-60"
    >
      <RotateCw aria-hidden className={`size-3.5 ${pending ? "animate-spin motion-reduce:animate-none" : ""}`} />
      {pending ? "Retrying…" : label}
    </button>
  );
}
