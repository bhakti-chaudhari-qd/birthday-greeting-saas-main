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
import { DASHBOARD_NAV, collectNavHrefs } from "@/lib/dashboard/navigation";

describe("authenticated app shell navigation", () => {
  beforeEach(() => {
    pathnameRef.current = "/dashboard";
  });

  it("renders brand, grouped labels, nested destinations, and the top-bar user menu", () => {
    const html = renderToStaticMarkup(
      <AppShell user={{ name: "Ada Lovelace", email: "ada@example.com" }}>
        <div>Page body</div>
      </AppShell>,
    );

    expect(html).toContain("Birthday Greeting");
    expect(html).toContain("Home");
    expect(html).toContain("Contacts");
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

    // Sign out lives in the user menu on the far right of the top bar, which
    // only renders its items once opened - so a static render shows the
    // trigger (the user's name) and no Sign out item anywhere, including the
    // mobile menu drawer.
    expect(html).toContain("Ada Lovelace");
    expect(html).not.toContain("Sign out");

    // Collapsed Settings: top-level hrefs render; nested Settings children do not.
    const settingsChildHrefs = new Set(
      DASHBOARD_NAV.flatMap((item) =>
        item.children ? item.children.map((child) => child.href) : [],
      ),
    );
    for (const href of collectNavHrefs()) {
      if (settingsChildHrefs.has(href)) {
        expect(html).not.toContain(`href="${href}"`);
      } else {
        expect(html).toContain(`href="${href}"`);
      }
    }

    expect(html).toContain('href="/dashboard/activity"');
  });

  it("styles the Settings trigger as active when a Settings route is active", () => {
    pathnameRef.current = "/dashboard/settings/channels";

    const html = renderToStaticMarkup(
      <AppShell user={{ name: "Ada Lovelace", email: "ada@example.com" }}>
        <div>Channels</div>
      </AppShell>,
    );

    // Settings children (Channels, Billing, ...) only render once the
    // dropdown is opened by a click - unreachable from a static server
    // render. What a static render CAN show is that the Settings trigger
    // itself reflects the active-group state for a nested settings route.
    expect(html).toContain("Settings");
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toMatch(
      /aria-haspopup="menu"[^>]*class="[^"]*border-stone-900 bg-stone-900 text-white/,
    );
  });

  it("marks the active Settings group without expanding its children", () => {
    pathnameRef.current = "/dashboard/settings/channels";

    const html = renderToStaticMarkup(
      <AppShell user={{ name: "Ada Lovelace", email: "ada@example.com" }}>
        <div>Channels</div>
      </AppShell>,
    );

    expect(html).toMatch(
      /aria-haspopup="menu"[^>]*class="[^"]*border-stone-900 bg-stone-900 text-white/,
    );
    expect(html).not.toContain('href="/dashboard/settings/channels"');
  });
});
