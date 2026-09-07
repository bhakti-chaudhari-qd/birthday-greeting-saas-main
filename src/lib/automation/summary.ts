import { formatAutomationSendTimeLabel } from "@/lib/automation/send-time";
import { listOccasionOptions } from "@/lib/occasions/queries";
import { prisma } from "@/lib/db";
import { getOccasionsDayView } from "@/lib/queue/occasions-day-view";

export type AutomationOccasionSummary = {
  occasionId: string;
  occasionName: string;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  sendTimeLabel: string;
};

export type AutomationSummary = {
  anyEnabled: boolean;
  enabledLabels: string[];
  occasions: AutomationOccasionSummary[];
  today: {
    targetDate: string;
    byOccasion: Record<string, number>;
    total: number;
  };
};

export async function getAutomationSummary(
  organizationId: string,
): Promise<AutomationSummary> {
  const [occasions, allContactsRules, todayView] = await Promise.all([
    listOccasionOptions(organizationId),
    prisma.categoryAutomationRule.findMany({
      where: { organizationId, categoryId: null },
    }),
    getOccasionsDayView(organizationId),
  ]);

  const ruleByOccasionId = new Map(
    allContactsRules.map((rule) => [rule.occasionId, rule] as const),
  );

  const occasionSummaries: AutomationOccasionSummary[] = occasions.map(
    (occasion) => {
      const rule = ruleByOccasionId.get(occasion.id);
      const timeSet = rule?.sendHour != null && rule?.sendMinute != null;

      return {
        occasionId: occasion.id,
        occasionName: occasion.name,
        smsEnabled: Boolean(timeSet && rule?.smsEnabled && rule.smsTemplateId),
        whatsappEnabled: Boolean(
          timeSet && rule?.whatsappEnabled && rule.whatsappTemplateId,
        ),
        emailEnabled: Boolean(
          timeSet && rule?.emailEnabled && rule.emailTemplateId,
        ),
        sendTimeLabel: timeSet
          ? `${formatAutomationSendTimeLabel(rule!.sendHour, rule!.sendMinute)} IST`
          : "Send time not set",
      };
    },
  );

  const enabledLabels: string[] = [];
  for (const occasion of occasionSummaries) {
    if (occasion.smsEnabled) enabledLabels.push(`SMS ${occasion.occasionName}`);
    if (occasion.whatsappEnabled)
      enabledLabels.push(`WhatsApp ${occasion.occasionName}`);
    if (occasion.emailEnabled)
      enabledLabels.push(`Email ${occasion.occasionName}`);
  }

  return {
    anyEnabled: enabledLabels.length > 0,
    enabledLabels,
    occasions: occasionSummaries,
    today: {
      targetDate: todayView.targetDate,
      byOccasion: todayView.summary.byOccasion,
      total: todayView.summary.total,
    },
  };
}
