import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  withTagline?: boolean;
  href?: string;
  size?: "sm" | "md" | "lg";
  taglineClassName?: string;
}

export function BrandLogo({
  className,
  withTagline = true,
  href,
  size = "md",
  taglineClassName,
}: BrandLogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-3 select-none", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "grid place-items-center rounded-xl font-heading font-extrabold text-white shadow-sm transition-transform duration-150 group-hover:scale-105",
          "bg-gradient-to-br from-[#FF6B4A] via-[#FF2A85] to-[#9333EA]",
          size === "sm" && "size-7 text-xs rounded-lg shadow-[0_2px_8px_rgba(255,42,133,0.3)]",
          size === "md" && "size-9 text-sm rounded-xl shadow-[0_4px_12px_rgba(255,42,133,0.35)]",
          size === "lg" && "size-11 text-base rounded-2xl shadow-[0_6px_16px_rgba(255,42,133,0.4)]"
        )}
      >
        AT
      </span>
      <span className="flex flex-col leading-tight">
        <span
          className={cn(
            "font-sans font-extrabold tracking-tight text-[#0F172A] transition-colors group-hover:text-[#FF2A85]",
            size === "sm" && "text-base",
            size === "md" && "text-lg",
            size === "lg" && "text-2xl"
          )}
        >
          AI Tathastu<span className="text-[#FF2A85]">.</span>
        </span>
        {withTagline && (
          <span
            className={cn(
              "font-sans font-medium text-slate-500 hidden min-[400px]:block",
              size === "sm" ? "text-[0.625rem]" : "text-xs",
              taglineClassName
            )}
          >
            The mind behind your work
          </span>
        )}
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="group inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
}
