import { LogOut } from "lucide-react";
import { Suspense } from "react";

import { signOut } from "@/auth";
import { BrandLogo } from "@/components/brand-logo";
import { StepRail } from "@/components/onboarding/step-rail";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { getCurrentUser, getOnboardingState } from "@/lib/dal";

export default function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <a
        href="#step-content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      {/* Top Navigation Header (Onboarding variant: focused wizard navigation) */}
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-md sm:px-8 lg:px-10 lg:h-18">
        <div className="flex items-center">
          <BrandLogo href="/" withTagline size="sm" />
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <ThemeToggleButton size="sm" />

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="inline-flex min-h-[38px] pointer-coarse:min-h-11 items-center gap-2 rounded-xl border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              <LogOut aria-hidden="true" className="size-3.5" />
              Sign out
            </button>
          </form>

          <div className="hidden sm:block">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF6B4A] via-[#FF2A85] to-[#9333EA] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs">
              Onboarding in progress
            </span>
          </div>
        </div>
      </header>

      {/* Main body: Sidebar + Step Content */}
      <div className="mx-auto grid w-full flex-1 grid-cols-1 content-start lg:content-stretch lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="border-b border-border bg-card px-(--onb-gutter) py-3 lg:sticky lg:top-18 lg:h-[calc(100dvh-4.5rem)] lg:border-r lg:border-b-0 lg:px-6 lg:py-10 xl:px-8">
          <Suspense fallback={<StepRail currentStep={null} persona={null} />}>
            <RailWithProgress />
          </Suspense>
        </aside>

        <main id="step-content" className="flex min-w-0 flex-col justify-between pt-6 pb-0 pl-(--onb-gutter-l) pr-(--onb-gutter-r) lg:pt-10">
          <div className="mx-auto w-full max-w-6xl motion-fade-in">{children}</div>
        </main>

      </div>
    </div>
  );
}

async function RailWithProgress() {
  const user = await getCurrentUser();
  const state = await getOnboardingState(user.id);
  return <StepRail currentStep={state.currentStep} persona={user.role} />;
}
