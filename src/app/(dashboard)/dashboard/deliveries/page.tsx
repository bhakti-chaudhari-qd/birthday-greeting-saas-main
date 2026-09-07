import { redirect } from "next/navigation";

import {
  activityTabForDeliveryStatus,
  buildActivityRedirect,
} from "@/lib/activity/legacy-redirect";

export default async function LegacyDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirect(
    buildActivityRedirect(
      activityTabForDeliveryStatus(
        typeof params.status === "string" ? params.status : undefined,
      ),
      params,
    ),
  );
}
