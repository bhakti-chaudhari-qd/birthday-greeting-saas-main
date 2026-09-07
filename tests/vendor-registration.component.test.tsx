import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  VendorRegistrationForm,
  VendorRegistrationSubmitted,
} from "@/components/auth/vendor-registration-form";

describe("vendor registration UI", () => {
  it("shows safe invite details and never accepts a mobile", () => {
    const html = renderToStaticMarkup(
      <VendorRegistrationForm
        vendorName="Acme Messaging"
        maskedMobile="******3210"
      />,
    );

    expect(html).toContain("Register Acme Messaging");
    expect(html).toContain("******3210");
    expect(html).not.toContain("9876543210");
    expect(html).not.toContain('name="mobile"');
    expect(html).toContain('name="contactName"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
  });

  it("confirms approval is pending without signing the user in", () => {
    const html = renderToStaticMarkup(
      <VendorRegistrationSubmitted vendorName="Acme Messaging" />,
    );

    expect(html).toContain("Registration submitted");
    expect(html).toContain("awaiting platform approval");
    expect(html).not.toContain("vendor/portal");
    expect(html).not.toContain("Sign in now");
  });
});
