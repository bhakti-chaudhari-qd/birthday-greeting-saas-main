import type { Contact, MessageTemplate, Prisma } from "@prisma/client";

import {
  SUPPORTED_TEMPLATE_VARIABLES,
  templateValuesForContact,
  type SupportedTemplateVariable,
} from "@/lib/templates/variables";
import { whatsappParameterValuesSchema } from "@/lib/templates/whatsapp-metadata";

import { QueueValidationError } from "./errors";

export function resolveWhatsAppParameterValues(
  template: Pick<MessageTemplate, "whatsappParameterOrder" | "variables">,
  contact: Pick<Contact, "name" | "email" | "mobile" | "address" | "attributes">,
): string[] {
  const order =
    template.whatsappParameterOrder.length > 0
      ? template.whatsappParameterOrder
      : template.variables;

  const values = templateValuesForContact(contact);

  return order.map((parameter) => {
    if (
      !template.variables.includes(parameter) &&
      !SUPPORTED_TEMPLATE_VARIABLES.includes(parameter as SupportedTemplateVariable)
    ) {
      throw new QueueValidationError(
        `Unsupported WhatsApp parameter: ${parameter}`,
      );
    }

    const rawValue = values[parameter];
    const value = rawValue === null || rawValue === undefined ? "" : String(rawValue);

    if (value.trim() === "") {
      throw new QueueValidationError(
        `Missing value for WhatsApp parameter: ${parameter}`,
      );
    }

    return value.trim();
  });
}

export function parseWhatsAppParameterValuesSnapshot(
  value: Prisma.JsonValue | null | undefined,
): string[] {
  if (value === null || value === undefined) {
    throw new QueueValidationError(
      "Queued WhatsApp parameter values snapshot is missing",
    );
  }

  const parsed = whatsappParameterValuesSchema.safeParse(value);

  if (!parsed.success) {
    throw new QueueValidationError(
      "Queued WhatsApp parameter values are invalid",
    );
  }

  return parsed.data;
}

export function assertWhatsAppQueueSnapshots(queue: {
  whatsappTemplateName: string | null;
  whatsappLanguage: string | null;
  whatsappParameterValues: Prisma.JsonValue | null;
}) {
  if (!queue.whatsappTemplateName?.trim()) {
    throw new QueueValidationError(
      "Queued WhatsApp template name snapshot is missing",
    );
  }

  if (!queue.whatsappLanguage?.trim()) {
    throw new QueueValidationError(
      "Queued WhatsApp language snapshot is missing",
    );
  }

  return {
    templateName: queue.whatsappTemplateName.trim(),
    language: queue.whatsappLanguage.trim(),
    parameterValues: parseWhatsAppParameterValuesSnapshot(
      queue.whatsappParameterValues,
    ),
  };
}
