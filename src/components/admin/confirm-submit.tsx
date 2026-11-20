"use client";

import type { ReactNode } from "react";

/** A submit button that asks for confirmation first; cancelling submits nothing. */
export function ConfirmSubmit({ message, className, children, ariaLabel }: { message: string; className?: string; children: ReactNode; ariaLabel?: string }) {
  return (
    <button
      type="submit"
      aria-label={ariaLabel}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
