import { describe, expect, it } from "vitest";

import { getDemoLiveOtpTemplateContent } from "@/lib/templates/demo-live-otp";
import { deriveRealSmsReadiness } from "@/lib/templates/readiness";

describe("demo live OTP template", () => {
  it("is structurally ready for real SMS with the Quickly Design DLT content", () => {
    const content = getDemoLiveOtpTemplateContent();
    const readiness = deriveRealSmsReadiness(content);

    expect(content.name).toBe("Demo Live OTP");
    expect(content.dltTemplateId).toBe("1707174533394491241");
    expect(readiness.realSmsReady).toBe(true);
    expect(readiness.realSmsStatusLabel).toBe("Ready for Real SMS");
  });
});
