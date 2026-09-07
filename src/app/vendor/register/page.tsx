import type { Metadata } from "next";

import { VendorRegistrationForm } from "@/components/auth/vendor-registration-form";
import {
  INVALID_VENDOR_INVITE_MESSAGE,
  inspectVendorRegistrationInvite,
} from "@/lib/auth/vendor-registration";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vendor registration",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function VendorRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const invite = await inspectVendorRegistrationInvite(token);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f4ef] px-4 py-12">
      <div className="w-full max-w-md">
        {invite ? (
          <VendorRegistrationForm {...invite} />
        ) : (
          <div className="rounded-xl border border-stone-200/90 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-stone-900">
              Registration unavailable
            </h1>
            <p className="mt-3 text-sm text-stone-600">
              {INVALID_VENDOR_INVITE_MESSAGE}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
