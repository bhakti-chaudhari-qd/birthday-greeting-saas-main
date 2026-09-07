import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AUTHENTICATED_LANDING_PATH,
  navigateToAuthenticatedLanding,
} from "@/lib/auth/navigate-after-auth";

describe("auth navigation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses full document navigation to the authenticated landing page", () => {
    const assign = vi.fn();

    vi.stubGlobal("window", {
      location: {
        assign,
      },
    });

    navigateToAuthenticatedLanding();

    expect(assign).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith(AUTHENTICATED_LANDING_PATH);
  });
});
