"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

interface ThemeToggleButtonProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ThemeToggleButton({ className, size = "md" }: ThemeToggleButtonProps) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "flex items-center justify-center rounded-full border border-border bg-card text-foreground shadow-xs hover:bg-accent transition-colors cursor-pointer touch-manipulation",
        size === "sm" ? "size-9 min-h-[36px] min-w-[36px]" : "size-10 min-h-[44px] min-w-[44px]",
        className
      )}
      aria-label="Toggle color theme"
    >
      <Sun className="size-4 text-[#F59E0B] dark:hidden" />
      <Moon className="size-4 text-[#B69CFF] hidden dark:block" />
    </button>
  );
}
