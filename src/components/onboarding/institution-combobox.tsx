"use client";

import { Check, ChevronsUpDown, CircleAlert, LoaderCircle, Plus, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type InstitutionOption = { id: string; name: string; city: string | null; state: string | null; countryCode: string | null };
export type InstitutionValue = InstitutionOption | { other: true } | null;

const DEBOUNCE_MS = 200;
const OTHER_ID = "other";

function track(properties: Record<string, unknown>) {
  // Fire-and-forget; analytics never blocks the form.
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "institution_select", properties }),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Searchable institution picker (WAI-ARIA 1.2 combobox with a listbox popup).
 * Type to search names and aliases ("LPU", "IIT Bombay"); ↓/↑ move, Enter
 * picks, Escape closes (and restores the last pick), Tab leaves. The last
 * option is always "Other / Not listed".
 */
export function InstitutionCombobox({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  allowOther = true,
}: {
  id: string;
  // false: only catalogue entries (admin merge target).
  allowOther?: boolean;
  value: InstitutionValue;
  onChange: (value: InstitutionValue) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const listboxId = useId();
  const selectedName = value && "id" in value ? value.name : value ? "Other / Not listed" : "";
  const [query, setQuery] = useState(selectedName);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<InstitutionOption[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searched, setSearched] = useState("");

  // Debounced search; a newer query aborts the older request.
  useEffect(() => {
    const q = query.trim();
    if (!open || !q || q === selectedName) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/academic/institutions?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { results: InstitutionOption[] };
        setSearched(q);
        setResults(body.results);
        setActive(0);
        setStatus("done");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, selectedName]);

  const typed = query.trim().length > 0 && query.trim() !== selectedName;
  const options: (InstitutionOption | { id: typeof OTHER_ID })[] = [...(typed ? results : []), ...(allowOther ? [{ id: OTHER_ID } as const] : [])];

  function pick(index: number) {
    const option = options[index];
    if (!option) return;
    if (option.id === OTHER_ID) {
      onChange({ other: true });
      setQuery("Other / Not listed");
      track({ other: true, queryLength: query.trim().length });
    } else {
      const o = option as InstitutionOption;
      onChange(o);
      setQuery(o.name);
      track({ institutionId: o.id, rank: index, queryLength: query.trim().length });
    }
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) setOpen(true);
        if (options.length) setActive((i) => (i + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) setOpen(true);
        setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
        break;
      case "Enter":
        if (open && active >= 0) {
          e.preventDefault(); // pick, don't submit the form
          pick(active);
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
          setQuery(selectedName);
        } else if (query) {
          setQuery("");
          onChange(null);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  const activeId = open && active >= 0 && options[active] ? `${listboxId}-${options[active].id}` : undefined;
  const announce =
    !open || !typed
      ? ""
      : status === "loading"
        ? "Searching…"
        : status === "error"
          ? "Search isn't available. Choose Other / Not listed to type it in."
          : status === "done"
            ? results.length
              ? `${results.length} ${results.length === 1 ? "result" : "results"}. Use the arrow keys to choose.`
              : `No institution matches “${searched}”. Choose Other / Not listed to add it.`
            : "";

  return (
    <div className="relative mt-2">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        id={id}
        name="institutionQuery"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        data-field="institution"
        autoComplete="off"
        spellCheck={false}
        value={query}
        placeholder="Search by name or short name, e.g. IIT Bombay, LPU"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
          if (value) onChange(null); // typing replaces the earlier pick
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={cn(
          "h-11 w-full rounded-xl border border-slate-200 bg-white pr-9 pl-10 text-base sm:text-sm text-[#0F172A] shadow-xs outline-none transition-colors",
          "placeholder:text-slate-400 focus-visible:border-[#FF5A5F] focus-visible:ring-2 focus-visible:ring-[#FF5A5F]/20",
          "aria-invalid:border-rose-500 aria-invalid:ring-2 aria-invalid:ring-rose-500/20",
        )}
      />
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-400">
        {status === "loading" && open ? <LoaderCircle className="size-4 animate-spin text-[#FF2A85]" /> : <ChevronsUpDown className="size-4" />}
      </span>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Institutions"
          className="absolute z-30 mt-1.5 max-h-80 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 text-[#0F172A] shadow-xl"
        >
          {!typed && (
            <li role="presentation" className="px-3 py-2 text-sm text-muted-foreground">
              Start typing your institution&apos;s name.
            </li>
          )}
          {typed && status === "loading" && results.length === 0 && (
            <li role="presentation" className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <LoaderCircle aria-hidden className="size-4 animate-spin" /> Searching…
            </li>
          )}
          {typed && status === "done" && results.length === 0 && (
            <li role="presentation" className="px-3 py-2 text-sm text-muted-foreground">
              No match for “{searched}”.
            </li>
          )}
          {typed && status === "error" && (
            <li role="presentation" className="flex items-center gap-2 px-3 py-2 text-sm text-destructive">
              <CircleAlert aria-hidden className="size-4" /> Search isn&apos;t available right now.
            </li>
          )}
          {options.map((o, i) => {
            const isOther = o.id === OTHER_ID;
            const selected = isOther ? Boolean(value && !("id" in value)) : Boolean(value && "id" in value && value.id === o.id);
            const opt = o as InstitutionOption;
            return (
              <li
                key={o.id}
                id={`${listboxId}-${o.id}`}
                role="option"
                aria-selected={selected}
                // mousedown and touchstart keep focus in the input so blur doesn't close the list first
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                onClick={() => pick(i)}
                onMouseMove={() => setActive(i)}
                className={cn(
                  "flex min-h-[44px] cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm touch-manipulation",
                  i === active && "bg-accent text-accent-foreground",
                  isOther && "mt-1 border-t pt-2.5",
                )}
              >
                {isOther ? <Plus aria-hidden className="mt-0.5 size-4 shrink-0" /> : <Check aria-hidden className={cn("mt-0.5 size-4 shrink-0", !selected && "invisible")} />}
                <span className="min-w-0">
                  <span className="block font-medium">{isOther ? "Other / Not listed" : opt.name}</span>
                  {!isOther && (
                    <span className="block text-xs text-muted-foreground">{[opt.city, opt.state, opt.countryCode].filter(Boolean).join(", ")}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
