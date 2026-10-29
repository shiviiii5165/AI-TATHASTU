"use client";

import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  Globe,
  Heart,
  MessageSquare,
  Sparkles,
  Target,
  Users,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useState, useSyncExternalStore } from "react";

interface RoomDetail {
  id: "avasar" | "learn" | "collaborate" | "meet" | "iris";
  name: string;
  tagline: string;
  shortDesc: string;
  intro: string;
  accent: {
    primary: string;
    light: string;
    border: string;
    gradient: string;
    glow: string;
  };
  icon: typeof Briefcase;
  details: {
    title: string;
    desc: string;
  }[];
  actionLabel: string;
  actionHref: string;
}

const ROOMS_DATA: RoomDetail[] = [
  {
    id: "avasar",
    name: "Avasar",
    tagline: "Opportunities",
    shortDesc: "Find relevant opportunities.",
    intro: "Discover opportunities that match your profile.",
    accent: {
      primary: "#D97706",
      light: "#FEF3C7",
      border: "rgba(245, 158, 11, 0.4)",
      gradient: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
      glow: "rgba(245, 158, 11, 0.18)",
    },
    icon: Briefcase,
    details: [
      {
        title: "Internships and jobs",
        desc: "Explore relevant roles from available listings.",
      },
      {
        title: "Research opportunities",
        desc: "Find research positions and projects in your field.",
      },
      {
        title: "Personalized recommendations",
        desc: "See suggestions based on your skills and interests.",
      },
      {
        title: "Track and apply",
        desc: "Save opportunities and manage applications, if supported by the existing product.",
      },
    ],
    actionLabel: "Explore Avasar →",
    actionHref: "/avasar",
  },
  {
    id: "learn",
    name: "Learn",
    tagline: "Skill development",
    shortDesc: "Build skills with a clear plan.",
    intro: "Build skills with a clear plan.",
    accent: {
      primary: "#E11D48",
      light: "#FFE4E6",
      border: "rgba(244, 63, 94, 0.4)",
      gradient: "linear-gradient(135deg, #F43F5E 0%, #BE123C 100%)",
      glow: "rgba(244, 63, 94, 0.18)",
    },
    icon: BookOpen,
    details: [
      {
        title: "Skill gaps",
        desc: "Identify skills to develop for your goals.",
      },
      {
        title: "Learning paths",
        desc: "Explore structured learning recommendations.",
      },
      {
        title: "Practice projects",
        desc: "Apply what you learn through projects.",
      },
      {
        title: "Progress",
        desc: "Review completed learning activities where tracking is available.",
      },
    ],
    actionLabel: "Explore Learn →",
    actionHref: "/learn",
  },
  {
    id: "collaborate",
    name: "Collaborate",
    tagline: "Find teammates",
    shortDesc: "Find teammates for projects.",
    intro: "Find people to build with.",
    accent: {
      primary: "#059669",
      light: "#D1FAE5",
      border: "rgba(16, 185, 129, 0.4)",
      gradient: "linear-gradient(135deg, #10B981 0%, #047857 100%)",
      glow: "rgba(16, 185, 129, 0.18)",
    },
    icon: Users,
    details: [
      {
        title: "Find teammates",
        desc: "Discover people with complementary interests and skills.",
      },
      {
        title: "Build projects",
        desc: "Explore ways to work together.",
      },
      {
        title: "Share expertise",
        desc: "Learn from other students and contributors.",
      },
      {
        title: "Join communities",
        desc: "Discover relevant groups where available.",
      },
    ],
    actionLabel: "Explore Collaborate →",
    actionHref: "/collaborate",
  },
  {
    id: "meet",
    name: "Meet",
    tagline: "Mentors & peers",
    shortDesc: "Connect with mentors and peers.",
    intro: "Connect with mentors and peers.",
    accent: {
      primary: "#7C3AED",
      light: "#EDE9FE",
      border: "rgba(139, 92, 246, 0.4)",
      gradient: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
      glow: "rgba(139, 92, 246, 0.18)",
    },
    icon: MessageSquare,
    details: [
      {
        title: "Find mentors",
        desc: "Discover relevant faculty, alumni or mentors where matching is available.",
      },
      {
        title: "Learn from peers",
        desc: "Connect with people who share your interests.",
      },
      {
        title: "Explore research",
        desc: "Find potential research connections.",
      },
      {
        title: "Grow your network",
        desc: "Build meaningful academic and professional connections.",
      },
    ],
    actionLabel: "Explore Meet →",
    actionHref: "/meet",
  },
  {
    id: "iris",
    name: "IRIS",
    tagline: "Readiness & next steps",
    shortDesc: "Understand your readiness and next steps.",
    intro: "Understand your readiness and next steps.",
    accent: {
      primary: "#FF2A85",
      light: "#FFE4EC",
      border: "rgba(255, 42, 133, 0.4)",
      gradient: "linear-gradient(135deg, #FF2A85 0%, #9333EA 100%)",
      glow: "rgba(255, 42, 133, 0.18)",
    },
    icon: BarChart3,
    details: [
      {
        title: "Readiness insights",
        desc: "Review available career-readiness indicators.",
      },
      {
        title: "Skill gaps",
        desc: "See areas that may need improvement.",
      },
      {
        title: "Career direction",
        desc: "Explore next steps for your target role.",
      },
      {
        title: "Progress",
        desc: "Revisit your profile as you gain experience.",
      },
    ],
    actionLabel: "Explore IRIS →",
    actionHref: "/#ecosystem",
  },
];

const BELIEFS = [
  {
    title: "Build with purpose",
    desc: "Solve real problems with useful technology.",
    icon: Target,
    accent: "#D97706",
    bg: "#FEF3C7",
  },
  {
    title: "Make AI useful",
    desc: "Turn information into clear next steps.",
    icon: Zap,
    accent: "#E11D48",
    bg: "#FFE4E6",
  },
  {
    title: "Put people first",
    desc: "Give students more ways to learn and connect.",
    icon: Heart,
    accent: "#7C3AED",
    bg: "#EDE9FE",
  },
];

export function AboutContent() {
  const [pinnedRoom, setPinnedRoom] = useState<RoomDetail["id"] | null>(null);
  const [hoveredRoom, setHoveredRoom] = useState<RoomDetail["id"] | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState("English");
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterConsent, setNewsletterConsent] = useState(true);
  const currentYear = useSyncExternalStore(
    () => () => {},
    () => new Date().getFullYear(),
    () => 2025
  );

  // Active room is hovered (if pointer is hovering) or pinned (if card was clicked)
  const activeRoomId = hoveredRoom ?? pinnedRoom;
  const activeRoom = ROOMS_DATA.find((r) => r.id === activeRoomId) ?? null;

  const handleCardClick = (id: RoomDetail["id"]) => {
    console.log("handleCardClick called with:", id);
    // If already pinned, clicking it again unpins it (returns to compact overview)
    if (pinnedRoom === id) {
      setPinnedRoom(null);
    } else {
      setPinnedRoom(id);
    }
  };

  const handleCardKeyDown = (e: React.KeyboardEvent, id: RoomDetail["id"]) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardClick(id);
    } else if (e.key === "Escape") {
      setPinnedRoom(null);
      setHoveredRoom(null);
    }
  };

  const closeDetails = useCallback(() => {
    setPinnedRoom(null);
    setHoveredRoom(null);
  }, []);

  // Global escape key listener to close pinned details
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeDetails();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDetails]);

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newsletterEmail)) {
      alert("Please enter a valid email address.");
      return;
    }
    if (!newsletterConsent) {
      alert("Please agree to receive updates.");
      return;
    }
    setNewsletterSubscribed(true);
    setNewsletterEmail("");
    setTimeout(() => setNewsletterSubscribed(false), 4000);
  };

  const panelId = useId();

  return (
    <div className="about-page-wrapper min-h-screen bg-white text-[#0F172A] overflow-x-hidden w-full max-w-full">
      {/* Ambient glowing mesh background */}
      <div className="page-ambient-mesh" aria-hidden="true" />
      <div className="page-grid-overlay" aria-hidden="true" />

      {/* Decorative ambient orbs */}
      <div className="floating-orb orb-amber-lg" style={{ left: "3%", top: "18%" }} aria-hidden="true" />
      <div className="floating-orb orb-pink-md" style={{ right: "5%", top: "14%" }} aria-hidden="true" />
      <div className="floating-orb orb-purple-sm" style={{ right: "8%", top: "38%" }} aria-hidden="true" />
      <div className="floating-orb orb-coral-sm" style={{ left: "4%", top: "62%" }} aria-hidden="true" />

      {/* ============================================================
           TOP NAVIGATION BAR
      ============================================================ */}
      <header className="site-nav">
        <div className="wrap site-nav-inner">
          <Link href="/" className="brand-link" aria-label="AI Tathastu Home">
            <Image src="/icons/icon-192.png" alt="AI Tathastu" className="brand-logo-mark" width={40} height={40} />
            <div className="brand-text-col">
              <span className="brand-name">AI Tathastu</span>
              <span className="brand-sub">Your Dreams. Our Intelligence. <span className="font-semibold text-[#FF2A85]">Tathastu.</span></span>
            </div>
          </Link>

          <nav aria-label="Main Navigation" className="desktop-main-nav">
            <ul className="nav-links-list">
              <li>
                <Link href="/#ecosystem">Platform</Link>
              </li>
              <li>
                <Link href="/#how">How it works</Link>
              </li>
              <li>
                <Link href="/about" className="active" aria-current="page">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact">Support</Link>
              </li>
            </ul>
          </nav>

          <div className="nav-right-actions">
            <Link href="/dashboard" className="nav-cta-btn">
              Open Dashboard <span aria-hidden="true">→</span>
            </Link>
            <button
              type="button"
              className="about-mobile-menu-toggle"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="bar" />
              <span className="bar" />
              <span className="bar" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="about-mobile-drawer" role="dialog" aria-label="Mobile navigation">
            <nav className="about-mobile-nav">
              <Link href="/#ecosystem" onClick={() => setMobileMenuOpen(false)}>
                Platform
              </Link>
              <Link href="/#how" onClick={() => setMobileMenuOpen(false)}>
                How it works
              </Link>
              <Link href="/about" className="active" onClick={() => setMobileMenuOpen(false)}>
                About
              </Link>
              <Link href="/contact" onClick={() => setMobileMenuOpen(false)}>
                Support
              </Link>
              <Link href="/dashboard" className="mobile-cta-btn" onClick={() => setMobileMenuOpen(false)}>
                Open Dashboard →
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* ============================================================
           SECTION 1: HERO
      ============================================================ */}
      <section className="about-hero" aria-labelledby="about-hero-title">
        <div className="wrap">
          <div className="about-hero-grid">
            {/* Left Column: Copy & CTAs */}
            <div className="about-hero-copy">
              <div className="eyebrow-pill">
                <span className="eyebrow-dot" aria-hidden="true" />
                ABOUT AI TATHASTU
              </div>
              <h1 id="about-hero-title" className="about-hero-title">
                Built to help <span className="gradient-accent">students grow.</span>
              </h1>
              <p className="about-hero-desc">
                We bring your skills, projects and goals together to help you find what to learn, build and explore next.
              </p>
              <div className="hero-cta-group">
                <Link href="/#ecosystem" className="btn-hero-primary" id="btnExplorePlatform">
                  Explore the platform <span aria-hidden="true">→</span>
                </Link>
                <Link href="/contact" className="btn-hero-secondary" id="btnContactUs">
                  Contact us <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>

            {/* Right Column: Connected Ecosystem Illustration */}
            <div className="hero-visual-stage" aria-label="Connected ecosystem illustration">
              {/* Center Profile Card */}
              <div className="hero-central-profile-card">
                <div className="hero-profile-avatar-wrap">
                  <div className="hero-avatar-badge" aria-hidden="true">
                    <Sparkles className="size-4 text-amber-500" />
                  </div>
                  <span className="hero-profile-kicker">YOUR PROFILE</span>
                </div>
                <h2 className="hero-profile-title">Your profile</h2>
                <p className="hero-profile-sub">Your skills, projects, goals and interests</p>
                <div className="hero-profile-mini-tags">
                  <span className="mini-tag">Skills</span>
                  <span className="mini-tag">Projects</span>
                  <span className="mini-tag">Goals</span>
                  <span className="mini-tag">Interests</span>
                </div>
              </div>

              {/* Connected Feature Nodes (5 Surrounding Cards) */}
              {/* 1. Avasar (Top Left) */}
              <div className="hero-feature-node node-avasar">
                <div className="node-icon-box" style={{ background: "#FEF3C7", color: "#D97706" }}>
                  <Briefcase className="size-4" />
                </div>
                <div className="node-text">
                  <span className="node-title">Avasar</span>
                  <span className="node-label">Opportunities</span>
                </div>
              </div>

              {/* 2. Learn (Top Right) */}
              <div className="hero-feature-node node-learn">
                <div className="node-icon-box" style={{ background: "#FFE4E6", color: "#E11D48" }}>
                  <BookOpen className="size-4" />
                </div>
                <div className="node-text">
                  <span className="node-title">Learn</span>
                  <span className="node-label">Skill development</span>
                </div>
              </div>

              {/* 3. Collaborate (Bottom Left) */}
              <div className="hero-feature-node node-collab">
                <div className="node-icon-box" style={{ background: "#D1FAE5", color: "#059669" }}>
                  <Users className="size-4" />
                </div>
                <div className="node-text">
                  <span className="node-title">Collaborate</span>
                  <span className="node-label">Find teammates</span>
                </div>
              </div>

              {/* 4. Meet (Bottom Right) */}
              <div className="hero-feature-node node-meet">
                <div className="node-icon-box" style={{ background: "#EDE9FE", color: "#7C3AED" }}>
                  <MessageSquare className="size-4" />
                </div>
                <div className="node-text">
                  <span className="node-title">Meet</span>
                  <span className="node-label">Mentors &amp; peers</span>
                </div>
              </div>

              {/* 5. IRIS (Bottom Center) */}
              <div className="hero-feature-node node-iris">
                <div className="node-icon-box" style={{ background: "#FFE4EC", color: "#FF2A85" }}>
                  <BarChart3 className="size-4" />
                </div>
                <div className="node-text">
                  <span className="node-title">IRIS</span>
                  <span className="node-label">Readiness &amp; next steps</span>
                </div>
              </div>

              {/* SVG Connecting Curves */}
              <svg className="hero-connector-svg" viewBox="0 0 540 440" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id="connAmber" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="connRose" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="connEmerald" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="connPurple" x1="100%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="connIris" x1="50%" y1="100%" x2="50%" y2="0%">
                    <stop offset="0%" stopColor="#FF2A85" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                {/* To Avasar */}
                <path d="M 120 70 C 170 110, 220 160, 270 190" stroke="url(#connAmber)" strokeWidth="1.8" strokeDasharray="4 4" />
                {/* To Learn */}
                <path d="M 420 70 C 370 110, 320 160, 270 190" stroke="url(#connRose)" strokeWidth="1.8" strokeDasharray="4 4" />
                {/* To Collaborate */}
                <path d="M 110 350 C 160 310, 220 250, 270 230" stroke="url(#connEmerald)" strokeWidth="1.8" strokeDasharray="4 4" />
                {/* To Meet */}
                <path d="M 430 350 C 380 310, 320 250, 270 230" stroke="url(#connPurple)" strokeWidth="1.8" strokeDasharray="4 4" />
                {/* To IRIS */}
                <path d="M 270 390 C 270 330, 270 280, 270 240" stroke="url(#connIris)" strokeWidth="1.8" strokeDasharray="4 4" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
           SECTION 2: “WHAT WE BELIEVE”
      ============================================================ */}
      <section className="section-beliefs" aria-labelledby="beliefs-title">
        <div className="wrap">
          <div className="beliefs-head">
            <h2 id="beliefs-title" className="beliefs-main-title">
              What we believe
            </h2>
          </div>

          <div className="beliefs-grid">
            {BELIEFS.map((belief, idx) => {
              const IconComp = belief.icon;
              return (
                <div key={idx} className="belief-card">
                  <div
                    className="belief-icon-box"
                    style={{ background: belief.bg, color: belief.accent }}
                  >
                    <IconComp className="size-6" />
                  </div>
                  <h3 className="belief-card-title">{belief.title}</h3>
                  <p className="belief-card-desc">{belief.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================
           SECTION 3: ECOSYSTEM SECTION (PRIMARY INTERACTIVE FEATURE)
      ============================================================ */}
      <section className="section-ecosystem" id="ecosystem" aria-labelledby="ecosystem-title">
        <div className="wrap">
          <div className="ecosystem-head">
            <h2 id="ecosystem-title" className="ecosystem-main-title">
              Five focused rooms. <span className="gradient-accent">One profile.</span>
            </h2>
            <p className="ecosystem-sub">
              Explore the AI Tathastu ecosystem, built around your profile.
            </p>
          </div>

          {/* Cards Container with Mouse Leave Handling */}
          <div
            className="ecosystem-interactive-wrapper"
            onMouseLeave={() => setHoveredRoom(null)}
          >
            {/* The 5 Room Cards */}
            <div
              className="ecosystem-cards-grid"
              role="tablist"
              aria-label="AI Tathastu Ecosystem Rooms"
            >
              {ROOMS_DATA.map((room) => {
                const IconComp = room.icon;
                const isPinned = pinnedRoom === room.id;
                const isActive = activeRoomId === room.id;

                return (
                  <button
                    key={room.id}
                    type="button"
                    role="tab"
                    id={`room-tab-${room.id}`}
                    aria-selected={isActive}
                    aria-expanded={isActive}
                    aria-controls={`room-panel-${room.id}`}
                    tabIndex={0}
                    className={`eco-card ${isActive ? "is-active" : ""} ${isPinned ? "is-pinned" : ""}`}
                    style={
                      isActive
                        ? {
                            borderColor: room.accent.primary,
                            boxShadow: `0 14px 34px ${room.accent.glow}`,
                          }
                        : undefined
                    }
                    onClick={() => handleCardClick(room.id)}
                    onMouseEnter={() => {
                      console.log("onMouseEnter called with:", room.id);
                      setHoveredRoom(room.id);
                    }}
                    onKeyDown={(e) => handleCardKeyDown(e, room.id)}
                  >
                    {/* Top colored accent indicator line */}
                    <div
                      className="eco-card-top-bar"
                      style={{
                        background: room.accent.gradient,
                        opacity: isActive ? 1 : 0,
                      }}
                    />

                    <div className="eco-card-header">
                      <div
                        className="eco-card-icon"
                        style={{
                          background: room.accent.light,
                          color: room.accent.primary,
                        }}
                      >
                        <IconComp className="size-5" />
                      </div>
                      <span className="eco-arrow-indicator" aria-hidden="true">
                        <ArrowRight
                          className="size-4"
                          style={{
                            color: isActive ? room.accent.primary : "#94A3B8",
                            transform: isActive ? "translateX(4px)" : "none",
                            transition: "all 0.25s ease",
                          }}
                        />
                      </span>
                    </div>

                    <h3 className="eco-card-title">{room.name}</h3>
                    <p className="eco-card-desc">{room.shortDesc}</p>

                    <div className="eco-card-footer">
                      <span
                        className="eco-card-link-text"
                        style={{ color: isActive ? room.accent.primary : "#475569" }}
                      >
                        {isPinned ? "Pinned open · Click to close" : "Learn more →"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Desktop Detailed Room Panel (Expands smoothly below the 5 cards) */}
            <div
              id={panelId}
              className={`eco-detail-drawer ${activeRoom ? "is-open" : ""}`}
              aria-live="polite"
            >
              {activeRoom && (
                <div
                  className="eco-detail-panel"
                  id={`room-panel-${activeRoom.id}`}
                  role="tabpanel"
                  aria-labelledby={`room-tab-${activeRoom.id}`}
                  style={{
                    borderTop: `3px solid ${activeRoom.accent.primary}`,
                  }}
                >
                  <div className="eco-detail-header-row">
                    <div className="eco-detail-title-group">
                      <div
                        className="eco-detail-icon-badge"
                        style={{
                          background: activeRoom.accent.light,
                          color: activeRoom.accent.primary,
                        }}
                      >
                        <activeRoom.icon className="size-6" />
                      </div>
                      <div>
                        <div className="eco-detail-kicker" style={{ color: activeRoom.accent.primary }}>
                          {activeRoom.tagline.toUpperCase()}
                        </div>
                        <h3 className="eco-detail-headline">{activeRoom.name}</h3>
                        <p className="eco-detail-intro">{activeRoom.intro}</p>
                      </div>
                    </div>

                    <div className="eco-detail-controls">
                      {pinnedRoom === activeRoom.id ? (
                        <span className="eco-pinned-badge">
                          <Check className="size-3.5" /> Pinned open
                        </span>
                      ) : (
                        <span className="eco-preview-hint">Preview (click card to keep open)</span>
                      )}
                      <button
                        type="button"
                        className="eco-close-btn"
                        onClick={closeDetails}
                        aria-label="Close room details and return to overview"
                      >
                        <X className="size-4" />
                        <span>Close</span>
                      </button>
                    </div>
                  </div>

                  {/* 4 Detail Items Grid */}
                  <div className="eco-detail-grid">
                    {activeRoom.details.map((item, idx) => (
                      <div key={idx} className="eco-detail-item-card">
                        <div
                          className="eco-detail-bullet-dot"
                          style={{ background: activeRoom.accent.primary }}
                          aria-hidden="true"
                        />
                        <div className="eco-detail-item-content">
                          <strong className="eco-detail-item-title">{item.title}</strong>
                          <span className="eco-detail-item-sep"> — </span>
                          <span className="eco-detail-item-desc">{item.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Panel Action Footer */}
                  <div className="eco-detail-actions">
                    <Link
                      href={activeRoom.actionHref}
                      className="eco-action-cta-btn"
                      style={{
                        background: activeRoom.accent.gradient,
                      }}
                    >
                      <span>{activeRoom.actionLabel}</span>
                    </Link>
                    <button
                      type="button"
                      className="eco-secondary-btn"
                      onClick={closeDetails}
                    >
                      Back to overview
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
           SECTION 4: CLOSING QUOTE BANNER
      ============================================================ */}
      <section className="section-closing-quote" aria-label="Closing quote">
        <div className="wrap">
          <div className="closing-quote-card">
            <span className="quote-mark-decorative" aria-hidden="true">
              “
            </span>
            <blockquote className="closing-quote-text">
              Technology should open doors.
            </blockquote>
            <p className="closing-quote-sub">
              We build tools that make learning and opportunity easier to access.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
           SECTION 5: FOOTER & CTA HERO CARD
      ============================================================ */}
      <footer className="exact-footer" id="footer">
        <div className="footer-ambient-bg" aria-hidden="true">
          <div className="footer-glow-mesh" />
          <div className="footer-sphere sphere-tl-small" />
          <div className="footer-sphere sphere-tl-lavender" />
          <div className="footer-sphere sphere-tr-pink" />
          <div className="footer-sphere sphere-cta-pink" />
          <div className="footer-sphere sphere-bl-amber" />
          <div className="footer-sphere sphere-br-coral" />
        </div>

        <div className="footer-content-wrap">
          <div className="wrap">
            {/* Main Navigation Grid */}
            <div className="footer-nav-grid">
              {/* Brand Column */}
              <div className="footer-col footer-col-brand">
                <div className="footer-brand-lockup">
                  <Link className="footer-brand-link" href="/">
                    <Image src="/icons/icon-192.png" alt="AI Tathastu" className="footer-brand-icon" width={34} height={34} />
                    <div className="footer-brand-text">
                      <span className="footer-brand-name">AI Tathastu</span>
                      <span className="footer-brand-tagline">Your Dreams. Our Intelligence. <span className="font-semibold text-[#FF2A85]">Tathastu.</span></span>
                    </div>
                  </Link>
                </div>
                <p className="footer-brand-desc">
                  Connect your skills, projects and resume. Discover what you&apos;re good at, what to learn next and where to go.
                </p>
                <div className="footer-social-row">
                  <a
                    href="https://linkedin.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-social-btn"
                    aria-label="LinkedIn"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.64 1.64 0 1 0 0-3.28 1.64 1.64 0 0 0 0 3.28m1.4 9.74v-8.37H5.06v8.37z" />
                    </svg>
                  </a>
                  <a
                    href="https://twitter.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-social-btn"
                    aria-label="X / Twitter"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-social-btn"
                    aria-label="Instagram"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                  </a>
                  <a
                    href="https://youtube.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-social-btn"
                    aria-label="YouTube"
                  >
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </a>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-social-btn"
                    aria-label="GitHub"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Column 2: Product */}
              <div className="footer-col">
                <h4 className="footer-col-title">Product</h4>
                <ul className="footer-nav-list">
                  <li>
                    <Link href="/#ecosystem">Platform</Link>
                  </li>
                </ul>
              </div>

              {/* Column 3: Resources */}
              <div className="footer-col">
                <h4 className="footer-col-title">Resources</h4>
                <ul className="footer-nav-list">
                  <li>
                    <Link href="/#docs">Documentation</Link>
                  </li>
                </ul>
              </div>

              {/* Column 4: Company */}
              <div className="footer-col">
                <h4 className="footer-col-title">Company</h4>
                <ul className="footer-nav-list">
                  <li>
                    <Link href="/about" style={{ color: "#FF2B6D", fontWeight: 700 }}>
                      About Us
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact">Support &amp; Contact</Link>
                  </li>
                </ul>
              </div>

              {/* Column 5: Newsletter */}
              <div className="footer-col footer-col-newsletter">
                <h4 className="footer-col-title">Newsletter</h4>
                <p className="footer-newsletter-text">
                  Get updates on opportunities and new features.
                </p>
                <form className="footer-newsletter-form" onSubmit={handleNewsletterSubmit} noValidate>
                  <div className="footer-input-row">
                    <input
                      type="email"
                      className="footer-email-input"
                      placeholder="Enter your email"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      required
                      aria-label="Enter your email"
                    />
                    <button
                      type="submit"
                      className="footer-submit-btn"
                      style={newsletterSubscribed ? { background: "#16A34A", color: "#FFFFFF" } : undefined}
                      aria-label="Subscribe to newsletter"
                    >
                      {newsletterSubscribed ? <Check className="size-4" /> : <ArrowRight className="size-4" />}
                    </button>
                  </div>
                  <label className="footer-checkbox-label" htmlFor="footerConsentCheckbox">
                    <input
                      type="checkbox"
                      className="footer-checkbox-input"
                      id="footerConsentCheckbox"
                      checked={newsletterConsent}
                      onChange={(e) => setNewsletterConsent(e.target.checked)}
                      required
                    />
                    <span className="footer-custom-check" aria-hidden="true">
                      {newsletterConsent && <Check className="size-3" />}
                    </span>
                    <span className="footer-checkbox-text">I agree to receive updates from AI Tathastu.</span>
                  </label>
                </form>
              </div>
            </div>

            {/* Bottom Sub-Footer Bar */}
            <div className="footer-bottom-divider" />
            <div className="footer-bottom-bar">
              <p className="footer-copyright">© {currentYear} AI Tathastu. All rights reserved.</p>

              <div className="footer-bottom-links">
                <Link href="/privacy" className="footer-legal-btn">
                  Privacy Policy
                </Link>
                <span className="footer-pipe" aria-hidden="true">
                  |
                </span>
                <Link href="/terms" className="footer-legal-btn">
                  Terms of Service
                </Link>
                <span className="footer-pipe" aria-hidden="true">
                  |
                </span>
                <Link href="/privacy#cookies" className="footer-legal-btn">
                  Cookie Policy
                </Link>
                <span className="footer-pipe" aria-hidden="true">
                  |
                </span>

                {/* Language Selector Dropdown */}
                <div className="footer-lang-dropdown">
                  <button
                    type="button"
                    className="footer-lang-btn"
                    aria-expanded={langDropdownOpen}
                    aria-haspopup="listbox"
                    aria-label="Select language"
                    onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                  >
                    <Globe className="size-4 footer-globe-icon" />
                    <span>{currentLang}</span>
                    <ChevronDown className="size-3.5 footer-chevron-icon" />
                  </button>
                  {langDropdownOpen && (
                    <div className="footer-lang-menu open" role="listbox">
                      {["English", "हिन्दी (Hindi)", "Español", "Français", "Deutsch", "日本語"].map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          className={`footer-lang-option ${currentLang === lang ? "active" : ""}`}
                          role="option"
                          aria-selected={currentLang === lang}
                          onClick={() => {
                            setCurrentLang(lang);
                            setLangDropdownOpen(false);
                          }}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
