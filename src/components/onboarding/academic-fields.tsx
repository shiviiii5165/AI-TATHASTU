"use client";

import { useState } from "react";

import { InstitutionCombobox, type InstitutionValue } from "@/components/onboarding/institution-combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  academicYearsFor,
  changeDegree,
  countryName,
  specializationsFor,
  suggestedGraduationYear,
  type DegreeInfo,
  type SpecializationInfo,
} from "@/lib/academic/match";
import { cn } from "@/lib/utils";

export type AcademicMode = { year: boolean; graduation: "expected" | "completed" | null };
export type AcademicCatalog = { degrees: DegreeInfo[]; specializations: SpecializationInfo[] };

const THIS_YEAR = new Date().getFullYear();
const YEARS = {
  expected: Array.from({ length: 12 }, (_, i) => String(THIS_YEAR - 1 + i)),
  completed: Array.from({ length: THIS_YEAR + 2 - 1950 }, (_, i) => String(THIS_YEAR + 1 - i)),
};

/**
 * The academic block shared by every persona's Step 1: institution combobox
 * (location auto-filled, editable only for Other / Not listed), degree →
 * dependent specialization, and per persona the current year and/or the
 * graduation year. Picks travel as hidden ids; the server re-validates them
 * (src/lib/academic/validate.ts).
 */
export function AcademicFields({
  mode,
  catalog,
  values,
  errors,
  initialInstitution,
  degreeLabel = "Degree",
}: {
  mode: AcademicMode;
  catalog: AcademicCatalog;
  values: Record<string, string>;
  errors?: Partial<Record<string, string>>;
  initialInstitution: InstitutionValue;
  degreeLabel?: string;
}) {
  const { degrees, specializations } = catalog;
  const [institution, setInstitution] = useState<InstitutionValue>(initialInstitution);
  const [selection, setSelection] = useState({ degreeId: values.degree ?? "", specializationId: values.specialization ?? "", academicYear: values.academicYear ?? "" });
  const [gradYear, setGradYear] = useState(values.graduationYear ?? "");
  const [gradTouched, setGradTouched] = useState(Boolean(values.graduationYear));

  const degree = degrees.find((d) => d.id === selection.degreeId) ?? null;
  const specOptions = specializationsFor(selection.degreeId, specializations);
  const yearOptions = academicYearsFor(degree);
  const isOther = Boolean(institution && !("id" in institution));
  const picked = institution && "id" in institution ? institution : null;
  const otherSpec = specOptions.find((s) => s.id === selection.specializationId)?.canonicalName === "Other";
  const err = (f: string) => errors?.[f];
  const aria = (f: string) => ({
    "aria-invalid": err(f) ? true : undefined,
    "aria-describedby": err(f) ? `${f}-error` : undefined,
    "data-field": f,
  });

  function setYear(academicYear: string) {
    setSelection((s) => ({ ...s, academicYear }));
    if (mode.graduation === "expected" && !gradTouched) {
      const suggested = suggestedGraduationYear(degree, academicYear);
      if (suggested) setGradYear(String(suggested));
    }
  }

  return (
    <>
      <input type="hidden" name="institutionId" value={picked ? picked.id : isOther ? "other" : ""} />
      <input type="hidden" name="degree" value={selection.degreeId} />
      <input type="hidden" name="specialization" value={selection.specializationId} />
      {mode.year && <input type="hidden" name="academicYear" value={selection.academicYear} />}
      {mode.graduation && <input type="hidden" name="graduationYear" value={gradYear} />}

      <Field label="University or college" field="institution" error={err("institution")} className="sm:col-span-2">
        <InstitutionCombobox
          id="institution"
          value={institution}
          onChange={setInstitution}
          invalid={Boolean(err("institution"))}
          describedBy={err("institution") ? "institution-error" : "institution-hint"}
        />
        {!err("institution") && (
          <p id="institution-hint" className="mt-1.5 text-sm text-muted-foreground">
            {isOther ? "Enter its details below. We'll review it before it appears in search for others." : "Can't find it? Choose Other / Not listed at the end of the list."}
          </p>
        )}
      </Field>

      {isOther && (
        <Field label="Institution name" field="institutionName" error={err("institutionName")} className="sm:col-span-2">
          <Input id="institutionName" name="institutionName" defaultValue={values.institutionName} maxLength={160} className="mt-2 h-11 rounded-xl border-input bg-background text-foreground" autoComplete="organization" {...aria("institutionName")} />
        </Field>
      )}

      <LocationField label="City" field="city" value={picked?.city ?? ""} editable={isOther} defaultValue={values.city ?? ""} error={err("city")} />
      <LocationField label="State or province" field="state" value={picked?.state ?? ""} editable={isOther} defaultValue={values.state ?? ""} optional />
      <LocationField label="Country" field="country" value={countryName(picked?.countryCode)} editable={isOther} defaultValue={values.country ?? ""} error={err("country")} />
      <div aria-hidden className="hidden sm:block" />

      <Field label={degreeLabel} field="degree" error={err("degree")}>
        <Select
          value={selection.degreeId || undefined}
          onValueChange={(id) => {
            setSelection((s) => changeDegree(s, id, specializations));
            setGradTouched(false);
          }}
        >
          <SelectTrigger id="degree" className="mt-2 h-11 w-full rounded-xl border-input bg-background text-foreground" {...aria("degree")}>
            <SelectValue placeholder="Select a degree" />
          </SelectTrigger>
          <SelectContent>
            {degrees.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.canonicalName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Specialization" field="specialization" error={err("specialization")}>
        <Select
          key={`spec-${selection.degreeId}`}
          value={selection.specializationId || undefined}
          onValueChange={(id) => setSelection((s) => ({ ...s, specializationId: id }))}
          disabled={!degree}
        >
          <SelectTrigger id="specialization" className="mt-2 h-11 w-full rounded-xl border-input bg-background text-foreground" {...aria("specialization")}>
            <SelectValue placeholder={degree ? "Select a specialization" : "Choose a degree first"} />
          </SelectTrigger>
          <SelectContent>
            {specOptions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.canonicalName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {otherSpec && (
        <Field label="Your specialization" field="specializationOther" optional className="sm:col-span-2">
          <Input id="specializationOther" name="specializationOther" defaultValue={values.specializationOther} maxLength={120} className="mt-2 h-11 rounded-xl border-input bg-background text-foreground" />
        </Field>
      )}

      {mode.year && (
        <Field label="Current year" field="academicYear" error={err("academicYear")}>
          <Select key={`year-${selection.degreeId}`} value={selection.academicYear || undefined} onValueChange={setYear} disabled={!degree}>
            <SelectTrigger id="academicYear" className="mt-2 h-11 w-full rounded-xl border-input bg-background text-foreground" {...aria("academicYear")}>
              <SelectValue placeholder={degree ? "Select your year" : "Choose a degree first"} />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {mode.graduation && (
        <Field label={mode.graduation === "expected" ? "Expected graduation" : "Graduation year"} field="graduationYear" error={err("graduationYear")}>
          <Select
            value={gradYear || undefined}
            onValueChange={(y) => {
              setGradTouched(true);
              setGradYear(y);
            }}
          >
            <SelectTrigger id="graduationYear" className="mt-2 h-11 w-full rounded-xl border-input bg-background text-foreground" {...aria("graduationYear")}>
              <SelectValue placeholder="Select a year" />
            </SelectTrigger>
            <SelectContent>
              {YEARS[mode.graduation].map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </>
  );
}

function LocationField({
  label, field, value, editable, defaultValue, error, optional,
}: {
  label: string;
  field: "city" | "state" | "country";
  value: string;
  editable: boolean;
  defaultValue: string;
  error?: string;
  optional?: boolean;
}) {
  return (
    <Field label={label} field={field} error={error} optional={optional && editable}>
      <Input
        // Remount when switching between the institution's value and manual entry.
        key={editable ? "edit" : `ro-${value}`}
        id={field}
        name={field}
        defaultValue={editable ? defaultValue : value}
        readOnly={!editable}
        aria-readonly={!editable || undefined}
        placeholder={editable ? undefined : "Auto-filled from institution"}
        maxLength={80}
        data-field={field}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${field}-error` : undefined}
        className={cn(
          "mt-2 h-11 rounded-xl transition-colors",
          editable
            ? "bg-background border-input text-foreground focus-visible:border-[#FF2A85] focus-visible:ring-2 focus-visible:ring-[#FF2A85]/20"
            : "bg-muted/50 border-border/70 text-muted-foreground shadow-none cursor-default select-none"
        )}
      />
    </Field>
  );
}

export function Field({
  label, field, optional, error, className, children,
}: {
  label: string;
  field: string;
  optional?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={field} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
        {optional && <span className="ml-1.5 font-normal text-muted-foreground/60 normal-case">(optional)</span>}
      </Label>
      {children}
      {error && (
        <p id={`${field}-error`} className="mt-1.5 text-xs font-semibold text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
