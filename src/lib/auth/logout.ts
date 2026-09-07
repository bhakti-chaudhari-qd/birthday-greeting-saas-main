import { destroySession } from "@/lib/auth/session";

export async function logoutUser() {
  await destroySession();
}
