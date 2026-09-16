"use client";

import { useState } from "react";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { getLandingDict } from "@/lib/i18n/dictionaries/landing";
import { useLocale } from "@/lib/i18n/use-locale";

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const dict = getLandingDict(useLocale()).nav;

  return (
    <>
      <button
        className="nav-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="site-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((current) => !current)}
      >
        <span></span>
        <span></span>
      </button>

      <nav
        className={`nav-links${open ? " open" : ""}`}
        id="site-nav"
        aria-label="Primary"
      >
        <a href="#features" onClick={() => setOpen(false)}>
          {dict.features}
        </a>
        <a href="#how-it-works" onClick={() => setOpen(false)}>
          {dict.howItWorks}
        </a>
        <a href="#use-cases" onClick={() => setOpen(false)}>
          {dict.useCases}
        </a>
        <a href="#contact" onClick={() => setOpen(false)}>
          {dict.contact}
        </a>
        <LanguageSwitcher className="nav-lang-select" />
        <a
          className="btn btn-primary btn-sm nav-cta"
          href="/register"
          onClick={() => setOpen(false)}
        >
          {dict.getStarted}
        </a>
      </nav>
    </>
  );
}
