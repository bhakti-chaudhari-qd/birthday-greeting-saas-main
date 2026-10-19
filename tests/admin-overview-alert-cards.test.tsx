import { Channel, SubscriptionPlan } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import {
  AdminOverviewClient,
  type AdminOverviewClientProps,
} from "@/components/admin/admin-overview-client";
import type { PlatformPlanAlerts } from "@/lib/admin/plan-alerts";

function render(planAlerts: PlatformPlanAlerts) {
  const props = {
    stats: {
      organizationCount: 0,
      activeOrganizationCount: 0,
      inactiveOrganizationCount: 0,
      userCount: 0,
      contactCount: 0,
      messagesSentThisMonth: 0,
      planBreakdown: [],
    },
    usage: {
      deliveriesToday: 0,
      deliveriesThisMonth: 0,
      successRatePercent: null,
      successCount: 0,
      failureCount: 0,
      queuePending: 0,
      queueSending: 0,
      queueFailedStuck: 0,
    },
    organizations: [],
    vendors: [],
    planAlerts,
  } as unknown as AdminOverviewClientProps;

  return renderToStaticMarkup(<AdminOverviewClient {...props} />);
}

describe("admin overview alert cards", () => {
  it("shows the empty text and nothing to click when the counts are 0", () => {
    const html = render({ warningDays: 8, expiringPlans: [], exhaustedChannels: [] });

    expect(html).toContain("No plan ends in the next few days.");
    expect(html).toContain("No client has used up a limit this month.");
    expect(html).not.toContain("View list");
  });

  it("keeps the client list closed behind a clickable header until opened", () => {
    const html = render({
      warningDays: 8,
      expiringPlans: [
        {
          organizationId: "org-1",
          organizationName: "Acme Sweets",
          plan: SubscriptionPlan.PRO,
          paidUntil: "2026-10-24T06:00:00.000Z",
          daysLeft: 5,
        },
      ],
      exhaustedChannels: [
        {
          organizationId: "org-2",
          organizationName: "Beta Bakers",
          plan: SubscriptionPlan.CUSTOM,
          limits: [{ channel: Channel.WHATSAPP, used: 500, limit: 500 }],
        },
      ],
    });

    expect(html.match(/View list/g)?.length).toBe(2);
    expect(html.match(/aria-expanded="false"/g)?.length).toBe(2);
    expect(html).not.toContain("Acme Sweets");
    expect(html).not.toContain("Beta Bakers");
  });
});
