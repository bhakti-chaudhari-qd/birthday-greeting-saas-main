import { redirect } from "next/navigation";

import {
  activityTabForQueueStatus,
  buildActivityRedirect,
} from "@/lib/activity/legacy-redirect";

export default async function LegacyQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirect(
    buildActivityRedirect(
      activityTabForQueueStatus(
        typeof params.status === "string" ? params.status : undefined,
      ),
      params,
    ),
  );
}
