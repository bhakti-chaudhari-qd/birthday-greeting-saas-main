import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

import { TemplatesPageClient } from "@/components/templates/templates-page-client";

describe("TemplatesPageClient tabs", () => {
  it("defaults to Message Templates, preserving the SMS/WhatsApp/Email channel tabs and search", () => {
    const html = renderToStaticMarkup(<TemplatesPageClient canManage={true} />);

    expect(html).toContain("Message Templates");
    expect(html).toContain("Document Templates");
    // Message Templates tab is selected by default.
    expect(html).toMatch(/Message Templates<\/button>/);

    // Existing channel-level behavior is unchanged.
    expect(html).toContain(">SMS<");
    expect(html).toContain(">WhatsApp<");
    expect(html).toContain(">Email<");
    expect(html).toContain("Search by template name or occasion");
    expect(html).toContain("+ Add Approved Template");
  });

  it("updates the page description to mention both message and document templates", () => {
    const html = renderToStaticMarkup(<TemplatesPageClient canManage={true} />);

    expect(html).toContain(
      "Manage message and document templates used by automations and personalized sends.",
    );
    expect(html).not.toContain("Store approved templates used by automations and manual sends.");
  });

  it("does not render a fourth SMS/WhatsApp/Email/Documents channel tab", () => {
    const html = renderToStaticMarkup(<TemplatesPageClient canManage={true} />);

    // The channel tablist must only ever contain SMS/WhatsApp/Email - Document
    // Templates is a separate top-level tab, not a fourth channel.
    const channelTablist = html.match(
      /role="tablist" aria-label="Channel"[\s\S]*?<\/div>/,
    )?.[0];
    expect(channelTablist).toBeDefined();
    expect(channelTablist).not.toContain("Document");
  });
});
