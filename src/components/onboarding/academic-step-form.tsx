"use client";

import { Sparkles } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { AcademicFields, Field, type AcademicCatalog, type AcademicMode } from "@/components/onboarding/academic-fields";
import { ContinueButton, StepFooter } from "@/components/onboarding/continue-form";
import type { InstitutionValue } from "@/components/onboarding/institution-combobox";
import { FieldControl } from "@/components/onboarding/persona-step-form";
import { SaveStatusText } from "@/components/onboarding/save-status";
import { Input } from "@/components/ui/input";
import { useAutosave } from "@/hooks/use-autosave";
import type { SaveResult } from "@/app/onboarding/actions";
import type { FieldDef } from "@/lib/onboarding/personas";
import type { WizardStep } from "@/lib/onboarding/steps";

export type AcademicFormState = { values: Record<string, string>; errors?: Partial<Record<string, string>>; formError?: string };

/**
 * Step 1 of every persona: name, the shared academic block, and any persona
 * fields (department and title for faculty). Same component, same server
 * validation, for students, faculty and alumni.
 */
export function AcademicStepForm({
  action,
  initialValues,
  initialInstitution,
  catalog,
  mode,
  degreeLabel,
  extraFields = [],
  backStep,
  saveName,
}: {
  action: (prev: AcademicFormState, formData: FormData) => Promise<AcademicFormState>;
  initialValues: Record<string, string>;
  initialInstitution: InstitutionValue;
  catalog: AcademicCatalog;
  mode: AcademicMode;
  degreeLabel?: string;
  extraFields?: readonly FieldDef[];
  backStep: WizardStep | "role";
  saveName?: (value: string) => Promise<SaveResult>;
}) {
  const [state, formAction, pending] = useActionState(action, { values: initialValues });
  const autosave = useAutosave(saveName ?? (async () => ({ ok: true as const })));
  const lastName = useRef(initialValues.fullName ?? "");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const fields = [...(formRef.current?.querySelectorAll<HTMLElement>("[data-field]") ?? [])];
    const first = fields.find((el) => state.errors?.[el.dataset.field!]);
    first?.focus();
  }, [state.errors]);

  return (
    <form ref={formRef} action={formAction} noValidate className="mt-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] xl:grid-cols-[minmax(0,1.4fr)_18rem]">
        {/* Left: Form Fields */}
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <Field label="Full name" field="fullName" error={state.errors?.fullName} className="sm:col-span-2">
            <Input
              id="fullName"
              name="fullName"
              data-field="fullName"
              defaultValue={state.values.fullName}
              autoComplete="name"
              maxLength={120}
              placeholder="e.g. Anant Kumar"
              aria-invalid={state.errors?.fullName ? true : undefined}
              aria-describedby={state.errors?.fullName ? "fullName-error" : undefined}
              className="mt-1.5 h-11 rounded-xl border-slate-200 text-base md:text-sm shadow-xs transition-colors focus-visible:border-[#FF2A85] focus-visible:ring-2 focus-visible:ring-[#FF2A85]/20"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (saveName && v !== lastName.current) {
                  lastName.current = v;
                  void autosave.save(v);
                }
              }}
            />
          </Field>

          <AcademicFields
            mode={mode}
            catalog={catalog}
            values={state.values}
            errors={state.errors}
            initialInstitution={initialInstitution}
            degreeLabel={degreeLabel}
          />

          {extraFields.map((f) => (
            <FieldControl key={f.name} field={f} value={state.values[f.name] ?? ""} error={state.errors?.[f.name]} />
          ))}
        </div>

        {/* Right: "A better profile" Guidance Card from reference */}
        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-6 shadow-xs">
            <h3 className="font-heading text-sm font-bold text-amber-950 flex items-center gap-2">
              <Sparkles className="size-4 text-[#FF2A85]" />
              A better profile
            </h3>
            <ul className="mt-3.5 space-y-2.5 text-xs font-medium text-amber-900">
              <li className="flex items-start gap-2">
                <span className="text-[#FF2A85] font-bold">✦</span>
                <span>More relevant opportunities tailored to your college & degree</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FF2A85] font-bold">✦</span>
                <span>Better recommendations for mentors, hackathons & research</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FF2A85] font-bold">✦</span>
                <span>Higher visibility on verified campus hiring directories</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs text-xs text-slate-500 leading-relaxed">
            <p className="font-bold text-slate-700 mb-1">Academic Verification</p>
            Your institution, degree, and specialization will be cross-referenced with your connected profiles and resume.
          </div>
        </div>
      </div>

      <StepFooter
        backStep={backStep}
        error={state.formError}
        status={saveName ? <SaveStatusText status={autosave.status} error={autosave.error} onRetry={autosave.retry} /> : undefined}
      >
        <ContinueButton pending={pending} />
      </StepFooter>
    </form>
  );
}
