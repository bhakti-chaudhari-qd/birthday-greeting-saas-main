"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { ChannelSetupSteps } from "@/components/settings/channel-setup-steps";
import { EmailChannelSettings } from "@/components/settings/email-channel-settings";
import { SmsChannelSettings } from "@/components/settings/sms-channel-settings";
import { WhatsAppChannelSettings } from "@/components/settings/whatsapp-channel-settings";
import {
  PageHeader,
  PageShell,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";

export type ChannelSettingsTab = "sms" | "whatsapp" | "email";

function parseChannelTab(value: string | null): ChannelSettingsTab {
  if (value === "whatsapp" || value === "email") {
    return value;
  }
  return "sms";
}

const TAB_LABEL: Record<ChannelSettingsTab, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
};

function ChannelSettingsTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ChannelSettingsTab>(() =>
    parseChannelTab(searchParams.get("tab")),
  );

  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      setTab(parseChannelTab(params.get("tab")));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const selectTab = useCallback(
    (next: ChannelSettingsTab) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "sms") {
        params.delete("tab");
      } else {
        params.set("tab", next);
      }
      const query = params.toString();
      const nextUrl = query ? `${pathname}?${query}` : pathname;
      window.history.replaceState(window.history.state, "", nextUrl);
    },
    [pathname, searchParams],
  );

  return (
    <PageShell>
      <PageHeader title="Channels" />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Channel">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "sms"}
          className={tab === "sms" ? primaryButtonClass : secondaryButtonClass}
          onClick={() => selectTab("sms")}
        >
          SMS
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "whatsapp"}
          className={
            tab === "whatsapp" ? primaryButtonClass : secondaryButtonClass
          }
          onClick={() => selectTab("whatsapp")}
        >
          WhatsApp
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "email"}
          className={tab === "email" ? primaryButtonClass : secondaryButtonClass}
          onClick={() => selectTab("email")}
        >
          Email
        </button>
      </div>

      <ChannelSetupSteps channel={tab} />

      <div role="tabpanel" aria-label={TAB_LABEL[tab]}>
        {tab === "sms" ? <SmsChannelSettings /> : null}
        {tab === "whatsapp" ? <WhatsAppChannelSettings /> : null}
        {tab === "email" ? <EmailChannelSettings /> : null}
      </div>
    </PageShell>
  );
}

export default function ChannelSettingsPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <PageHeader title="Channels" />
          <p className="text-sm text-stone-600">Loading channel settings…</p>
        </PageShell>
      }
    >
      <ChannelSettingsTabs />
    </Suspense>
  );
}
