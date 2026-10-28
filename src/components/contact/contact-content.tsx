"use client";

import React, { useState, useSyncExternalStore } from "react";
import Link from "next/link";

interface CategoryOption {
  id: "general" | "partnerships" | "support" | "feedback";
  title: string;
  desc: string;
  icon: string;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: "general",
    title: "Product & General Enquiries",
    desc: "Questions about AI Tathastu or its features.",
    icon: "💬",
  },
  {
    id: "partnerships",
    title: "Partnerships & Collaborations",
    desc: "Schools, colleges, teams and research partnerships.",
    icon: "🤝",
  },
  {
    id: "support",
    title: "Technical Support",
    desc: "Report a problem or get help using the platform.",
    icon: "🛠️",
  },
  {
    id: "feedback",
    title: "Feedback & Suggestions",
    desc: "Share an idea to help us improve.",
    icon: "💡",
  },
];

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: "What is AI Tathastu?",
    a: "AI Tathastu brings your skills, projects and goals together to help you explore learning, collaboration and career opportunities.",
  },
  {
    q: "Which product should I ask about?",
    a: "Choose the relevant enquiry category above. We'll use it to understand your question.",
  },
  {
    q: "How can I discuss a partnership?",
    a: "Choose Partnerships & Collaborations and tell us about your institution, team or idea.",
  },
  {
    q: "Where can I get technical help?",
    a: "Choose Technical Support and describe the issue, including the steps needed to reproduce it if relevant.",
  },
];

export function ContactContent() {
  // Mobile Nav Drawer
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Form State
  const [category, setCategory] = useState<CategoryOption["id"]>("general");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);

  // Submission Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [referenceId, setReferenceId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Field Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // FAQ Accordion State (single item open)
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Footer Language Dropdown
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState("English");
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterConsent, setNewsletterConsent] = useState(true);
  const currentYear = useSyncExternalStore(
    () => () => {},
    () => new Date().getFullYear(),
    () => 2025
  );

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const handleCategorySelect = (id: CategoryOption["id"]) => {
    setCategory(id);
    if (errors.category) {
      setErrors((prev) => ({ ...prev, category: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const newErrors: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      newErrors.fullName = "Please enter your full name.";
    }
    if (!email.trim() || !validateEmail(email)) {
      newErrors.email = "Please provide a valid email address.";
    }
    if (!subject.trim() || subject.trim().length < 2) {
      newErrors.subject = "Please enter a subject.";
    }
    if (!message.trim() || message.trim().length < 10) {
      newErrors.message = "Please describe your enquiry (at least 10 characters).";
    }
    if (!consent) {
      newErrors.consent = "You must agree to the processing of your details.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim(),
          category,
          subject: subject.trim(),
          message: message.trim(),
          consent,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.ok) {
        setSubmitSuccess(true);
        setReferenceId(data.referenceId || "#TAT-8492");
      } else {
        setErrorMessage(
          data?.error || "We couldn't send your message. Please try again."
        );
      }
    } catch {
      setErrorMessage("We couldn't send your message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFullName("");
    setEmail("");
    setSubject("");
    setMessage("");
    setConsent(false);
    setCategory("general");
    setSubmitSuccess(false);
    setReferenceId("");
    setErrorMessage("");
    setErrors({});
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(newsletterEmail)) {
      alert("Please enter a valid email address.");
      return;
    }
    if (!newsletterConsent) {
      alert("Please agree to receive updates from AI Tathastu.");
      return;
    }
    setNewsletterSubscribed(true);
    setNewsletterEmail("");
  };

  return (
    <div className="contact-page-root">
      {/* Ambient Glowing Mesh & Blueprint Background */}
      <div className="page-ambient-mesh" aria-hidden="true" />
      <div className="page-grid-overlay" aria-hidden="true" />

      {/* Decorative Floating Spheres */}
      <div
        className="floating-orb orb-amber-lg"
        style={{ left: "3%", top: "18%" }}
        aria-hidden="true"
      />
      <div
        className="floating-orb orb-pink-md"
        style={{ right: "4%", top: "14%" }}
        aria-hidden="true"
      />
      <div
        className="floating-orb orb-purple-sm"
        style={{ right: "7%", top: "42%" }}
        aria-hidden="true"
      />

      {/* ============================================================
           GLOBAL HEADER
      ============================================================ */}
      <header className="site-nav" role="banner">
        <div className="wrap site-nav-inner">
          <Link href="/" className="brand-link" aria-label="AI Tathastu Home">
            <div className="brand-logo-mark" aria-hidden="true">
              AT
            </div>
            <div className="brand-text-col">
              <span className="brand-name">AI Tathastu</span>
              <span className="brand-sub">
                You imagine. AI Tathastu makes it happen.
              </span>
            </div>
          </Link>

          <nav className="desktop-main-nav" aria-label="Main Navigation">
            <ul className="nav-links-list">
              <li>
                <Link href="/#ecosystem">Platform</Link>
              </li>
              <li>
                <Link href="/#how">How it works</Link>
              </li>
              <li>
                <Link href="/about">About</Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="active"
                  aria-current="page"
                >
                  Support
                </Link>
              </li>
            </ul>
          </nav>

          <div className="nav-right-actions">
            <Link href="/dashboard" className="nav-cta-btn" id="navCreateProfileBtn">
              Open Dashboard <span aria-hidden="true">→</span>
            </Link>
            <button
              type="button"
              className="about-mobile-menu-toggle"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="about-mobile-drawer" role="dialog" aria-modal="true">
            <ul className="mobile-drawer-links">
              <li>
                <Link
                  href="/#ecosystem"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Platform
                </Link>
              </li>
              <li>
                <Link href="/#how" onClick={() => setMobileMenuOpen(false)}>
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/about" onClick={() => setMobileMenuOpen(false)}>
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="active"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Support
                </Link>
              </li>
              <li style={{ marginTop: "12px" }}>
                <Link
                  href="/dashboard"
                  className="nav-cta-btn"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Open Dashboard →
                </Link>
              </li>
            </ul>
          </div>
        )}
      </header>

      {/* ============================================================
           HERO SECTION (Two-Column with Connected Illustration)
      ============================================================ */}
      <section className="contact-hero" aria-labelledby="contactHeroTitle">
        <div className="wrap">
          <div className="contact-hero-grid">
            {/* Left Column: Copy */}
            <div className="contact-hero-copy">
              <div className="eyebrow-pill">
                <span className="eyebrow-dot" aria-hidden="true" />
                LET&apos;S TALK
              </div>
              <h1 className="contact-hero-title" id="contactHeroTitle">
                Good things start with a{" "}
                <span className="gradient-accent">conversation.</span>
              </h1>
              <p className="contact-hero-desc">
                Have a question, idea or problem? Tell us about it. We&apos;ll
                help you find the right next step.
              </p>
              <div className="contact-reassurance-line">
                <span className="reassurance-icon" aria-hidden="true">
                  ✨
                </span>
                <span>
                  Product questions, partnerships and support — all in one
                  place.
                </span>
              </div>
            </div>

            {/* Right Column: Connected Illustration Stage */}
            <div
              className="contact-visual-stage"
              aria-label="Connected support communication channel"
            >
              {/* Decorative Subtle Orbit Rings */}
              <div className="contact-orbit-ring c-orbit-1" aria-hidden="true" />
              <div className="contact-orbit-ring c-orbit-2" aria-hidden="true" />

              {/* Connecting SVG Lines */}
              <svg
                className="hero-connectors-svg"
                viewBox="0 0 460 380"
                fill="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="connGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#EA580C" stopOpacity="0.55" />
                    <stop offset="50%" stopColor="#FF2A85" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.5" />
                  </linearGradient>
                </defs>
                {/* Lines connecting central card center (230, 190) to 4 corner nodes */}
                <path
                  d="M 230 190 Q 150 110 75 55"
                  stroke="url(#connGrad)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                <path
                  d="M 230 190 Q 310 110 385 55"
                  stroke="url(#connGrad)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                <path
                  d="M 230 190 Q 150 270 75 325"
                  stroke="url(#connGrad)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                <path
                  d="M 230 190 Q 310 270 385 325"
                  stroke="url(#connGrad)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              </svg>

              {/* Central Card */}
              <div className="contact-center-hub">
                <div className="hub-icon-bubble" aria-hidden="true">
                  💬
                </div>
                <h2 className="hub-title">Open channel</h2>
                <p className="hub-tagline">
                  Questions, ideas and feedback. We&apos;re here to listen.
                </p>
              </div>

              {/* 4 Connected Feature Labels */}
              <div className="hero-feature-pill pill-pos-1">
                <span className="pill-icon">💬</span>
                <span className="pill-text">Product questions</span>
              </div>
              <div className="hero-feature-pill pill-pos-2">
                <span className="pill-icon">💡</span>
                <span className="pill-text">Research &amp; learning</span>
              </div>
              <div className="hero-feature-pill pill-pos-3">
                <span className="pill-icon">🤝</span>
                <span className="pill-text">Campus partnerships</span>
              </div>
              <div className="hero-feature-pill pill-pos-4">
                <span className="pill-icon">🛠️</span>
                <span className="pill-text">Technical support</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
           MAIN CONTACT SECTION (Enquiry Categories & Message Form)
      ============================================================ */}
      <section
        className="section-contact-body"
        id="contact"
        aria-labelledby="contactSectionHeading"
      >
        <div className="wrap">
          <div className="contact-section-header">
            <h2
              className="contact-section-title"
              id="contactSectionHeading"
            >
              How can we help?
            </h2>
            <p className="contact-section-sub">
              Choose a topic and send us a message.
            </p>
          </div>

          <div className="contact-form-grid">
            {/* Left Panel: 4 Enquiry Categories */}
            <div className="categories-col-wrap">
              <h3 className="categories-headline">Select a topic</h3>
              <p className="categories-subtext">
                Your selection automatically tunes your message context.
              </p>

              <div
                className="categories-cards-list"
                role="radiogroup"
                aria-label="Enquiry categories"
              >
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <div
                      key={cat.id}
                      className={`category-select-card ${
                        isSelected ? "selected" : ""
                      }`}
                      id={`catCard-${cat.id}`}
                      tabIndex={0}
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleCategorySelect(cat.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleCategorySelect(cat.id);
                        }
                      }}
                    >
                      <div className="cat-icon-bubble" aria-hidden="true">
                        {cat.icon}
                      </div>
                      <div className="cat-content">
                        <h4 className="cat-title">{cat.title}</h4>
                        <p className="cat-desc">{cat.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Panel: Contact Form */}
            <div className="contact-form-box">
              {!submitSuccess ? (
                <form
                  id="contactMessageForm"
                  onSubmit={handleSubmit}
                  noValidate
                >
                  <h3 className="form-heading">Send us a message</h3>
                  <p className="form-sub">
                    Tell us a little about your enquiry.
                  </p>

                  {errorMessage && (
                    <div
                      className="form-alert-error"
                      role="alert"
                      id="formErrorMessage"
                    >
                      <span className="alert-icon" aria-hidden="true">
                        ⚠️
                      </span>
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Full Name */}
                  <div className="form-group-field">
                    <label htmlFor="contactFullName" className="field-label">
                      Full name <span className="req-mark">*</span>
                    </label>
                    <input
                      type="text"
                      id="contactFullName"
                      className={`field-input ${
                        errors.fullName ? "has-error" : ""
                      }`}
                      placeholder="Your name"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (errors.fullName) {
                          setErrors((prev) => ({ ...prev, fullName: "" }));
                        }
                      }}
                      required
                      aria-required="true"
                      aria-invalid={Boolean(errors.fullName)}
                      aria-describedby={
                        errors.fullName ? "fullNameError" : undefined
                      }
                    />
                    {errors.fullName && (
                      <div
                        className="field-error-hint show"
                        id="fullNameError"
                      >
                        {errors.fullName}
                      </div>
                    )}
                  </div>

                  {/* Work or Student Email */}
                  <div className="form-group-field">
                    <label htmlFor="contactEmail" className="field-label">
                      Work or student email <span className="req-mark">*</span>
                    </label>
                    <input
                      type="email"
                      id="contactEmail"
                      className={`field-input ${
                        errors.email ? "has-error" : ""
                      }`}
                      placeholder="you@university.edu"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) {
                          setErrors((prev) => ({ ...prev, email: "" }));
                        }
                      }}
                      required
                      aria-required="true"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={
                        errors.email ? "emailError" : undefined
                      }
                    />
                    {errors.email && (
                      <div className="field-error-hint show" id="emailError">
                        {errors.email}
                      </div>
                    )}
                  </div>

                  {/* Enquiry Category Dropdown (Synchronized with left category cards) */}
                  <div className="form-group-field">
                    <label
                      htmlFor="contactCategorySelect"
                      className="field-label"
                    >
                      Enquiry category <span className="req-mark">*</span>
                    </label>
                    <select
                      id="contactCategorySelect"
                      className="field-select"
                      value={category}
                      onChange={(e) =>
                        handleCategorySelect(
                          e.target.value as CategoryOption["id"]
                        )
                      }
                      required
                      aria-required="true"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subject */}
                  <div className="form-group-field">
                    <label htmlFor="contactSubject" className="field-label">
                      Subject <span className="req-mark">*</span>
                    </label>
                    <input
                      type="text"
                      id="contactSubject"
                      className={`field-input ${
                        errors.subject ? "has-error" : ""
                      }`}
                      placeholder="What is this about?"
                      value={subject}
                      onChange={(e) => {
                        setSubject(e.target.value);
                        if (errors.subject) {
                          setErrors((prev) => ({ ...prev, subject: "" }));
                        }
                      }}
                      required
                      aria-required="true"
                      aria-invalid={Boolean(errors.subject)}
                      aria-describedby={
                        errors.subject ? "subjectError" : undefined
                      }
                    />
                    {errors.subject && (
                      <div
                        className="field-error-hint show"
                        id="subjectError"
                      >
                        {errors.subject}
                      </div>
                    )}
                  </div>

                  {/* Message */}
                  <div className="form-group-field">
                    <label htmlFor="contactMessage" className="field-label">
                      Message <span className="req-mark">*</span>
                    </label>
                    <textarea
                      id="contactMessage"
                      className={`field-textarea ${
                        errors.message ? "has-error" : ""
                      }`}
                      rows={4}
                      placeholder="Describe your question or issue..."
                      value={message}
                      onChange={(e) => {
                        setMessage(e.target.value);
                        if (errors.message) {
                          setErrors((prev) => ({ ...prev, message: "" }));
                        }
                      }}
                      required
                      aria-required="true"
                      aria-invalid={Boolean(errors.message)}
                      aria-describedby={
                        errors.message ? "messageError" : undefined
                      }
                    />
                    {errors.message && (
                      <div
                        className="field-error-hint show"
                        id="messageError"
                      >
                        {errors.message}
                      </div>
                    )}
                  </div>

                  {/* Consent Checkbox */}
                  <div className="checkbox-wrap">
                    <input
                      type="checkbox"
                      id="contactConsent"
                      className="checkbox-input"
                      checked={consent}
                      onChange={(e) => {
                        setConsent(e.target.checked);
                        if (errors.consent) {
                          setErrors((prev) => ({ ...prev, consent: "" }));
                        }
                      }}
                      required
                      aria-required="true"
                    />
                    <label
                      htmlFor="contactConsent"
                      className="checkbox-text"
                    >
                      I agree to the processing of my details to respond to this
                      enquiry. (See our{" "}
                      <Link href="/privacy" className="privacy-link">
                        Privacy Policy
                      </Link>
                      )
                    </label>
                  </div>
                  {errors.consent && (
                    <div
                      className="field-error-hint show"
                      id="consentError"
                      style={{ marginTop: "-18px", marginBottom: "18px" }}
                    >
                      {errors.consent}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="btn-submit-message"
                    id="submitContactBtn"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="spinner-bubble" aria-hidden="true" />
                        <span>Sending…</span>
                      </>
                    ) : (
                      <>
                        <span>Send message</span>
                        <span aria-hidden="true">→</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Success Confirmation Panel */
                <div
                  className="form-success-state active"
                  id="formSuccessState"
                  role="status"
                  aria-live="polite"
                >
                  <div className="success-check-badge" aria-hidden="true">
                    ✓
                  </div>
                  <h3 className="success-title">
                    Message sent. We&apos;ll get back to you as soon as we can.
                  </h3>
                  <p className="success-desc">
                    Your enquiry reference code is{" "}
                    <strong className="reference-pill" id="submissionRefCode">
                      {referenceId}
                    </strong>
                    . Our team will review your note and respond directly to your
                    email.
                  </p>
                  <button
                    type="button"
                    className="btn-reset-form"
                    id="btnResetForm"
                    onClick={handleReset}
                  >
                    Send another note ↺
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
           FREQUENTLY ASKED QUESTIONS (Concise 4-Item Accordion)
      ============================================================ */}
      <section className="section-faq" id="faq" aria-labelledby="faqHeading">
        <div className="wrap">
          <div className="faq-header-wrap">
            <h2 className="faq-section-title" id="faqHeading">
              Frequently asked questions
            </h2>
            <p className="faq-section-sub">
              Quick answers to common questions.
            </p>
          </div>

          <div className="faq-container">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={faq.q}
                  className={`faq-item ${isOpen ? "open" : ""}`}
                >
                  <button
                    type="button"
                    className="faq-trigger"
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                    id={`faq-btn-${index}`}
                    onClick={() => toggleFaq(index)}
                  >
                    <span>{faq.q}</span>
                    <span className="faq-chevron" aria-hidden="true">
                      ▼
                    </span>
                  </button>
                  <div
                    className="faq-content-pane"
                    id={`faq-answer-${index}`}
                    role="region"
                    aria-labelledby={`faq-btn-${index}`}
                  >
                    <p className="faq-answer-text">{faq.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================
           FINAL CTA & FOOTER
      ============================================================ */}
      <footer className="exact-footer" id="footer">
        {/* Ambient background waves & spheres */}
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
          {/* Navigation Grid */}
          <div className="footer-nav-grid">
            {/* Brand Column */}
            <div className="footer-col footer-col-brand">
              <div className="footer-brand-lockup">
                <Link href="/" className="footer-brand-link">
                  <span className="footer-brand-icon" aria-hidden="true">
                    AT
                  </span>
                  <div className="footer-brand-text">
                    <span className="footer-brand-name">AI Tathastu</span>
                    <span className="footer-brand-tagline">
                      You imagine. AI Tathastu makes it happen.
                    </span>
                  </div>
                </Link>
              </div>
              <p className="footer-brand-desc">
                Connect your skills, projects and resume. Discover what you&apos;re good at, what to learn next and where to go.
              </p>
            </div>

            {/* Product Column */}
            <div className="footer-col">
              <h3 className="footer-col-title">Product</h3>
              <ul className="footer-nav-list">
                <li>
                  <Link href="/#ecosystem">Platform</Link>
                </li>
              </ul>
            </div>

            {/* Resources Column */}
            <div className="footer-col">
              <h3 className="footer-col-title">Resources</h3>
              <ul className="footer-nav-list">
                <li>
                  <Link href="/#docs">Documentation</Link>
                </li>
              </ul>
            </div>

            {/* Company Column */}
            <div className="footer-col">
              <h3 className="footer-col-title">Company</h3>
              <ul className="footer-nav-list">
                <li>
                  <Link href="/about">About Us</Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    style={{ color: "#FF2A85", fontWeight: 700 }}
                  >
                    Support &amp; Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Newsletter Column */}
            <div className="footer-col footer-col-newsletter">
              <h3 className="footer-col-title">Newsletter</h3>
              <p className="footer-newsletter-text">
                Get updates on opportunities and new features.
              </p>
              {newsletterSubscribed ? (
                <p className="newsletter-success-note">
                  ✓ Thank you for subscribing!
                </p>
              ) : (
                <form
                  className="footer-newsletter-form"
                  onSubmit={handleNewsletterSubmit}
                  noValidate
                >
                  <div className="footer-input-row">
                    <input
                      type="email"
                      className="footer-email-input"
                      placeholder="Enter your email"
                      required
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      aria-label="Enter your email"
                    />
                    <button
                      type="submit"
                      className="footer-submit-btn"
                      aria-label="Subscribe to newsletter"
                    >
                      →
                    </button>
                  </div>
                  <label className="footer-checkbox-label" htmlFor="contactFooterConsent">
                    <input
                      type="checkbox"
                      className="footer-checkbox-input"
                      id="contactFooterConsent"
                      checked={newsletterConsent}
                      onChange={(e) => setNewsletterConsent(e.target.checked)}
                      required
                    />
                    <span className="footer-custom-check" aria-hidden="true">
                      {newsletterConsent && "✓"}
                    </span>
                    <span className="footer-checkbox-text">
                      I agree to receive updates from AI Tathastu.
                    </span>
                  </label>
                </form>
              )}
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="footer-bottom-divider" />
          <div className="footer-bottom-bar">
            <p className="footer-copyright">
              © {currentYear} AI Tathastu. All rights reserved.
            </p>

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

              {/* Language Selector */}
              <div
                className={`footer-lang-dropdown ${
                  langMenuOpen ? "open" : ""
                }`}
              >
                <button
                  type="button"
                  className="footer-lang-btn"
                  aria-expanded={langMenuOpen}
                  aria-haspopup="listbox"
                  aria-label="Select language"
                  onClick={() => setLangMenuOpen(!langMenuOpen)}
                >
                  🌐 <span>{currentLang}</span> <span aria-hidden="true">▼</span>
                </button>
                {langMenuOpen && (
                  <div className="footer-lang-menu" role="listbox">
                    {[
                      "English",
                      "हिन्दी",
                      "Español",
                      "Français",
                      "Deutsch",
                      "日本語",
                    ].map((l) => (
                      <button
                        key={l}
                        type="button"
                        className={`footer-lang-option ${
                          currentLang === l ? "active" : ""
                        }`}
                        role="option"
                        aria-selected={currentLang === l}
                        onClick={() => {
                          setCurrentLang(l);
                          setLangMenuOpen(false);
                        }}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
