"use client";

import {
  Building2,
  FileText,
  Mic,
  Minus,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { ContinueButton, StepFooter } from "@/components/onboarding/continue-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERSONA_FORMS, type FieldDef, type FormValues, type PersonaFormState, type PersonaFormStep } from "@/lib/onboarding/personas";
import type { WizardStep } from "@/lib/onboarding/steps";
import { cn } from "@/lib/utils";

/**
 * A faculty or alumni step rendered from its definition in
 * src/lib/onboarding/personas.ts; the server action validates against the
 * same definition. Errors come back per field, and focus moves to the first.
 */
export function PersonaStepForm({
  step,
  action,
  initialValues,
  backStep,
}: {
  step: PersonaFormStep;
  action: (prev: PersonaFormState, formData: FormData) => Promise<PersonaFormState>;
  initialValues: FormValues;
  backStep: WizardStep | "role";
}) {
  const fields = PERSONA_FORMS[step] as readonly FieldDef[];
  const [state, formAction, pending] = useActionState(action, { values: initialValues });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const first = fields.find((f) => state.errors?.[f.name]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[data-field="${first.name}"]`)?.focus();
  }, [state.errors, fields]);

  return (
    <form ref={formRef} action={formAction} noValidate className="mt-6 sm:mt-8">
      <div className="grid max-w-3xl gap-x-6 gap-y-6 sm:grid-cols-2">
        {fields.map((f) => (
          <FieldControl key={f.name} field={f} value={state.values[f.name] ?? ""} error={state.errors?.[f.name]} />
        ))}
      </div>
      <StepFooter backStep={backStep} error={state.formError}>
        <ContinueButton pending={pending} />
      </StepFooter>
    </form>
  );
}

function getFieldIcon(name: string) {
  switch (name) {
    case "canVerifyEris":
      return <ShieldCheck className="size-5 text-purple-600" />;
    case "canReviewResumes":
      return <FileText className="size-5 text-blue-600" />;
    case "mentor":
      return <Users className="size-5 text-amber-600" />;
    case "refer":
      return <Building2 className="size-5 text-emerald-600" />;
    case "speak":
      return <Mic className="size-5 text-rose-600" />;
    default:
      return null;
  }
}

function getFieldIconBg(name: string) {
  switch (name) {
    case "canVerifyEris":
      return "bg-purple-50 border-purple-100";
    case "canReviewResumes":
      return "bg-blue-50 border-blue-100";
    case "mentor":
      return "bg-amber-50 border-amber-100";
    case "refer":
      return "bg-emerald-50 border-emerald-100";
    case "speak":
      return "bg-rose-50 border-rose-100";
    default:
      return "bg-slate-50 border-slate-100";
  }
}

function CheckboxFieldControl({
  field: f,
  value,
  common,
}: {
  field: FieldDef;
  value: string;
  common: Record<string, unknown>;
}) {
  const icon = getFieldIcon(f.name);
  const iconBg = getFieldIconBg(f.name);
  const [checked, setChecked] = useState(value === "on");

  return (
    <label
      htmlFor={f.name}
      className={cn(
        "flex cursor-pointer items-start justify-between gap-4 rounded-3xl border p-5 sm:p-6 shadow-xs transition-all duration-150 select-none",
        f.wide && "sm:col-span-2",
        checked
          ? "border-[#FF2A85] bg-rose-50/20 ring-1 ring-[#FF2A85]/20 shadow-xs"
          : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs"
      )}
    >
      <div className="flex items-start gap-4 min-w-0">
        {icon && (
          <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl border shadow-xs", iconBg)}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <span className="block text-sm sm:text-base font-bold text-[#0F172A] leading-snug">
            {f.label}
          </span>
          {f.hint && (
            <p id={`${f.name}-hint`} className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-500">
              {f.hint}
            </p>
          )}
        </div>
      </div>
      <div className="shrink-0 pt-0.5">
        <Checkbox
          {...common}
          name={f.name}
          value="on"
          checked={checked}
          onCheckedChange={(c) => setChecked(Boolean(c))}
          className="size-5.5 rounded-lg border-slate-300 data-[state=checked]:bg-[#FF2A85] data-[state=checked]:border-[#FF2A85] data-[state=checked]:text-white transition-all shadow-2xs"
        />
      </div>
    </label>
  );
}

function NumberFieldControl({
  field: f,
  value,
  error,
  common,
}: {
  field: FieldDef;
  value: string;
  error?: string;
  common: Record<string, unknown>;
}) {
  const min = f.min ?? 0;
  const max = f.max ?? 50;
  const initialNum = value === "" ? 0 : Number(value) || 0;
  const [numVal, setNumVal] = useState<number>(initialNum);
  const presets = [0, 1, 2, 3, 5, 10];

  return (
    <div className={cn(f.wide && "sm:col-span-2", "rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Label htmlFor={f.name} className="font-heading text-base sm:text-lg font-bold text-[#0F172A] leading-snug">
            {f.label}
          </Label>
          {f.hint && (
            <p id={`${f.name}-hint`} className="mt-1 text-xs sm:text-sm text-slate-500">
              {f.hint}
            </p>
          )}
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-1 font-mono text-xs font-semibold text-slate-700">
          {numVal === 0 ? "Not taking mentees (0)" : `${numVal} active ${numVal === 1 ? "mentee" : "mentees"}`}
        </span>
      </div>

      {/* Stepper + Input */}
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setNumVal((prev) => Math.max(min, prev - 1))}
          disabled={numVal <= min}
          aria-label="Decrease capacity"
          className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Minus className="size-4" />
        </button>

        <div className="relative w-32">
          <Input
            {...common}
            name={f.name}
            value={numVal}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) setNumVal(Math.min(max, Math.max(min, v)));
              else if (e.target.value === "") setNumVal(0);
            }}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50/50 text-center font-heading text-lg font-bold text-[#0F172A] shadow-xs focus-visible:bg-white focus-visible:border-[#FF2A85] focus-visible:ring-2 focus-visible:ring-[#FF2A85]/20"
          />
        </div>

        <button
          type="button"
          onClick={() => setNumVal((prev) => Math.min(max, prev + 1))}
          disabled={numVal >= max}
          aria-label="Increase capacity"
          className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {/* Quick presets */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">Quick set:</span>
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setNumVal(p)}
            className={cn(
              "h-7 px-3 rounded-lg text-xs font-semibold transition-all shadow-2xs",
              numVal === p
                ? "bg-[#0F172A] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            )}
          >
            {p === 0 ? "0 (None)" : `${p} ${p === 1 ? "student" : "students"}`}
          </button>
        ))}
      </div>

      {error && (
        <p id={`${f.name}-error`} className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function FieldControl({ field: f, value, error }: { field: FieldDef; value: string; error?: string }) {
  const [selected, setSelected] = useState(value);
  const describedBy = [error && `${f.name}-error`, f.hint && `${f.name}-hint`].filter(Boolean).join(" ") || undefined;
  const common = {
    id: f.name,
    "data-field": f.name,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };

  if (f.type === "checkbox") {
    return <CheckboxFieldControl field={f} value={value} common={common} />;
  }

  if (f.type === "number") {
    return <NumberFieldControl field={f} value={value} error={error} common={common} />;
  }

  return (
    <div className={cn(f.wide && "sm:col-span-2")}>
      <Label htmlFor={f.name} className="text-xs font-bold uppercase tracking-wider text-slate-700">
        {f.label}
        {!f.required && <span className="ml-1 font-normal text-slate-400 lowercase">(optional)</span>}
      </Label>
      {f.type === "select" ? (
        <Select name={f.name} value={selected || undefined} onValueChange={setSelected}>
          <SelectTrigger {...common} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-base md:text-sm text-[#0F172A] shadow-xs focus-visible:border-[#FF2A85] focus-visible:ring-2 focus-visible:ring-[#FF2A85]/20">
            <SelectValue placeholder={f.placeholder ?? "Select"} />
          </SelectTrigger>
          <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-xl">
            {f.options!.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-sm">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          {...common}
          name={f.name}
          defaultValue={value}
          type="text"
          maxLength={f.maxLength}
          placeholder={f.placeholder}
          autoComplete={f.autoComplete}
          required={f.required}
          className="mt-1.5 h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-base md:text-sm text-[#0F172A] shadow-xs placeholder:text-slate-400 focus-visible:border-[#FF2A85] focus-visible:ring-2 focus-visible:ring-[#FF2A85]/20"
        />
      )}
      {f.hint && (
        <p id={`${f.name}-hint`} className="mt-1.5 text-xs text-slate-500">
          {f.hint}
        </p>
      )}
      {error && (
        <p id={`${f.name}-error`} className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
