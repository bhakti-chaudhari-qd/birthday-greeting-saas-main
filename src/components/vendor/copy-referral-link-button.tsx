"use client";

import { useState } from "react";

import { secondaryButtonClass } from "@/components/ui/page";

type CopyReferralLinkButtonProps = {
  referralCode: string;
};

export function CopyReferralLinkButton({
  referralCode,
}: CopyReferralLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/register?ref=${encodeURIComponent(referralCode)}`;

    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className={secondaryButtonClass}
      onClick={() => void handleCopy()}
    >
      {copied ? "Copied" : "Copy signup link"}
    </button>
  );
}
