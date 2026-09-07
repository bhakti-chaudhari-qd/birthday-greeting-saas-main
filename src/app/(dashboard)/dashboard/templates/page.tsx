import { UserRole } from "@prisma/client";

import { TemplatesPageClient } from "@/components/templates/templates-page-client";
import { getAuthContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const auth = await getAuthContext();

  return <TemplatesPageClient canManage={auth?.role === UserRole.ADMIN} />;
}
