import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  withTagline?: boolean;
  href?: string;
  size?: "sm" | "md" | "lg";
  taglineClassName?: string;
  /**
   * "auto" (default) follows the light/dark theme. "onLight" keeps the light-theme colours in both
   * themes, for a logo placed on an always-light surface such as the login page photograph.
   */
  tone?: "auto" | "onLight";
  /** Show only the mark below the `sm` breakpoint (crowded mobile headers); the wordmark returns at sm+. */
  compactOnMobile?: boolean;
}

const SIZES = {
  sm: { dimension: 32, className: "size-8", titleClass: "text-base", taglineClass: "text-[0.625rem]" },
  md: { dimension: 40, className: "size-10", titleClass: "text-lg", taglineClass: "text-xs" },
  lg: { dimension: 48, className: "size-12", titleClass: "text-2xl", taglineClass: "text-xs" },
};

export function BrandLogo({
  className,
  withTagline = true,
  href,
  size = "md",
  taglineClassName,
  tone = "auto",
  compactOnMobile = false,
}: BrandLogoProps) {
  const currentSize = SIZES[size] || SIZES.md;
  const onLight = tone === "onLight";

  const content = (
    <span className={cn("inline-flex items-center gap-3 select-none", className)}>
      <Image
        src="/icons/icon-192.png"
        alt="AI Tathastu"
        width={currentSize.dimension}
        height={currentSize.dimension}
        priority
        className={cn(
          "shrink-0 object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-105",
          currentSize.className
        )}
      />
      <span className={cn("flex-col leading-tight", compactOnMobile ? "hidden sm:flex" : "flex")}>
        <span
          className={cn(
            "font-sans font-extrabold tracking-tight text-[#0F172A] transition-colors group-hover:text-[#FF2A85]",
            !onLight && "dark:text-white",
            currentSize.titleClass
          )}
        >
          AI Tathastu<span className="text-[#FF2A85]">.</span>
        </span>
        {withTagline && (
          <span
            className={cn(
              "font-sans font-medium text-slate-500 hidden min-[400px]:block tracking-tight",
              !onLight && "dark:text-slate-400",
              currentSize.taglineClass,
              taglineClassName
            )}
          >
            Your Dreams. Our Intelligence.{" "}
            <span className={cn("font-semibold text-slate-800", !onLight && "dark:text-slate-200")}>Tathastu.</span>
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
