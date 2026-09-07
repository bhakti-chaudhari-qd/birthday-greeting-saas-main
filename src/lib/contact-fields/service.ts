import { ContactFieldType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

import { isValidContactFieldKey, normalizeContactFieldKey } from "./keys";

export class ContactFieldValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactFieldValidationError";
  }
}

export class ContactFieldConflictError extends Error {
  constructor(message = "A contact field with this key already exists") {
    super(message);
    this.name = "ContactFieldConflictError";
  }
}

export class ContactFieldNotFoundError extends Error {
  constructor() {
    super("Contact field was not found");
    this.name = "ContactFieldNotFoundError";
  }
}

export class ContactFieldInUseError extends Error {
  constructor() {
    super("This contact field is still used by contacts or templates");
    this.name = "ContactFieldInUseError";
  }
}

export type ContactFieldDefinitionView = {
  id: string;
  key: string;
  label: string;
  type: ContactFieldType;
  options: Prisma.JsonValue | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ContactFieldInput = {
  key?: string;
  label: string;
  type?: ContactFieldType;
  options?: unknown;
  sortOrder?: number;
  isActive?: boolean;
};

export function serializeContactFieldDefinition(field: {
  id: string;
  key: string;
  label: string;
  type: ContactFieldType;
  options: Prisma.JsonValue | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ContactFieldDefinitionView {
  return {
    id: field.id,
    key: field.key,
    label: field.label,
    type: field.type,
    options: field.options,
    sortOrder: field.sortOrder,
    isActive: field.isActive,
    createdAt: field.createdAt.toISOString(),
    updatedAt: field.updatedAt.toISOString(),
  };
}

function normalizeFieldInput(input: ContactFieldInput) {
  const label = input.label.trim();
  if (!label) {
    throw new ContactFieldValidationError("Field label is required");
  }
  if (label.length > 80) {
    throw new ContactFieldValidationError("Field label must be 80 characters or fewer");
  }

  const key = normalizeContactFieldKey(input.key?.trim() || label);
  if (!isValidContactFieldKey(key)) {
    throw new ContactFieldValidationError(
      "Field key must start with a letter and contain only letters or numbers",
    );
  }

  return {
    key,
    label,
    type: input.type ?? ContactFieldType.TEXT,
    options:
      input.options === undefined || input.options === null
        ? Prisma.JsonNull
        : (input.options as Prisma.InputJsonValue),
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  };
}

function handleWriteError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ContactFieldConflictError();
  }
  throw error;
}

export async function listContactFieldDefinitions(
  organizationId: string,
  options: { activeOnly?: boolean } = {},
): Promise<ContactFieldDefinitionView[]> {
  const fields = await prisma.contactFieldDefinition.findMany({
    where: {
      organizationId,
      ...(options.activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }, { id: "asc" }],
  });

  return fields.map(serializeContactFieldDefinition);
}

export async function createContactFieldDefinition(
  organizationId: string,
  input: ContactFieldInput,
) {
  const data = normalizeFieldInput(input);
  try {
    const created = await prisma.contactFieldDefinition.create({
      data: { organizationId, ...data },
    });
    return serializeContactFieldDefinition(created);
  } catch (error) {
    handleWriteError(error);
  }
}

export async function updateContactFieldDefinition(
  organizationId: string,
  fieldId: string,
  input: Partial<ContactFieldInput>,
) {
  const existing = await prisma.contactFieldDefinition.findFirst({
    where: { id: fieldId, organizationId },
  });
  if (!existing) {
    throw new ContactFieldNotFoundError();
  }

  const data: Prisma.ContactFieldDefinitionUpdateInput = {};
  if (input.label !== undefined) {
    const label = input.label.trim();
    if (!label) {
      throw new ContactFieldValidationError("Field label is required");
    }
    if (label.length > 80) {
      throw new ContactFieldValidationError("Field label must be 80 characters or fewer");
    }
    data.label = label;
  }
  if (input.type !== undefined) data.type = input.type;
  if (input.options !== undefined) {
    data.options =
      input.options === null
        ? Prisma.JsonNull
        : (input.options as Prisma.InputJsonValue);
  }
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  try {
    const updated = await prisma.contactFieldDefinition.update({
      where: { id: existing.id },
      data,
    });
    return serializeContactFieldDefinition(updated);
  } catch (error) {
    handleWriteError(error);
  }
}

export async function assertContactAttributesAllowed(
  organizationId: string,
  attributes: Record<string, unknown>,
) {
  const keys = Object.keys(attributes);
  if (keys.length === 0) {
    return;
  }

  const definitions = await prisma.contactFieldDefinition.findMany({
    where: { organizationId, key: { in: keys } },
    select: { key: true },
  });
  const allowed = new Set(definitions.map((field) => field.key));
  const unknown = keys.filter((key) => !allowed.has(key));

  if (unknown.length > 0) {
    throw new ContactFieldValidationError(
      `Unknown contact attributes: ${unknown.join(", ")}`,
    );
  }
}

export async function contactFieldIsReferenced(
  organizationId: string,
  key: string,
): Promise<boolean> {
  const [contacts, templates] = await Promise.all([
    prisma.contact.count({
      where: {
        organizationId,
        attributes: { path: [key], not: Prisma.JsonNull },
      },
    }),
    prisma.messageTemplate.count({
      where: { organizationId, variables: { has: key } },
    }),
  ]);
  return contacts > 0 || templates > 0;
}

export async function deleteContactFieldDefinition(
  organizationId: string,
  fieldId: string,
) {
  const existing = await prisma.contactFieldDefinition.findFirst({
    where: { id: fieldId, organizationId },
  });
  if (!existing) {
    throw new ContactFieldNotFoundError();
  }
  if (await contactFieldIsReferenced(organizationId, existing.key)) {
    throw new ContactFieldInUseError();
  }
  await prisma.contactFieldDefinition.delete({ where: { id: existing.id } });
}

export { ContactFieldType };
