"use client";

import { useState } from "react";

export function LandingNav() {
  const [open, setOpen] = useState(false);

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
          Features
        </a>
        <a href="#how-it-works" onClick={() => setOpen(false)}>
          How It Works
        </a>
        <a href="#use-cases" onClick={() => setOpen(false)}>
          Use Cases
        </a>
        <a href="#contact" onClick={() => setOpen(false)}>
          Contact
        </a>
        <a
          className="btn btn-primary btn-sm nav-cta"
          href="/register"
          onClick={() => setOpen(false)}
        >
          Get Started
        </a>
      </nav>
    </>
  );
}
