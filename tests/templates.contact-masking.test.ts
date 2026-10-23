import { describe, expect, it } from "vitest";

import { renderTemplate, templateValuesForContact } from "@/lib/templates/variables";

describe("templateValuesForContact masks admin-added contact PII", () => {
  const baseContact = {
    name: "Alex",
    mobile: "9876543210",
    email: "alex@example.com",
    address: "123 Main St",
  };

  it("uses the real mobile/email for a contact the client added themselves", () => {
    const values = templateValuesForContact({
      ...baseContact,
      addedByPlatformAdmin: false,
    });

    expect(values.mobile).toBe("9876543210");
    expect(values.email).toBe("alex@example.com");
  });

  it("masks mobile/email for a contact a Platform Admin added on the client's behalf", () => {
    const values = templateValuesForContact({
      ...baseContact,
      addedByPlatformAdmin: true,
    });

    expect(values.mobile).not.toBe("9876543210");
    expect(values.email).not.toBe("alex@example.com");
    // Matches the display masking convention in src/lib/contacts/mask.ts.
    expect(values.mobile).toBe("******3210");
    expect(values.email).toBe("al***@example.com");
  });

  it("defaults to unmasked when addedByPlatformAdmin is not provided (client-added contacts never set it)", () => {
    const values = templateValuesForContact(baseContact);

    expect(values.mobile).toBe("9876543210");
    expect(values.email).toBe("alex@example.com");
  });

  it("the rendered message text itself never contains the real value for an admin-added contact", () => {
    const rendered = renderTemplate("Call {{mobile}} or email {{email}}", {
      ...templateValuesForContact({ ...baseContact, addedByPlatformAdmin: true }),
    });

    expect(rendered).not.toContain("9876543210");
    expect(rendered).not.toContain("alex@example.com");
  });
});
