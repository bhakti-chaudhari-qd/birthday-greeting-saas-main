import type { UserRole } from "@prisma/client";

export type AuthContext = {
  userId: string;
  organizationId: string;
  role: UserRole;
  email: string;
  name: string;
};
