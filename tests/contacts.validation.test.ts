import { describe, expect, it } from "vitest";

import { normalizeMobile, sanitizeMobileInput } from "@/lib/contacts/mobile";
import {
  createContactSchema,
  updateContactSchema,
} from "@/lib/validation/contact";

describe("contact validation helpers", () => {
  it("normalizes 10-digit local mobile numbers", () => {
    expect(normalizeMobile("9876543210")).toBe("9876543210");
    expect(normalizeMobile("98765-43210")).toBe("9876543210");
  });

  it("strips +91 and 91 prefixes to 10 digits", () => {
    expect(normalizeMobile("+91 98765-43210")).toBe("9876543210");
    expect(normalizeMobile("919876543210")).toBe("9876543210");
    expect(normalizeMobile("09876543210")).toBe("9876543210");
  });

  it("sanitizes live form input to at most 10 digits", () => {
    expect(sanitizeMobileInput("98765abc43210")).toBe("9876543210");
    expect(sanitizeMobileInput("+919876543210")).toBe("9876543210");
    expect(sanitizeMobileInput("919876543210")).toBe("9876543210");
    expect(sanitizeMobileInput("09876543210")).toBe("9876543210");
    expect(sanitizeMobileInput("98765432101234")).toBe("9876543210");
  });

  it("rejects numbers that are not exactly 10 digits", () => {
    expect(() => normalizeMobile("+15551234567")).toThrow();
    expect(() => normalizeMobile("987654321")).toThrow();
    expect(() => normalizeMobile("98765432101")).toThrow();
    expect(() => normalizeMobile("5876543210")).toThrow();
  });

  it("rejects unknown fields including organizationId", () => {
    const parsed = createContactSchema.safeParse({
      name: "Test",
      mobile: "9876543210",
      organizationId: "other-org",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts categoryId and address on create", () => {
    const parsed = createContactSchema.safeParse({
      name: "Test",
      mobile: "9876543210",
      categoryId: "cat_vip",
      address: "12 MG Road, Pune",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.categoryId).toBe("cat_vip");
      expect(parsed.data.address).toBe("12 MG Road, Pune");
    }
  });

  it("accepts categoryName on create", () => {
    const parsed = createContactSchema.safeParse({
      name: "Test",
      mobile: "9876543210",
      categoryName: "VIP",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.categoryName).toBe("VIP");
    }
  });

  it("accepts +91 on create and validates as 10-digit local", () => {
    const parsed = createContactSchema.safeParse({
      name: "Test",
      mobile: "+919876543210",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects providing both categoryId and categoryName", () => {
    const parsed = createContactSchema.safeParse({
      name: "Test",
      mobile: "9876543210",
      categoryId: "cat_vip",
      categoryName: "VIP",
    });

    expect(parsed.success).toBe(false);
  });

  it("allows clearing category and address on update", () => {
    const parsed = updateContactSchema.safeParse({
      categoryId: null,
      address: null,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.categoryId).toBeNull();
      expect(parsed.data.address).toBeNull();
    }
  });

  it("accepts an occasionDates key that is not in Prisma's default cuid format", () => {
    // Not every Occasion row in production was created with Prisma's
    // default id generator (some were seeded/migrated with plain hex ids).
    // Membership is verified server-side in applyContactOccasionDates -
    // the schema must not reject a legitimate, existing occasion id just
    // because it doesn't look like a cuid.
    const parsed = updateContactSchema.safeParse({
      occasionDates: { "47c7f87f3a8df2798ba0ca7c6f9b50a1": "1995-03-20" },
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.occasionDates).toEqual({
        "47c7f87f3a8df2798ba0ca7c6f9b50a1": "1995-03-20",
      });
    }
  });

  it("accepts a cuid-format occasionDates key too, and still allows clearing a date with null", () => {
    const parsed = createContactSchema.safeParse({
      name: "Test",
      mobile: "9876543210",
      occasionDates: {
        cljk3x9p20000qzrmn831p1ix: "1990-01-01",
        cljk3x9p20001qzrmzzz1p1iy: null,
      },
    });

    expect(parsed.success).toBe(true);
  });
});
