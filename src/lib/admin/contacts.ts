import { prisma } from "@/lib/db";
import { createContact } from "@/lib/contacts/service";
import {
  importContactsFromCsv,
  importContactsFromExcelBase64,
  type ContactImportSummary,
} from "@/lib/contacts/import";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";

import {
  createPlatformAdminAuditEvent,
  PLATFORM_ADMIN_AUDIT_ACTIONS,
} from "./audit";
import { PlatformAdminOrgError } from "./org-ops";

type ImportFieldMapping = {
  header: string;
  action: "ignore" | "existing" | "create";
  fieldKey?: string;
  label?: string;
};

async function assertOrganizationExists(organizationId: string): Promise<void> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
  if (!organization) {
    throw new PlatformAdminOrgError("Client not found");
  }
}

export type AddContactForPlatformAdminInput = {
  actorAdminId: string;
  organizationId: string;
  name: string;
  mobile: string;
  email?: string | null;
  /** Any format parseOccasionDate accepts, e.g. an <input type="date"> value (YYYY-MM-DD). */
  birthday?: string | null;
  categoryName?: string | null;
};

/**
 * Lets a platform admin add a single contact into a client's account -
 * for onboarding a client who hands over their contact list to set up on
 * their behalf. Reuses the same createContact used by the client's own
 * dashboard, so it respects the same contact-limit/category/validation
 * rules; only the actor (platform admin, audited) differs.
 */
export async function addContactForPlatformAdmin(
  input: AddContactForPlatformAdminInput,
) {
  await assertOrganizationExists(input.organizationId);

  let occasionDates: Record<string, string> | undefined;
  if (input.birthday?.trim()) {
    const birthdayOccasion = await ensureSystemBirthdayOccasion(
      input.organizationId,
    );
    occasionDates = { [birthdayOccasion.id]: input.birthday.trim() };
  }

  const contact = await createContact(
    input.organizationId,
    {
      name: input.name,
      mobile: input.mobile,
      email: input.email?.trim() ? input.email.trim() : undefined,
      occasionDates,
      categoryName: input.categoryName?.trim() || undefined,
      isActive: true,
    },
    { addedByPlatformAdmin: true },
  );

  await createPlatformAdminAuditEvent({
    actorAdminId: input.actorAdminId,
    organizationId: input.organizationId,
    action: PLATFORM_ADMIN_AUDIT_ACTIONS.CONTACT_CREATED,
    targetType: "contact",
    targetId: contact.id,
    metadata: {
      contactName: contact.name,
      contactMobile: contact.mobile,
    },
  });

  return contact;
}

export type ImportContactsForPlatformAdminInput = {
  actorAdminId: string;
  organizationId: string;
  csv?: string;
  excelBase64?: string;
  fileName?: string;
  fieldMappings?: ImportFieldMapping[];
};

/**
 * Lets a platform admin bulk-import contacts (CSV/Excel) into a client's
 * account, reusing the same sync import path the client's own dashboard
 * uses for small/medium files. Large files (thousands of rows) should still
 * go through the client's own dashboard, which offers the async job/worker
 * path - not duplicated here to avoid modeling a platform-admin "creator"
 * for the client-scoped import-job table.
 */
export async function importContactsForPlatformAdmin(
  input: ImportContactsForPlatformAdminInput,
): Promise<ContactImportSummary> {
  await assertOrganizationExists(input.organizationId);

  const summary = input.excelBase64?.trim()
    ? await importContactsFromExcelBase64(
        input.organizationId,
        input.excelBase64,
        { fieldMappings: input.fieldMappings, addedByPlatformAdmin: true },
      )
    : await importContactsFromCsv(input.organizationId, input.csv ?? "", {
        fieldMappings: input.fieldMappings,
        addedByPlatformAdmin: true,
      });

  await createPlatformAdminAuditEvent({
    actorAdminId: input.actorAdminId,
    organizationId: input.organizationId,
    action: PLATFORM_ADMIN_AUDIT_ACTIONS.CONTACTS_IMPORTED,
    targetType: "contact",
    targetId: input.organizationId,
    metadata: {
      ...(input.fileName ? { fileName: input.fileName } : {}),
      importCreated: summary.created,
      importUpdated: summary.updated,
      importSkippedDuplicate: summary.skippedDuplicate,
      importSkippedLimit: summary.skippedLimit,
      importInvalid: summary.invalid,
    },
  });

  return summary;
}
