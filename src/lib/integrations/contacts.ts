import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { formatOccasionDate } from "@/lib/contacts/dates";
import {
  ContactConflictError,
  ContactLimitError,
  ContactValidationError,
} from "@/lib/contacts/errors";
import { clientVisibleEmail, clientVisibleMobile } from "@/lib/contacts/mask";
import { normalizeMobile } from "@/lib/contacts/mobile";
import { createContact, updateContact } from "@/lib/contacts/service";
import { prisma } from "@/lib/db";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import {
  contactEmailSchema,
  contactMobileSchema,
} from "@/lib/validation/contact";

/**
 * Contact sync for external apps (e.g. the OMS) holding an API key. An API
 * key can only reach this module, and it only ever reads or writes four
 * fields: name, date of birth, mobile, and email. Categories, notes,
 * custom fields, other occasions, and messaging stay out of reach.
 */

export const INTEGRATION_CONTACTS_MAX_BATCH = 100;

const dobSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "dob must use YYYY-MM-DD format");

export const integrationContactSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    mobile: contactMobileSchema,
    /** Omit to leave unchanged; null clears it. */
    email: contactEmailSchema,
    /** Omit to leave unchanged; null clears it. */
    dob: dobSchema.nullable().optional(),
  })
  .strict();

export const upsertIntegrationContactsSchema = z
  .object({
    contacts: z
      .array(integrationContactSchema)
      .min(1)
      .max(INTEGRATION_CONTACTS_MAX_BATCH),
  })
  .strict();

export const listIntegrationContactsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  /** ISO timestamp: only contacts whose name/mobile/email/dob changed since. */
  updatedSince: z.string().datetime({ offset: true }).optional(),
  mobile: contactMobileSchema.optional(),
});

export type IntegrationContactInput = z.infer<typeof integrationContactSchema>;
export type ListIntegrationContactsQuery = z.infer<
  typeof listIntegrationContactsQuerySchema
>;

type ContactForIntegration = {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  addedByPlatformAdmin: boolean;
  occasionDates?: Array<{ occasionId: string; date: Date }>;
};

function serializeIntegrationContact(
  contact: ContactForIntegration,
  birthdayOccasionId: string,
) {
  const birthday = contact.occasionDates?.find(
    (entry) => entry.occasionId === birthdayOccasionId,
  );

  return {
    id: contact.id,
    name: contact.name,
    dob: birthday ? formatOccasionDate(birthday.date) : null,
    mobile: clientVisibleMobile(contact),
    email: clientVisibleEmail(contact),
  };
}

export type IntegrationContact = ReturnType<typeof serializeIntegrationContact>;

/**
 * Active contacts of the organization. Contacts a Platform Admin added on
 * the client's behalf are left out - their real mobile/email are hidden
 * from the client side, so they cannot be shared with another app either.
 */
export async function listIntegrationContacts(
  organizationId: string,
  query: ListIntegrationContactsQuery,
) {
  const birthday = await ensureSystemBirthdayOccasion(organizationId);
  const since = query.updatedSince ? new Date(query.updatedSince) : null;

  const where: Prisma.ContactWhereInput = {
    organizationId,
    isActive: true,
    addedByPlatformAdmin: false,
    ...(query.mobile ? { mobile: normalizeMobile(query.mobile) } : {}),
    ...(since
      ? {
          OR: [
            { updatedAt: { gte: since } },
            {
              occasionDates: {
                some: { occasionId: birthday.id, updatedAt: { gte: since } },
              },
            },
          ],
        }
      : {}),
  };

  const [total, contacts] = await prisma.$transaction([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      select: {
        id: true,
        name: true,
        mobile: true,
        email: true,
        addedByPlatformAdmin: true,
        occasionDates: {
          where: { occasionId: birthday.id },
          select: { occasionId: true, date: true },
        },
      },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    data: contacts.map((contact) =>
      serializeIntegrationContact(contact, birthday.id),
    ),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export type IntegrationUpsertResult =
  | {
      mobile: string;
      status: "created" | "updated";
      contact: IntegrationContact;
    }
  | { mobile: string; status: "error"; error: string };

/**
 * Creates or updates each contact, matched by mobile within the
 * organization. Only name/mobile/email/dob are written; every other field
 * of an existing contact is left as it is. Items are applied one by one, so
 * one bad row does not block the rest.
 */
export async function upsertIntegrationContacts(
  organizationId: string,
  items: IntegrationContactInput[],
): Promise<IntegrationUpsertResult[]> {
  const birthday = await ensureSystemBirthdayOccasion(organizationId);
  const results: IntegrationUpsertResult[] = [];

  for (const item of items) {
    const mobile = normalizeMobile(item.mobile);
    const occasionDates =
      item.dob !== undefined ? { [birthday.id]: item.dob } : undefined;

    try {
      const existing = await prisma.contact.findUnique({
        where: { organizationId_mobile: { organizationId, mobile } },
        select: { id: true },
      });

      const contact = existing
        ? await updateContact(organizationId, existing.id, {
            name: item.name,
            mobile,
            ...(item.email !== undefined ? { email: item.email } : {}),
            occasionDates,
          })
        : await createContact(organizationId, {
            name: item.name,
            mobile,
            email: item.email ?? null,
            occasionDates,
            isActive: true,
          });

      results.push({
        mobile,
        status: existing ? "updated" : "created",
        contact: serializeIntegrationContact(contact, birthday.id),
      });
    } catch (error) {
      if (
        error instanceof ContactValidationError ||
        error instanceof ContactConflictError ||
        error instanceof ContactLimitError
      ) {
        results.push({ mobile, status: "error", error: error.message });
        continue;
      }

      throw error;
    }
  }

  return results;
}
