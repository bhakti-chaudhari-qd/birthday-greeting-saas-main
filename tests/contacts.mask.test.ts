import { describe, expect, it } from "vitest";

import { maskEmailForDisplay, maskMobileForDisplay } from "@/lib/contacts/mask";
import { serializeContact } from "@/lib/contacts/serialize";

describe("maskMobileForDisplay", () => {
  it("keeps the last 4 digits and masks the rest", () => {
    expect(maskMobileForDisplay("9876543210")).toBe("******3210");
  });

  it("leaves short values unmasked (nothing meaningful to hide)", () => {
    expect(maskMobileForDisplay("1234")).toBe("1234");
    expect(maskMobileForDisplay("")).toBe("");
  });
});

describe("maskEmailForDisplay", () => {
  it("keeps up to 2 leading local-part characters and the full domain", () => {
    expect(maskEmailForDisplay("john@example.com")).toBe("jo***@example.com");
  });

  it("keeps a minimum mask length even for very short local parts", () => {
    expect(maskEmailForDisplay("a@example.com")).toBe("a***@example.com");
  });

  it("falls back to *** for a malformed address", () => {
    expect(maskEmailForDisplay("not-an-email")).toBe("***");
  });
});

function buildContact(overrides: Partial<{
  mobile: string;
  email: string | null;
  addedByPlatformAdmin: boolean;
}> = {}) {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "contact-1",
    organizationId: "org-1",
    name: "Alice",
    mobile: overrides.mobile ?? "9876543210",
    email: overrides.email === undefined ? "alice@example.com" : overrides.email,
    categoryId: null,
    address: null,
    note: null,
    attributes: {},
    isActive: true,
    addedByPlatformAdmin: overrides.addedByPlatformAdmin ?? false,
    createdAt: now,
    updatedAt: now,
    category: null,
    categoryTags: [],
    occasionDates: [],
  } as unknown as Parameters<typeof serializeContact>[0];
}

describe("serializeContact masking", () => {
  it("masks an admin-added contact by default (every client-side viewer)", () => {
    const serialized = serializeContact(
      buildContact({ addedByPlatformAdmin: true }),
    );
    expect(serialized.mobile).toBe("******3210");
    expect(serialized.email).toBe("al***@example.com");
    expect(serialized.mobileMasked).toBe(true);
    expect(serialized.addedByPlatformAdmin).toBe(true);
  });

  it("shows the real values only when a Platform Admin route asks to reveal", () => {
    const serialized = serializeContact(
      buildContact({ addedByPlatformAdmin: true }),
      { revealAdminAdded: true },
    );
    expect(serialized.mobile).toBe("9876543210");
    expect(serialized.email).toBe("alice@example.com");
    expect(serialized.mobileMasked).toBe(false);
  });

  it("does not mask a client-added contact", () => {
    const serialized = serializeContact(
      buildContact({ addedByPlatformAdmin: false }),
    );
    expect(serialized.mobile).toBe("9876543210");
    expect(serialized.email).toBe("alice@example.com");
    expect(serialized.mobileMasked).toBe(false);
  });

  it("leaves a null email as null under masking", () => {
    const serialized = serializeContact(
      buildContact({ addedByPlatformAdmin: true, email: null }),
    );
    expect(serialized.email).toBeNull();
  });
});
