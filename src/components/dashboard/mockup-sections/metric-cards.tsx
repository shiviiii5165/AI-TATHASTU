"use client";

import { Award, Briefcase, Box, Layers, Target, Users } from "lucide-react";
import Link from "next/link";

interface MetricCardsProps {
  profilePercent?: number;
  skillsCount?: number;
  githubReposCount?: number;
  achievementsCount?: number;
  opportunitiesCount?: number;
  networkCount?: number;
}

export function MetricCards({
  profilePercent = 0,
  skillsCount = 0,
  githubReposCount = 0,
  achievementsCount = 0,
  opportunitiesCount = 0,
  networkCount = 0,
}: MetricCardsProps) {
  const metrics = [
    {
      id: "profile",
      icon: Target,
      value: `${profilePercent}%`,
      label: "Profile Complete",
      sublabel: null,
      iconBg: "bg-[#E8FAF4] text-[#19C58A]",
      href: "/profile",
    },
    {
      id: "skills",
      icon: Layers,
      value: `${skillsCount}`,
      label: "Skills Identified",
      sublabel: null,
      iconBg: "bg-[#EDF5FF] text-[#2878F0]",
      href: "/skills",
    },
    {
      id: "github",
      icon: Box,
      value: `${githubReposCount}`,
      label: "From GitHub",
      sublabel: null,
      iconBg: "bg-[#F3EFFF] text-[#8554FF]",
      href: "/projects",
    },
    {
      id: "achievements",
      icon: Award,
      value: `${achievementsCount}`,
      label: "Achievements",
      sublabel: "Publications, Patents, etc.",
      iconBg: "bg-[#FFF6E9] text-[#FFB547]",
      href: "/achievements",
    },
    {
      id: "opportunities",
      icon: Briefcase,
      value: `${opportunitiesCount}`,
      label: "Opportunities",
      sublabel: null,
      iconBg: "bg-[#FFF0F4] text-[#FF496D]",
      href: "/opportunities",
    },
    {
      id: "network",
      icon: Users,
      value: `${networkCount}`,
      label: "People to Discover",
      sublabel: null,
      iconBg: "bg-[#E6F8FB] text-[#00AEC7]",
      href: "/people",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <Link
            key={m.id}
            href={m.href}
            className="group relative flex items-center gap-2 sm:gap-3 rounded-2xl border border-border bg-card p-2.5 sm:p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#8554FF]/40 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8554FF]/40 touch-manipulation text-card-foreground"
          >
            <div
              className={`flex size-8.5 sm:size-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${m.iconBg}`}
            >
              <Icon className="size-4 sm:size-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="text-base sm:text-2xl font-bold font-sans tabular-nums text-foreground leading-none tracking-tight">
                {m.value}
              </div>
              <div className="mt-1 line-clamp-2 text-[10.5px] sm:text-xs font-semibold text-muted-foreground leading-tight">
                {m.label}
              </div>
              {m.sublabel && (
                <div className="truncate text-[10px] text-muted-foreground">
                  {m.sublabel}
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
