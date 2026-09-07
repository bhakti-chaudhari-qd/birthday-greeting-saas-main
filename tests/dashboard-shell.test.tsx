import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathnameRef = { current: "/dashboard" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    "aria-current"?: "page" | boolean;
    onClick?: () => void;
  }) => (
    <a
      href={href}
      className={props.className}
      aria-current={props["aria-current"]}
      onClick={props.onClick}
    >
      {children}
    </a>
  ),
}));

import { AppShell } from "@/components/dashboard/app-shell";
import { collectNavHrefs } from "@/lib/dashboard/navigation";

describe("authenticated app shell navigation", () => {
  beforeEach(() => {
    pathnameRef.current = "/dashboard";
  });

  it("renders brand, grouped labels, nested destinations, and a single top-bar sign out", () => {
    const html = renderToStaticMarkup(
      <AppShell user={{ name: "Ada Lovelace", email: "ada@example.com" }}>
        <div>Page body</div>
      </AppShell>,
    );

    expect(html).toContain("Birthday Greeting");
    expect(html).toContain("Today");
    expect(html).toContain("Contacts");
    expect(html).toContain("Automatic Greetings");
    expect(html).toContain("Activity");
    expect(html).not.toContain("Templates");
    expect(html).toContain("Send Messages");
    expect(html).not.toContain("AI writing tools");
    expect(html).toContain("Settings");
    expect(html).not.toContain("Channels");
    expect(html).not.toContain("Billing");
    expect(html).not.toContain("Advanced SMS");
    expect(html).not.toContain(">Messages<");
    expect(html).not.toContain(">SMS<");
    expect(html).not.toContain(">WhatsApp<");
    expect(html).toContain("Page body");
    expect(html).toContain("Menu");

    expect(html).not.toContain("Queue");
    expect(html).not.toContain(">Birthdays<");
    expect(html).not.toContain(">Delivery results<");

    // Sign out lives in the sticky top bar only (not the mobile menu drawer)
    expect(html.match(/Sign out/g)?.length).toBe(1);

    // Collapsed Settings: top-level hrefs render; nested Settings children do not.
    for (const href of collectNavHrefs()) {
      if (
        href === "/dashboard/settings/channels" ||
        href === "/dashboard/settings/billing"
      ) {
        expect(html).not.toContain(`href="${href}"`);
      } else {
        expect(html).toContain(`href="${href}"`);
      }
    }

    expect(html).toContain('href="/dashboard/activity"');
  });

  it("shows Settings children when a Settings route is active", () => {
    pathnameRef.current = "/dashboard/settings/channels";

    const html = renderToStaticMarkup(
      <AppShell user={{ name: "Ada Lovelace", email: "ada@example.com" }}>
        <div>Channels</div>
      </AppShell>,
    );

    expect(html).toContain("Settings");
    expect(html).toContain("Channels");
    expect(html).toContain("Billing");
    expect(html).toContain('href="/dashboard/settings/channels"');
    expect(html).toMatch(
      /href="\/dashboard\/settings\/channels"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/dashboard\/settings\/channels"/,
    );
  });

  it("marks the active nested Channels route with aria-current", () => {
    pathnameRef.current = "/dashboard/settings/channels";

    const html = renderToStaticMarkup(
      <AppShell user={{ name: "Ada Lovelace", email: "ada@example.com" }}>
        <div>Channels</div>
      </AppShell>,
    );

    expect(html).toContain('href="/dashboard/settings/channels"');
    expect(html).toMatch(
      /href="\/dashboard\/settings\/channels"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/dashboard\/settings\/channels"/,
    );
  });
});
