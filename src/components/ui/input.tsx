import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-base md:text-sm text-[#0F172A] shadow-xs transition-colors outline-none",
        "placeholder:text-slate-400 focus-visible:border-[#FF5A5F] focus-visible:ring-2 focus-visible:ring-[#FF5A5F]/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200",
        "aria-invalid:border-rose-500 aria-invalid:ring-2 aria-invalid:ring-rose-500/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
