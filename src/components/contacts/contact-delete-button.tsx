"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { compactSecondaryButtonClass } from "@/components/ui/page";

type ContactDeleteButtonProps = {
  contactId: string;
  contactName: string;
  /** When set, navigate here after a successful delete. */
  redirectTo?: string;
  onDeleted?: () => void;
  className?: string;
};

export function ContactDeleteButton({
  contactId,
  contactName,
  redirectTo,
  onDeleted,
  className,
}: ContactDeleteButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete ${contactName}? This permanently removes the contact and related scheduled/delivery history.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(`/api/v1/contacts/${contactId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        window.alert(
          body?.error?.message ?? "Could not delete contact. Try again.",
        );
        return;
      }

      onDeleted?.();

      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      }
    } catch {
      window.alert("Could not delete contact. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      disabled={deleting}
      onClick={() => void handleDelete()}
      className={[
        compactSecondaryButtonClass,
        "border-red-200 text-red-700 hover:bg-red-50",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
