"use client";

import { SendMessagesPageClient } from "@/components/automation/send-messages-page-client";
import { LiveReadinessBanner } from "@/components/settings/live-readiness-banner";

export default function MessagesPage() {
  return (
    <div className="flex flex-col gap-4">
      <LiveReadinessBanner className="gap-2" />
      <SendMessagesPageClient />
    </div>
  );
}
