import { describe, expect, it } from "vitest";

import {
  buildContactCsvTemplate,
  normalizeCsvHeaderKey,
  parseContactCsv,
  serializeContactsToCsv,
} from "@/lib/contacts/csv";
import { serializeDeliveriesToCsv } from "@/lib/deliveries/csv";
import { getRequestLocale } from "@/lib/i18n/request-locale";

const contact = {
  name: "भक्ति",
  mobile: "9876543210",
  email: "bhakti@example.test",
  occasionDateDetails: [],
  categoryName: "Friend",
  address: "पुणे",
  note: "",
  isActive: true,
};

const firstLine = (csv: string) => csv.split("\n")[0]!;

describe("localized CSV headings", () => {
  it("keeps English headings exactly as before", () => {
    expect(firstLine(serializeContactsToCsv([contact]))).toBe(
      "name,mobile,email,category,address,note,isActive",
    );
    expect(firstLine(serializeDeliveriesToCsv([]))).toBe(
      "contactName,contactMobile,templateName,channel,provider,status,attemptNumber,providerMessageId,errorMessage,createdAt,preview",
    );
  });

  it("writes Hindi and Marathi contact headings", () => {
    expect(firstLine(serializeContactsToCsv([contact], [], [], "hi"))).toBe(
      "नाम,मोबाइल,ईमेल,श्रेणी,पता,नोट,एक्टिव",
    );
    expect(firstLine(serializeContactsToCsv([contact], [], [], "mr"))).toContain(
      "नाव,मोबाइल,ईमेल,श्रेणी,पत्ता,नोंद",
    );
    expect(firstLine(buildContactCsvTemplate([], "hi"))).toBe(
      "नाम,मोबाइल,ईमेल,श्रेणी,पता,नोट,एक्टिव",
    );
  });

  it("writes Hindi and Marathi delivery headings", () => {
    expect(firstLine(serializeDeliveriesToCsv([], "hi"))).toContain("कॉन्टैक्ट का नाम");
    expect(firstLine(serializeDeliveriesToCsv([], "mr"))).toContain("कॉन्टॅक्टचे नाव");
  });

  it.each(["hi", "mr"] as const)(
    "re-imports a %s export with its headings mapped to the right fields",
    (locale) => {
      const csv = serializeContactsToCsv([contact], [], [], locale);
      const parsed = parseContactCsv(csv);

      expect(parsed.errors).toEqual([]);
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0]!.input).toMatchObject({
        name: "भक्ति",
        mobile: "9876543210",
        email: "bhakti@example.test",
        categoryName: "Friend",
        address: "पुणे",
        isActive: true,
      });
    },
  );

  it("normalizes Devanagari names to distinct, non-empty keys", () => {
    expect(normalizeCsvHeaderKey("जन्मदिन (DD-MM-YYYY)")).not.toBe("");
    expect(normalizeCsvHeaderKey("जन्मदिन")).not.toBe(
      normalizeCsvHeaderKey("एनिवर्सरी"),
    );
    expect(normalizeCsvHeaderKey("Mobile Number")).toBe("mobilenumber");
  });
});

describe("getRequestLocale", () => {
  const withCookie = (cookie?: string) =>
    new Request("http://localhost/x", cookie ? { headers: { cookie } } : {});

  it("reads the locale cookie and falls back to English", () => {
    expect(getRequestLocale(withCookie("a=1; locale=mr; b=2"))).toBe("mr");
    expect(getRequestLocale(withCookie("locale=hi"))).toBe("hi");
    expect(getRequestLocale(withCookie("locale=xx"))).toBe("en");
    expect(getRequestLocale(withCookie())).toBe("en");
  });
});
