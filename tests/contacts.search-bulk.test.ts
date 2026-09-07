import { describe, expect, it } from "vitest";

import { buildContactListWhere } from "@/lib/contacts/serialize";
import {
  bulkContactIdsSchema,
  bulkUpdateContactStatusSchema,
} from "@/lib/validation/contact";

describe("contact search where clause", () => {
  it("searches name and mobile digits only", () => {
    const where = buildContactListWhere("org_1", {
      search: "Raj 987",
      isActive: "all",
    });

    expect(where.organizationId).toBe("org_1");
    expect(where.OR).toEqual([
      { name: { contains: "Raj 987", mode: "insensitive" } },
      { email: { contains: "Raj 987", mode: "insensitive" } },
      { mobile: { contains: "987" } },
    ]);
  });

  it("does not search address or note", () => {
    const where = buildContactListWhere("org_1", {
      search: "MG Road",
      isActive: "true",
    });

    const serialized = JSON.stringify(where);
    expect(serialized).not.toContain("address");
    expect(serialized).not.toContain("note");
    expect(where.isActive).toBe(true);
  });

  it("filters contacts that have a date for the given occasion", () => {
    const where = buildContactListWhere("org_1", {
      isActive: "true",
      occasionId: "occ-anniversary",
    });

    expect(where.occasionDates).toEqual({
      some: { occasionId: "occ-anniversary" },
    });
  });
});

describe("bulkUpdateContactStatusSchema", () => {
  it("accepts a bounded id list", () => {
    const parsed = bulkUpdateContactStatusSchema.safeParse({
      ids: ["c1", "c2"],
      isActive: false,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects more than 200 ids", () => {
    const parsed = bulkUpdateContactStatusSchema.safeParse({
      ids: Array.from({ length: 201 }, (_, i) => `c${i}`),
      isActive: true,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("bulkContactIdsSchema", () => {
  it("accepts ids for delete/export", () => {
    const parsed = bulkContactIdsSchema.safeParse({
      ids: ["a", "b"],
    });
    expect(parsed.success).toBe(true);
  });
});
