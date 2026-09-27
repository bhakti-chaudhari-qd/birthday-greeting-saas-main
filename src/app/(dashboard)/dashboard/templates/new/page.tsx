import { NewTemplatePageClient } from "@/components/templates/new-template-page-client";
import type { TemplateFormChannel } from "@/components/templates/template-form";

type PageProps = {
  searchParams: Promise<{ channel?: string }>;
};

function resolveChannel(value: string | undefined): TemplateFormChannel {
  if (value === "WHATSAPP" || value === "EMAIL") {
    return value;
  }
  return "SMS";
}

export default async function NewTemplatePage({ searchParams }: PageProps) {
  const { channel: channelParam } = await searchParams;
  const channel = resolveChannel(channelParam);

  return <NewTemplatePageClient channel={channel} />;
}
