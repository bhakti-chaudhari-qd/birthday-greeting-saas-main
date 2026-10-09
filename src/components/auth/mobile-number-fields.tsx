"use client";

import { useState } from "react";

import type { Locale } from "@/lib/i18n/constants";
import { useLocale } from "@/lib/i18n/use-locale";

const LABELS: Record<Locale, { whatsappNumber: string; sameAsMobile: string }> = {
  en: { whatsappNumber: "WhatsApp number", sameAsMobile: "Same as mobile number" },
  hi: { whatsappNumber: "WhatsApp नंबर", sameAsMobile: "मोबाइल नंबर ही इस्तेमाल करें" },
  mr: { whatsappNumber: "WhatsApp नंबर", sameAsMobile: "मोबाइल नंबरच वापरा" },
};

type MobileNumberFieldsProps = {
  mobileLabel: string;
  mobilePlaceholder: string;
  /** Caption and input classes come from the host form so the pair matches its other fields. */
  captionClassName: string;
  inputClassName: string;
};

/**
 * The mandatory mobile + WhatsApp number pair every account-creating form
 * collects, submitted as `mobile` and `whatsappNumber`. The WhatsApp number
 * follows the mobile until "Same as mobile number" is unticked.
 */
export function MobileNumberFields({
  mobileLabel,
  mobilePlaceholder,
  captionClassName,
  inputClassName,
}: MobileNumberFieldsProps) {
  const labels = LABELS[useLocale()];
  const [mobile, setMobile] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [sameAsMobile, setSameAsMobile] = useState(true);

  return (
    <>
      <label className="block text-sm">
        <span className={captionClassName}>{mobileLabel}</span>
        <input
          name="mobile"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          className={inputClassName}
          placeholder={mobilePlaceholder}
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          required
        />
      </label>
      <div className="block text-sm">
        <label className="block">
          <span className={captionClassName}>{labels.whatsappNumber}</span>
          <input
            name="whatsappNumber"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            className={`${inputClassName} read-only:bg-stone-50 read-only:text-stone-500`}
            placeholder={mobilePlaceholder}
            value={sameAsMobile ? mobile : whatsappNumber}
            onChange={(event) => setWhatsappNumber(event.target.value)}
            readOnly={sameAsMobile}
            required
          />
        </label>
        <label className="mt-2 flex items-center gap-2 text-stone-700">
          <input
            type="checkbox"
            checked={sameAsMobile}
            onChange={(event) => setSameAsMobile(event.target.checked)}
          />
          {labels.sameAsMobile}
        </label>
      </div>
    </>
  );
}
