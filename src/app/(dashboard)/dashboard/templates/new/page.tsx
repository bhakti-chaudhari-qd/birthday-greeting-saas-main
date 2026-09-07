import Link from "next/link";

import {
  TemplateForm,
  type TemplateFormChannel,
} from "@/components/templates/template-form";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";

type PageProps = {
  searchParams: Promise<{ channel?: string }>;
};

function resolveChannel(value: string | undefined): TemplateFormChannel {
  if (value === "WHATSAPP" || value === "EMAIL") {
    return value;
  }
  return "SMS";
}

const CHANNEL_TITLES: Record<TemplateFormChannel, string> = {
  SMS: "New SMS template",
  WHATSAPP: "New WhatsApp template",
  EMAIL: "New Email template",
};

export default async function NewTemplatePage({ searchParams }: PageProps) {
  const { channel: channelParam } = await searchParams;
  const channel = resolveChannel(channelParam);

  return (
    <PageShell>
      <Link
        href="/dashboard/templates"
        className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <span aria-hidden>←</span> Back to Manage Templates
      </Link>
      <PageHeader title={CHANNEL_TITLES[channel]} />
      <Panel className="p-5">
        <TemplateForm mode="create" channel={channel} />
      </Panel>
    </PageShell>
  );
}
