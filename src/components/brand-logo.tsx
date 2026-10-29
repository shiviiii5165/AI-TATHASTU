import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  withTagline?: boolean;
  href?: string;
  size?: "sm" | "md" | "lg";
  taglineClassName?: string;
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
}: BrandLogoProps) {
  const currentSize = SIZES[size] || SIZES.md;

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
      <span className="flex flex-col leading-tight">
        <span
          className={cn(
            "font-sans font-extrabold tracking-tight text-[#0F172A] dark:text-white transition-colors group-hover:text-[#FF2A85]",
            currentSize.titleClass
          )}
        >
          AI Tathastu<span className="text-[#FF2A85]">.</span>
        </span>
        {withTagline && (
          <span
            className={cn(
              "font-sans font-medium text-slate-500 dark:text-slate-400 hidden min-[400px]:block",
              currentSize.taglineClass,
              taglineClassName
            )}
          >
            You imagine. AI Tathastu makes it happen.
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
