import { Channel } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  countExecutableAutomationRoutes,
  deriveOrganizationHealth,
} from "@/lib/admin/organization-health";

describe("platform organization health", () => {
  it("counts only enabled routes with templates and active channel config", () => {
    expect(
      countExecutableAutomationRoutes(
        [
          {
            channel: Channel.SMS,
            enabled: true,
            hasActiveTemplate: true,
          },
          {
            channel: Channel.EMAIL,
            enabled: true,
            hasActiveTemplate: true,
          },
          {
            channel: Channel.WHATSAPP,
            enabled: true,
            hasActiveTemplate: false,
          },
          {
            channel: Channel.SMS,
            enabled: false,
            hasActiveTemplate: true,
          },
        ],
        new Set([Channel.SMS, Channel.WHATSAPP]),
      ),
    ).toEqual({
      enabledRouteCount: 3,
      executableRouteCount: 1,
    });
  });

  it("does not treat a selected inactive template as executable", () => {
    expect(
      countExecutableAutomationRoutes(
        [
          {
            channel: Channel.SMS,
            enabled: true,
            hasActiveTemplate: false,
          },
        ],
        new Set([Channel.SMS]),
      ),
    ).toEqual({
      enabledRouteCount: 1,
      executableRouteCount: 0,
    });
  });

  it("derives deterministic attention reasons in a stable order", () => {
    expect(
      deriveOrganizationHealth({
        isActive: true,
        enabledRouteCount: 2,
        executableRouteCount: 1,
        monthlySuccessCount: 8,
        monthlyFailureCount: 2,
        queuePendingCount: 3,
        queueFailedCount: 1,
      }),
    ).toEqual({
      label: "NEEDS_ATTENTION",
      reasons: [
        "Some enabled routes need a template or active channel",
        "1 failed queue item(s)",
        "Monthly delivery success is below 90%",
      ],
    });
  });

  it("keeps inactive and healthy labels predictable", () => {
    expect(
      deriveOrganizationHealth({
        isActive: false,
        enabledRouteCount: 0,
        executableRouteCount: 0,
        monthlySuccessCount: 0,
        monthlyFailureCount: 0,
        queuePendingCount: 0,
        queueFailedCount: 0,
      }),
    ).toEqual({
      label: "INACTIVE",
      reasons: ["Organization is inactive"],
    });

    expect(
      deriveOrganizationHealth({
        isActive: true,
        enabledRouteCount: 1,
        executableRouteCount: 1,
        monthlySuccessCount: 10,
        monthlyFailureCount: 1,
        queuePendingCount: 2,
        queueFailedCount: 0,
      }),
    ).toEqual({
      label: "HEALTHY",
      reasons: ["2 queued item(s); no health issues detected"],
    });
  });
});
