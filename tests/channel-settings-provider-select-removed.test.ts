import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * These settings components self-fetch their config inside useEffect, so
 * renderToStaticMarkup only ever shows their "Loading configuration..."
 * fallback - there's no testing-library/jsdom in this codebase to await the
 * effect and inspect the real rendered form. Verifying against the source
 * text directly is the honest option available: it precisely checks the
 * "Provider" label/<select> is gone and replaced with the static gateway/
 * service label, without pretending to have full rendered-DOM coverage.
 */
function readComponentSource(relativePath: string): string {
  return readFileSync(join(__dirname, "..", relativePath), "utf8");
}

describe("channel settings no longer present a meaningless provider dropdown", () => {
  it("SMS settings: no Provider <select>, shows a static 'SMS gateway' value", () => {
    const source = readComponentSource("src/components/settings/sms-channel-settings.tsx");

    expect(source).not.toContain('>Provider<');
    expect(source).not.toMatch(/<select[\s\S]*?<option value="CUSTOM_HTTP">Custom HTTP<\/option>[\s\S]*?<\/select>/);
    expect(source).toContain("SMS gateway");
    expect(source).toContain("getCustomerSmsProviderLabel(form.provider)");
  });

  it("WhatsApp settings: no Provider <select>, shows a static 'WhatsApp gateway' value, keeps the real Authentication method <select>", () => {
    const source = readComponentSource(
      "src/components/settings/whatsapp-channel-settings.tsx",
    );

    expect(source).not.toContain('>Provider<');
    expect(source).not.toMatch(/<select[\s\S]*?<option value="CUSTOM_HTTP">Custom HTTP<\/option>[\s\S]*?<\/select>/);
    expect(source).toContain("WhatsApp gateway");
    expect(source).toContain("getCustomerWhatsAppProviderLabel(form.provider)");

    // Regression guard: the *real*, two-option Authentication method select
    // (Username & Password vs API Key) is unrelated to provider selection
    // and must not have been removed by this cleanup.
    expect(source).toContain("Authentication method");
    expect(source).toContain('<option value="password">Username &amp; Password</option>');
    expect(source).toContain('<option value="apiKey">API Key</option>');
  });

  it("Email settings: no Provider <select>, shows a static 'Email service' value", () => {
    const source = readComponentSource("src/components/settings/email-channel-settings.tsx");

    expect(source).not.toContain('>Provider<');
    expect(source).not.toMatch(/<select[\s\S]*?<option value="RESEND">Resend<\/option>[\s\S]*?<\/select>/);
    expect(source).toContain("Email service");
    expect(source).toContain("getCustomerEmailProviderLabel(form.provider)");

    // Regression guard: the real configuration fields must remain untouched.
    expect(source).toContain("From email");
    expect(source).toContain("From name");
    expect(source).toContain("Resend API key");
  });

  it("no component reintroduces a TEST/simulation option in the provider display", () => {
    const files = [
      "src/components/settings/sms-channel-settings.tsx",
      "src/components/settings/whatsapp-channel-settings.tsx",
      "src/components/settings/email-channel-settings.tsx",
    ];

    for (const file of files) {
      const source = readComponentSource(file);
      expect(source).not.toContain('<option value="TEST"');
    }
  });
});
