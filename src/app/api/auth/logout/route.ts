import { logoutUser } from "@/lib/auth/logout";

export async function POST() {
  await logoutUser();
  return new Response(null, { status: 204 });
}
