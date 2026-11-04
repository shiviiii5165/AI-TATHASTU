"use client";

import { useEffect, useRef } from "react";

export function InteractiveMarkup({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const root = containerRef.current;

    // 1. Reveal on scroll observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -20px 0px" }
    );

    const revealElements = root.querySelectorAll(".reveal-on-scroll");
    revealElements.forEach((el) => observer.observe(el));

    // Fallback: ensure all elements are visible after 500ms
    const timer = setTimeout(() => {
      revealElements.forEach((el) => el.classList.add("is-visible"));
    }, 500);

    // 2. Language dropdown handlers
    const langBtn = root.querySelector<HTMLButtonElement>("#footerLangBtn");
    const langDropdown = root.querySelector<HTMLDivElement>("#footerLangDropdown");
    const currentLangLabel = root.querySelector<HTMLElement>("#footerCurrentLang");
    const langOptions = root.querySelectorAll<HTMLButtonElement>(".footer-lang-option");

    const onLangBtnClick = (e: MouseEvent) => {
      e.stopPropagation();
      if (!langDropdown || !langBtn) return;
      const isOpen = langDropdown.classList.toggle("open");
      langBtn.setAttribute("aria-expanded", String(isOpen));
    };

    langBtn?.addEventListener("click", onLangBtnClick);

    langOptions.forEach((opt) => {
      opt.addEventListener("click", () => {
        const lang = opt.getAttribute("data-lang");
        if (currentLangLabel && lang) currentLangLabel.textContent = lang;
        langOptions.forEach((o) => o.classList.toggle("active", o === opt));
        langDropdown?.classList.remove("open");
        langBtn?.setAttribute("aria-expanded", "false");
      });
    });

    const onDocClick = (e: MouseEvent) => {
      if (langDropdown && !langDropdown.contains(e.target as Node)) {
        langDropdown.classList.remove("open");
        langBtn?.setAttribute("aria-expanded", "false");
      }
    };
    document.addEventListener("click", onDocClick);

    // 3. Team filter tabs if present
    const filterButtons = root.querySelectorAll<HTMLButtonElement>(".team-filter-btn");
    const memberCards = root.querySelectorAll<HTMLElement>(".team-member-card");
    if (filterButtons.length > 0) {
      filterButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          filterButtons.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          const filter = btn.getAttribute("data-filter") || "all";
          memberCards.forEach((card) => {
            const cat = card.getAttribute("data-category") || "";
            if (filter === "all" || cat === filter) {
              card.style.display = "";
            } else {
              card.style.display = "none";
            }
          });
        });
      });
    }

    // 4. Contact / Newsletter form feedback
    const footerForm = root.querySelector<HTMLFormElement>("#footerNewsletterForm");
    const footerEmail = root.querySelector<HTMLInputElement>("#footerEmailInput");
    const footerSubmit = root.querySelector<HTMLButtonElement>("#footerSubmitBtn");
    const footerConsent = root.querySelector<HTMLInputElement>("#footerConsentCheck");

    const onNewsletterSubmit = (e: Event) => {
      e.preventDefault();
      const val = footerEmail?.value.trim() || "";
      if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        alert("Please enter a valid email address.");
        return;
      }
      if (footerConsent && !footerConsent.checked) {
        alert("Please agree to receive updates.");
        return;
      }
      // No sign-up backend yet: never say an address was saved when it wasn't.
      alert("Newsletter sign-up isn't open yet, so your email wasn't saved.");
    };
    footerForm?.addEventListener("submit", onNewsletterSubmit);

    // 5. Copy to clipboard handler with feedback
    const copyElements = root.querySelectorAll<HTMLElement>("[data-copy], .btn-copy");
    const onCopyClick = (e: MouseEvent) => {
      const target = e.currentTarget as HTMLElement;
      const textToCopy = target.getAttribute("data-copy") || target.textContent?.trim() || "";
      if (textToCopy && typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          target.classList.add("copied");
          setTimeout(() => {
            target.classList.remove("copied");
          }, 2000);
        }).catch(() => {});
      }
    };
    copyElements.forEach((el) => el.addEventListener("click", onCopyClick));

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      langBtn?.removeEventListener("click", onLangBtnClick);
      document.removeEventListener("click", onDocClick);
      footerForm?.removeEventListener("submit", onNewsletterSubmit);
      copyElements.forEach((el) => el.removeEventListener("click", onCopyClick));
    };
  }, [html]);


  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-white text-[#0F172A] overflow-x-hidden w-full max-w-full"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
