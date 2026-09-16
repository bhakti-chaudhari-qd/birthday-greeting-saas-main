import type { Metadata } from "next";

import { LandingContent } from "./landing-content";
import "./landing.css";

export const metadata: Metadata = {
  title: "Birthday Greeting — Personalized Documents Made Simple",
  description:
    "Design reusable greeting templates, add dynamic variables, and generate personalized PDFs for every recipient.",
};

// Static page, so Next sends a long shared-cache TTL by default - the VPS's
// nginx has no deploy-aware invalidation, so an unbounded TTL means a stale
// build could get stuck in its cache indefinitely. Bound it here instead.
export const revalidate = 300;

export default function Home() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin=""
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap"
        rel="stylesheet"
      />

      <LandingContent />
    </>
  );
}
