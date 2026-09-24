"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { UserRole } from "@prisma/client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/ui/feedback";
import { compactSecondaryButtonClass } from "@/components/ui/page";
import type { PlatformOrganizationUser } from "@/lib/admin/org-ops";
import { getOrganizationRoleLabel } from "@/lib/auth/org-role-labels";
import { getAdminClientDetailDict } from "@/lib/i18n/dictionaries/admin-client-detail";
import { useLocale } from "@/lib/i18n/use-locale";

type OrganizationUsersTableProps = {
  organizationId: string;
  users: PlatformOrganizationUser[];
};

export function OrganizationUsersTable({
  organizationId,
  users,
}: OrganizationUsersTableProps) {
  const router = useRouter();
  const dict = getAdminClientDetailDict(useLocale()).usersTable;
  const [pendingAction, setPendingAction] = useState<{
    userId: string;
    type: "status" | "password-reset";
  } | null>(null);
  const [pendingDeactivate, setPendingDeactivate] =
    useState<PlatformOrganizationUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleToggleActiveClick(user: PlatformOrganizationUser) {
    if (user.isActive) {
      setPendingDeactivate(user);
      return;
    }
    void toggleActive(user);
  }

  async function toggleActive(user: PlatformOrganizationUser) {
    setPendingAction({ userId: user.id, type: "status" });
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/v1/admin/organizations/${organizationId}/users/${user.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !user.isActive }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? dict.failedToUpdate);
        return;
      }
      router.refresh();
    } catch {
      setError(dict.failedToUpdate);
    } finally {
      setPendingAction(null);
    }
  }

  async function sendPasswordReset(user: PlatformOrganizationUser) {
    setPendingAction({ userId: user.id, type: "password-reset" });
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/v1/admin/organizations/${organizationId}/users/${user.id}/password-reset`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? dict.failedToSendReset);
        return;
      }
      setMessage(payload.data?.message ?? dict.resetEmailSentDefault);
    } catch {
      setError(dict.failedToSendReset);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      {error ? (
        <p className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
          <tr>
            <th className="px-4 py-3 font-medium">{dict.name}</th>
            <th className="px-4 py-3 font-medium">{dict.email}</th>
            <th className="px-4 py-3 font-medium">{dict.role}</th>
            <th className="px-4 py-3 font-medium">{dict.status}</th>
            <th className="px-4 py-3 font-medium">{dict.action}</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-stone-500" colSpan={5}>
                {dict.noUsers}
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr key={user.id} className="border-b border-stone-100">
                <td className="px-4 py-3 font-medium text-stone-900">
                  {user.name}
                </td>
                <td className="px-4 py-3 text-stone-600">{user.email}</td>
                <td className="px-4 py-3 text-stone-600">
                  {getOrganizationRoleLabel(
                    user.role === "STAFF" ? UserRole.STAFF : UserRole.ADMIN,
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    label={user.isActive ? dict.active : dict.inactive}
                    tone={user.isActive ? "success" : "neutral"}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={compactSecondaryButtonClass}
                      disabled={pendingAction !== null}
                      onClick={() => handleToggleActiveClick(user)}
                    >
                      {pendingAction?.userId === user.id &&
                      pendingAction.type === "status"
                        ? dict.updating
                        : user.isActive
                          ? dict.deactivate
                          : dict.activate}
                    </button>
                    <button
                      type="button"
                      className={compactSecondaryButtonClass}
                      disabled={!user.isActive || pendingAction !== null}
                      onClick={() => sendPasswordReset(user)}
                    >
                      {pendingAction?.userId === user.id &&
                      pendingAction.type === "password-reset"
                        ? dict.sending
                        : dict.sendPasswordReset}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <ConfirmDialog
        open={pendingDeactivate !== null}
        title={dict.deactivateTitle}
        message={
          pendingDeactivate
            ? dict.deactivateMessage(pendingDeactivate.name, pendingDeactivate.email)
            : null
        }
        confirmLabel={dict.deactivateConfirm}
        cancelLabel={dict.cancel}
        busy={pendingAction !== null}
        onConfirm={() => {
          if (pendingDeactivate) {
            void toggleActive(pendingDeactivate);
          }
          setPendingDeactivate(null);
        }}
        onCancel={() => setPendingDeactivate(null)}
      />
    </div>
  );
}
