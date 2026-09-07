import { describe, expect, it } from "vitest";

import { UserRole } from "@prisma/client";

import {
  DASHBOARD_HOME_PATHS,
  DASHBOARD_NAV,
  collectNavHrefs,
  getActiveNavHref,
  getDashboardHomePathsForRole,
  getDashboardNavForRole,
  isNavItemActive,
  pathnameMatchesHref,
} from "@/lib/dashboard/navigation";

describe("dashboard navigation mapping", () => {
  it("exposes all required customer-facing destinations via existing routes", () => {
    const hrefs = collectNavHrefs(DASHBOARD_NAV);

    expect(hrefs).toEqual([
      "/dashboard",
      "/dashboard/contacts",
      "/dashboard/messages/send",
      "/dashboard/settings/greeting-routes",
      "/dashboard/activity",
      "/dashboard/settings/channels",
      "/dashboard/settings/billing",
    ]);
  });

  it("groups destinations under clearer labels without Queue in primary nav", () => {
    const labels = DASHBOARD_NAV.flatMap((item) =>
      item.children
        ? [item.label, ...item.children.map((child) => child.label)]
        : [item.label],
    );

    expect(labels).toContain("Today");
    expect(labels).toContain("Send Messages");
    expect(labels).toContain("Automatic Greetings");
    expect(labels).toContain("Activity");
    expect(labels).not.toContain("Templates");
    expect(labels).not.toContain("AI writing tools");
    expect(labels).toContain("Channels");
    expect(labels).toContain("Billing");
    expect(labels).not.toContain("SMS");
    expect(labels).not.toContain("WhatsApp");
    expect(labels).not.toContain("Messages");
    expect(labels).not.toContain("Advanced SMS");
    expect(labels).not.toContain("Queue");
    expect(labels).not.toContain("Deliveries");
    expect(labels).not.toContain("Birthdays");
    expect(labels).not.toContain("Delivery results");
  });

  it("keeps Home exact so nested pages do not stay active", () => {
    expect(pathnameMatchesHref("/dashboard", "/dashboard")).toBe(true);
    expect(pathnameMatchesHref("/dashboard/contacts", "/dashboard")).toBe(
      false,
    );
  });

  it("activates Contacts for list and nested contact routes", () => {
    expect(getActiveNavHref("/dashboard/contacts")).toBe("/dashboard/contacts");
    expect(getActiveNavHref("/dashboard/contacts/new")).toBe(
      "/dashboard/contacts",
    );
    expect(getActiveNavHref("/dashboard/contacts/abc/edit")).toBe(
      "/dashboard/contacts",
    );
  });

  it("activates Channels for SMS, WhatsApp, and Advanced SMS template routes", () => {
    expect(getActiveNavHref("/dashboard/settings/channels")).toBe(
      "/dashboard/settings/channels",
    );
    expect(getActiveNavHref("/dashboard/settings/sms")).toBe(
      "/dashboard/settings/channels",
    );
    expect(getActiveNavHref("/dashboard/settings/whatsapp")).toBe(
      "/dashboard/settings/channels",
    );
    expect(getActiveNavHref("/dashboard/settings/sms/templates")).toBe(
      "/dashboard/settings/channels",
    );
    expect(
      getActiveNavHref("/dashboard/settings/sms/templates/some-id"),
    ).toBe("/dashboard/settings/channels");
  });

  it("marks Activity, Automatic Greetings, Send Messages, and Settings active", () => {
    const activity = DASHBOARD_NAV.find((item) => item.label === "Activity");
    const automatic = DASHBOARD_NAV.find(
      (item) => item.label === "Automatic Greetings",
    );
    const createGreeting = DASHBOARD_NAV.find(
      (item) => item.label === "Send Messages",
    );
    const settings = DASHBOARD_NAV.find((item) => item.label === "Settings");

    expect(activity).toBeDefined();
    expect(automatic).toBeDefined();
    expect(createGreeting).toBeDefined();
    expect(settings).toBeDefined();

    expect(isNavItemActive("/dashboard/settings/channels", settings!)).toBe(
      true,
    );
    expect(isNavItemActive("/dashboard/messages/send", createGreeting!)).toBe(
      true,
    );
    expect(
      isNavItemActive("/dashboard/settings/greeting-routes", automatic!),
    ).toBe(true);
    expect(isNavItemActive("/dashboard/activity", activity!)).toBe(true);
    expect(
      isNavItemActive("/dashboard/settings/sms/templates", settings!),
    ).toBe(true);
    expect(isNavItemActive("/dashboard/contacts", settings!)).toBe(false);
  });

  it("does not list Advanced SMS in the Settings sidepanel", () => {
    const settings = DASHBOARD_NAV.find((item) => item.label === "Settings");
    expect(settings?.children).toBeDefined();
    expect(
      settings!.children!.some(
        (child) => child.href === "/dashboard/settings/sms/templates",
      ),
    ).toBe(false);
    expect(settings!.children!.map((child) => child.label)).toEqual([
      "Channels",
      "Billing",
    ]);
  });

  it("keeps the home path list short and mapped to existing routes", () => {
    expect(DASHBOARD_HOME_PATHS).toHaveLength(3);
    expect(DASHBOARD_HOME_PATHS.map(({ title, href }) => ({ title, href }))).toEqual([
      { title: "Add contacts", href: "/dashboard/contacts" },
      { title: "Send messages", href: "/dashboard/messages/send" },
      { title: "Review activity", href: "/dashboard/activity" },
    ]);
  });

  it("hides ADMIN-only nav items for STAFF", () => {
    const hrefs = collectNavHrefs(getDashboardNavForRole(UserRole.STAFF));

    expect(hrefs).toContain("/dashboard/contacts");
    expect(hrefs).not.toContain("/dashboard/templates");
    expect(hrefs).toContain("/dashboard/activity");
    expect(hrefs).not.toContain("/dashboard/messages/send");
    expect(hrefs).not.toContain("/dashboard/ai");
    expect(hrefs).not.toContain("/dashboard/settings/channels");
    expect(hrefs).not.toContain("/dashboard/settings/billing");
    expect(hrefs).not.toContain("/dashboard/settings/greeting-routes");

    const home = getDashboardHomePathsForRole(UserRole.STAFF);
    expect(home.map((p) => p.href)).toEqual([
      "/dashboard/contacts",
      "/dashboard/activity",
    ]);
  });

  it("keeps full nav for ADMIN", () => {
    expect(collectNavHrefs(getDashboardNavForRole(UserRole.ADMIN))).toEqual(
      collectNavHrefs(DASHBOARD_NAV),
    );
  });
});
