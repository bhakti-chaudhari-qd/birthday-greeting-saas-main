"use client";

import { Panel } from "@/components/ui/page";
import {
  getChannelSetupDict,
  type ChannelSetupChannel,
} from "@/lib/i18n/dictionaries/channel-setup";
import { useLocale } from "@/lib/i18n/use-locale";

export function ChannelSetupSteps({ channel }: { channel: ChannelSetupChannel }) {
  const dict = getChannelSetupDict(useLocale());

  return (
    <Panel className="p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-stone-900">{dict.heading[channel]}</h2>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-stone-600">
        {dict.steps[channel].map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </Panel>
  );
}
