import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DashboardHomeSummary } from "@/lib/dashboard/home-summary";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={props.className}>
      {children}
    </a>
  ),
}));

import { DashboardHome } from "@/components/dashboard/dashboard-home";

const readySummary: DashboardHomeSummary = {
  todayDateLabel: "Friday, 17 July 2026",
  todayDateIso: "2026-07-17",
  automation: { running: true, nextRunLabel: "6:15 PM" },
  scheduledTodayCount: 12,
  activeContactsCount: 528,
  channels: { whatsappConnected: true, smsConnected: true },
  alerts: [],
  runningAutomations: [
    {
      key: "rule-1:WHATSAPP",
      occasionLabel: "Birthday",
      categoryName: "Friends",
      channelLabel: "WhatsApp",
      sendTimeLabel: "6:15 PM",
    },
    {
      key: "rule-2:SMS",
      occasionLabel: "Birthday",
      categoryName: "VIP",
      channelLabel: "SMS",
      sendTimeLabel: "8:00 AM",
    },
  ],
  missedQueue: null,
  upcomingToday: {
    items: [
      {
        id: "q1",
        timeLabel: "4:30 PM",
        occasionLabel: "Anniversary",
        contactName: "Sagar",
        channel: "EMAIL",
        channelLabel: "Email",
        status: "pending",
      },
      {
        id: "q2",
        timeLabel: "5:43 PM",
        occasionLabel: "Birthday",
        contactName: "Maheen",
        channel: "WHATSAPP",
        channelLabel: "WhatsApp",
        status: "pending",
      },
      {
        id: "q3",
        timeLabel: "6:15 PM",
        occasionLabel: "Birthday",
        contactName: "Ishika",
        channel: "WHATSAPP",
        channelLabel: "WhatsApp",
        status: "sending",
      },
    ],
    totalCount: 8,
    viewAllHref: "/dashboard/activity?status=pending&date=2026-07-17",
  },
};

describe("dashboard home presentation", () => {
  it("shows a system status row and the running automations list", () => {
    const html = renderToStaticMarkup(
      <DashboardHome name="Ada Lovelace" summary={readySummary} canManage />,
    );

    expect(html).toContain("Welcome, Ada");
    expect(html).toContain("Manage your birthday automations from one place.");
    expect(html).toContain("Friday, 17 July 2026");
    expect(html).toContain("Running");
    expect(html).toContain("6:15 PM");
    expect(html).toContain("12");
    expect(html).toContain("Scheduled Today");
    // The Today's Greetings card links to Activity so the count is drillable.
    expect(html).toContain('<a href="/dashboard/activity"');
    expect(html).toContain("528");
    expect(html).toContain("Active Contacts");
    expect(html).toContain("Connected");

    expect(html).toContain("Friends");
    expect(html).toContain("VIP");
    expect(html).toContain("Manage");
    expect(html).toContain("Everything looks good");

    // Removed sections from the old reporting-style dashboard.
    expect(html).not.toContain("To greet");
    expect(html).not.toContain("Submitted");
    expect(html).toContain("Refresh dashboard");

    // No shouting section headings and no emoji glyphs.
    expect(html).not.toContain("SYSTEM STATUS");
    expect(html).not.toContain("🟢");
    expect(html).not.toContain("🔴");
    expect(html).not.toContain("⚠");
  });

  it("shows alerts, the empty automations state, and hides admin-only affordances for staff", () => {
    const summary: DashboardHomeSummary = {
      ...readySummary,
      automation: { running: false, nextRunLabel: null },
      channels: null,
      alerts: [
        {
          kind: "failed_today",
          count: 2,
          message: "2 failed greetings today.",
          href: "/dashboard/activity?tab=failed",
          cta: "Review failed",
          tone: "danger",
        },
      ],
      runningAutomations: [],
      missedQueue: { targetDate: "2026-07-16", missedCount: 3 },
      upcomingToday: { items: [], totalCount: 0, viewAllHref: "/dashboard/activity?status=pending&date=2026-07-17" },
    };

    const html = renderToStaticMarkup(
      <DashboardHome
        name="Ada Lovelace"
        summary={summary}
        canManage={false}
      />,
    );

    expect(html).toContain("Paused");
    expect(html).toContain("2 failed greetings today.");
    expect(html).toContain("Review failed");
    expect(html).toContain("No automations yet.");
    expect(html).toContain("Retry Queue");
    expect(html).not.toContain("Everything looks good");
    expect(html).not.toContain(">Manage <");
    expect(html).not.toContain("Create Automation");
  });

  describe("Quick Actions removal (13)", () => {
    it("does not render a Quick Actions section", () => {
      const html = renderToStaticMarkup(
        <DashboardHome name="Ada Lovelace" summary={readySummary} canManage />,
      );

      expect(html).not.toContain("Quick Actions");
      expect(html).not.toContain("Add Contact");
      expect(html).not.toContain("Import CSV");
      expect(html).not.toContain("Send Manual Greeting");
      expect(html).not.toContain("quick-actions-heading");
    });
  });

  describe("Today's Activity is not duplicated onto the dashboard (14)", () => {
    it("does not render a sent-message list, activity feed, or charts", () => {
      const html = renderToStaticMarkup(
        <DashboardHome name="Ada Lovelace" summary={readySummary} canManage />,
      );

      expect(html).not.toContain("Today's Activity");
      expect(html).not.toContain("Recent Sent Messages");
      expect(html).not.toContain("Recent Activity");
    });
  });

  describe("Upcoming Today", () => {
    it("displays upcoming messages with time, occasion, recipient, and channel, in the given order (1, 6)", () => {
      const html = renderToStaticMarkup(
        <DashboardHome name="Ada Lovelace" summary={readySummary} canManage />,
      );

      expect(html).toContain("Today&#x27;s Scheduled");
      expect(html).toContain("4:30 PM");
      expect(html).toContain("Anniversary");
      expect(html).toContain("Sagar");
      expect(html).toContain("Email");
      expect(html).toContain("5:43 PM");
      expect(html).toContain("Maheen");
      expect(html).toContain("6:15 PM");
      expect(html).toContain("Ishika");

      // Rendered in the order the summary provides them (server-sorted).
      const sagarIndex = html.indexOf("Sagar");
      const maheenIndex = html.indexOf("Maheen");
      const ishikaIndex = html.indexOf("Ishika");
      expect(sagarIndex).toBeLessThan(maheenIndex);
      expect(maheenIndex).toBeLessThan(ishikaIndex);
    });

    it("shows a View all link that reuses the existing Activity page with a pending/today filter (4, 15)", () => {
      const html = renderToStaticMarkup(
        <DashboardHome name="Ada Lovelace" summary={readySummary} canManage />,
      );

      expect(html).toContain("View all");
      expect(html).toContain(
        'href="/dashboard/activity?status=pending&amp;date=2026-07-17"',
      );
    });

    it("shows the empty state and hides View all when there are no upcoming messages (11)", () => {
      const summary: DashboardHomeSummary = {
        ...readySummary,
        upcomingToday: {
          items: [],
          totalCount: 0,
          viewAllHref: "/dashboard/activity?status=pending&date=2026-07-17",
        },
      };
      const html = renderToStaticMarkup(
        <DashboardHome name="Ada Lovelace" summary={summary} canManage />,
      );

      expect(html).toContain("No messages scheduled for today.");
      expect(html).not.toContain("View all");
    });

    it("does not render a huge table - only the provided preview rows plus View all when there are more", () => {
      const html = renderToStaticMarkup(
        <DashboardHome name="Ada Lovelace" summary={readySummary} canManage />,
      );

      // 3 preview items provided, totalCount 8 - View all must be present.
      expect(html).toContain("View all");
      expect(html).not.toContain("<table");
    });
  });
});
