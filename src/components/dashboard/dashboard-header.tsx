"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  ChevronDown,
  Moon,
  Plug,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import dynamic from "next/dynamic";
import { BrandLogo } from "@/components/brand-logo";
import { useTheme } from "@/components/theme-provider";

const YoraModal = dynamic(
  () => import("@/components/dashboard/yora-modal").then((m) => m.YoraModal),
  { ssr: false }
);

export function DashboardHeader({
  user,
}: {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  };
}) {
  const { toggleTheme } = useTheme();
  const [yoraOpen, setYoraOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    people: Array<{ id: string; title: string; subtitle: string; url: string }>;
    skills: Array<{ id: string; title: string; subtitle: string; url: string }>;
    projects: Array<{ id: string; title: string; subtitle: string; url: string }>;
    opportunities: Array<{ title: string; category: string; url: string }>;
  } | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setProfileMenuOpen(false);
        setNotifMenuOpen(false);
        setIsSearchFocused(false);
        setMobileSearchOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (cancelled) return;
        if (!res.ok) throw new Error(`search responded ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setSearchResults(data.results);
        setSearchFailed(false);
      } catch (e) {
        console.error("Search fetch failed", e);
        if (!cancelled) {
          setSearchResults(null); // never show the previous query's results for this one
          setSearchFailed(true);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchQuery]);

  const activeSearchResults = searchQuery.trim().length >= 2 ? searchResults : null;

  const displayName = user?.name?.trim() || (user?.email ? user.email.split("@")[0] : "Scholar");
  const displayRole =
    user?.role === "faculty"
      ? "Faculty / Mentor"
      : user?.role === "alumni"
        ? "Alumni"
        : "Student";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AT";
  const avatarUrl = user?.image || null;

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border bg-card/95 px-3 sm:px-6 lg:px-8 pl-safe pr-safe backdrop-blur-md">
        {/* Left: Brand area */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <Link
            href="/dashboard"
            aria-label="AI Tathastu Dashboard"
            className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF496D]/30 rounded-xl"
          >
            <BrandLogo withTagline size="sm" />
          </Link>
        </div>

        {/* Center: Large search bar with Categorized Dropdown */}
        <div className="hidden md:flex flex-1 max-w-lg mx-6 relative">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for people, projects, skills, opportunities..."
              className="w-full h-10.5 pl-11 pr-4 rounded-full border border-border bg-background text-base md:text-sm text-foreground placeholder:text-muted-foreground transition-all focus:bg-card focus:outline-none focus:border-[#FF496D] focus:ring-2 focus:ring-[#FF496D]/15"
            />
            {isSearching && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <span className="size-3.5 block rounded-full border-2 border-[#FF496D] border-t-transparent animate-spin" />
              </div>
            )}
          </div>

          {/* Categorized Dropdown Results */}
          {isSearchFocused && searchQuery.trim().length >= 2 && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsSearchFocused(false)}
              />
              <div className="absolute top-12 left-0 right-0 z-50 rounded-2xl border border-border bg-card p-3 shadow-2xl max-h-[440px] overflow-y-auto text-card-foreground">
                {activeSearchResults &&
                (activeSearchResults.people.length > 0 ||
                  activeSearchResults.skills.length > 0 ||
                  activeSearchResults.projects.length > 0 ||
                  activeSearchResults.opportunities.length > 0) ? (
                  <div className="space-y-3.5 text-xs">
                    {/* People Category */}
                    {activeSearchResults.people.length > 0 && (
                      <div>
                        <p className="px-2 font-bold uppercase tracking-wider text-[10px] text-slate-400 mb-1">
                          People & Mentors
                        </p>
                        <div className="space-y-1">
                          {activeSearchResults.people.map((p) => (
                            <Link
                              key={p.id}
                              href={p.url}
                              onClick={() => {
                                setIsSearchFocused(false);
                                setSearchQuery("");
                              }}
                              className="flex items-center justify-between rounded-xl px-2.5 py-1.5 hover:bg-slate-50 transition-colors"
                            >
                              <div>
                                <p className="font-semibold text-slate-900">{p.title}</p>
                                <p className="text-[11px] text-slate-500">{p.subtitle}</p>
                              </div>
                              <span className="text-[10px] font-semibold text-[#2878F0] bg-blue-50 px-2 py-0.5 rounded-full">
                                Connect
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Skills Category */}
                    {activeSearchResults.skills.length > 0 && (
                      <div className="border-t border-slate-100 pt-2.5">
                        <p className="px-2 font-bold uppercase tracking-wider text-[10px] text-slate-400 mb-1">
                          Skills & Competencies
                        </p>
                        <div className="flex flex-wrap gap-1.5 px-2">
                          {activeSearchResults.skills.map((s) => (
                            <Link
                              key={s.id}
                              href={s.url}
                              onClick={() => {
                                setIsSearchFocused(false);
                                setSearchQuery("");
                              }}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-[#FF496D] hover:text-[#FF496D] transition-colors"
                            >
                              <span>{s.title}</span>
                              <span className="text-[9px] text-slate-400 font-normal">({s.subtitle})</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Projects Category */}
                    {activeSearchResults.projects.length > 0 && (
                      <div className="border-t border-slate-100 pt-2.5">
                        <p className="px-2 font-bold uppercase tracking-wider text-[10px] text-slate-400 mb-1">
                          Projects & Repositories
                        </p>
                        <div className="space-y-1">
                          {activeSearchResults.projects.map((proj) => (
                            <Link
                              key={proj.id}
                              href={proj.url}
                              onClick={() => {
                                setIsSearchFocused(false);
                                setSearchQuery("");
                              }}
                              className="flex items-center justify-between rounded-xl px-2.5 py-1.5 hover:bg-slate-50 transition-colors"
                            >
                              <div>
                                <p className="font-semibold text-slate-900">{proj.title}</p>
                                <p className="text-[11px] text-slate-500">{proj.subtitle}</p>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">View →</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Opportunities Category */}
                    {activeSearchResults.opportunities.length > 0 && (
                      <div className="border-t border-slate-100 pt-2.5">
                        <p className="px-2 font-bold uppercase tracking-wider text-[10px] text-slate-400 mb-1">
                          Opportunities & Paths
                        </p>
                        <div className="space-y-1">
                          {activeSearchResults.opportunities.map((o, idx) => (
                            <Link
                              key={idx}
                              href={o.url}
                              onClick={() => {
                                setIsSearchFocused(false);
                                setSearchQuery("");
                              }}
                              className="flex items-center justify-between rounded-xl px-2.5 py-1.5 hover:bg-slate-50 transition-colors"
                            >
                              <div>
                                <p className="font-semibold text-slate-900">{o.title}</p>
                                <p className="text-[11px] text-[#8554FF] font-medium">{o.category}</p>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">Explore →</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-500 text-xs">
                    {isSearching
                      ? "Searching catalogue…"
                      : searchFailed
                        ? "Search isn't available right now. Try again in a moment."
                        : `No matches found for "${searchQuery}"`}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Mobile search trigger button */}
          <button
            type="button"
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="md:hidden flex size-9 sm:size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-xs hover:bg-accent transition-colors cursor-pointer min-h-[44px] min-w-[44px]"
            aria-label="Toggle search"
            aria-expanded={mobileSearchOpen}
          >
            <Search className="size-4" />
          </button>

          {/* Theme toggle button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex size-9 sm:size-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-xs hover:bg-accent transition-colors cursor-pointer min-h-[44px] min-w-[44px]"
            aria-label="Toggle color theme"
          >
            <Sun className="size-4 sm:size-4.5 text-[#F59E0B] dark:hidden" />
            <Moon className="size-4 sm:size-4.5 text-[#B69CFF] hidden dark:block" />
          </button>

          {/* Notifications button with unread indicator */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifMenuOpen(!notifMenuOpen);
                setProfileMenuOpen(false);
              }}
              className="relative flex size-9 sm:size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-xs hover:bg-accent hover:text-foreground transition-colors cursor-pointer min-h-[44px] min-w-[44px]"
              aria-label="View notifications"
              aria-expanded={notifMenuOpen}
            >
              <Bell className="size-4 sm:size-4.5" />
            </button>

            {notifMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setNotifMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-80 rounded-2xl border border-border bg-card p-4 shadow-xl z-50 text-sm animate-in fade-in zoom-in-95 duration-150 text-card-foreground">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <span className="font-bold text-foreground">Notifications</span>
                  </div>
                  {/* No notification feed exists yet; the previous entries were placeholders, not real events. */}
                  <p className="mt-3 text-xs text-muted-foreground">You&apos;re all caught up. Updates about your profile will appear here.</p>
                </div>
              </>
            )}
          </div>

          {/* User profile dropdown button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(!profileMenuOpen);
                setNotifMenuOpen(false);
              }}
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-accent transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF496D]/30"
              aria-label="User account menu"
              aria-expanded={profileMenuOpen}
            >
              <div className="relative size-8 rounded-full overflow-hidden border border-border shadow-xs shrink-0">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={displayName}
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-[#FF496D] to-[#8554FF] text-white text-[11px] font-bold">
                    {initials}
                  </div>
                )}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-foreground leading-tight truncate max-w-[120px]">
                  {displayName}
                </p>
                <p className="text-[0.6875rem] font-medium text-muted-foreground leading-none">
                  {displayRole}
                </p>
              </div>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>

            {profileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setProfileMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card py-2 shadow-xl z-50 text-xs font-semibold text-card-foreground animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2 border-b border-border">
                    <p className="font-bold text-foreground text-sm truncate">{displayName}</p>
                    <p className="text-muted-foreground font-normal truncate">{user?.email || "verified@aitathastu.com"}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground min-h-[40px]"
                  >
                    <User className="size-4 text-muted-foreground" />
                    My Profile
                  </Link>
                  <Link
                    href="/settings/privacy"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground min-h-[40px]"
                  >
                    <ShieldCheck className="size-4 text-muted-foreground" />
                    Privacy Settings
                  </Link>
                  <Link
                    href="/settings/integrations"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground min-h-[40px]"
                  >
                    <Plug className="size-4 text-muted-foreground" />
                    Connected Integrations
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Primary "Ask Yora ✨" button */}
          <button
            type="button"
            onClick={() => setYoraOpen(true)}
            aria-label="Ask Yora AI companion"
            className="flex items-center gap-1.5 h-10 px-2.5 sm:px-4 rounded-full bg-gradient-to-r from-[#FF496D] to-[#FF713D] text-white text-xs font-bold shadow-sm hover:opacity-95 active:scale-95 transition-all cursor-pointer select-none shrink-0 touch-manipulation min-h-[44px]"
          >
            <span className="hidden min-[380px]:inline">Ask Yora</span>
            <span className="inline min-[380px]:hidden">Yora</span>
            <Sparkles className="size-3.5" />
          </button>
        </div>
      </header>

      {/* Mobile Search Overlay Bar */}
      {mobileSearchOpen && (
        <div className="md:hidden sticky top-16 z-30 bg-card border-b border-border p-3 shadow-sm animate-in slide-in-from-top-2 duration-150">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              autoFocus
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people, projects, skills…"
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-background text-base md:text-xs text-foreground placeholder:text-muted-foreground focus:bg-card focus:outline-none focus:border-[#FF496D]"
            />
          </div>
          {activeSearchResults && (
            <div className="mt-2 rounded-xl border border-border bg-card p-2 shadow-lg max-h-60 overflow-y-auto text-xs space-y-2 text-card-foreground">
              {activeSearchResults.people.length > 0 && (
                <div>
                  <p className="px-2 font-bold uppercase text-[10px] text-slate-400">People</p>
                  {activeSearchResults.people.slice(0, 3).map((p) => (
                    <Link
                      key={p.id}
                      href={p.url}
                      onClick={() => setMobileSearchOpen(false)}
                      className="block p-1.5 hover:bg-slate-50 rounded-lg"
                    >
                      <p className="font-semibold text-slate-900">{p.title}</p>
                      <p className="text-[10px] text-slate-500">{p.subtitle}</p>
                    </Link>
                  ))}
                </div>
              )}
              {activeSearchResults.skills.length > 0 && (
                <div>
                  <p className="px-2 font-bold uppercase text-[10px] text-slate-400">Skills</p>
                  {activeSearchResults.skills.slice(0, 3).map((s) => (
                    <Link
                      key={s.id}
                      href={s.url}
                      onClick={() => setMobileSearchOpen(false)}
                      className="block p-1.5 hover:bg-slate-50 rounded-lg"
                    >
                      <p className="font-semibold text-slate-900">{s.title}</p>
                      <p className="text-[10px] text-[#8554FF]">{s.subtitle}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Yora AI Assistant Slide-in Dialog */}
      {yoraOpen && (
        <YoraModal
          open={yoraOpen}
          onOpenChange={setYoraOpen}
          userName={displayName}
        />
      )}
    </>
  );
}
