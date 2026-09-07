import { Channel, type MessageTemplate } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { UpdateTemplateSmsSetupInput } from "@/lib/validation/template-sms-setup";

import { checkDltCompatibility, assertRenderedBodyMatchesApprovedStructure } from "./dlt-compatibility";
import { TemplateNotFoundError, TemplateValidationError } from "./errors";
import { deriveRealSmsReadiness } from "./readiness";
import { serializeTemplateSmsSetup } from "./serialize";
import { getTemplate } from "./service";
import { validateTemplateVariables } from "./variables";

function assertSmsTemplate(template: MessageTemplate) {
  if (template.channel !== Channel.SMS) {
    throw new TemplateValidationError(
      "Advanced SMS setup is only available for SMS templates",
    );
  }
}

export function requiresPairReviewAcknowledgement(
  existing: Pick<MessageTemplate, "dltTemplateId" | "dltApprovedContent">,
  input: Pick<UpdateTemplateSmsSetupInput, "dltTemplateId" | "dltApprovedContent">,
): boolean {
  const existingId = existing.dltTemplateId?.trim() ?? "";
  const existingContent = existing.dltApprovedContent?.trim() ?? "";

  if (!existingId && !existingContent) {
    return false;
  }

  return (
    existingId !== input.dltTemplateId.trim() ||
    existingContent !== input.dltApprovedContent.trim()
  );
}

export async function getTemplateSmsSetup(
  organizationId: string,
  templateId: string,
) {
  const template = await getTemplate(organizationId, templateId);
  assertSmsTemplate(template);
  return serializeTemplateSmsSetup(template);
}

export async function updateTemplateSmsSetup(
  organizationId: string,
  templateId: string,
  input: UpdateTemplateSmsSetupInput,
) {
  const existing = await getTemplate(organizationId, templateId);
  assertSmsTemplate(existing);

  const dltTemplateId = input.dltTemplateId.trim();
  const dltApprovedContent = input.dltApprovedContent;

  validateTemplateVariables(existing.body);

  if (
    requiresPairReviewAcknowledgement(existing, input) &&
    input.confirmDltPairReviewed !== true
  ) {
    throw new TemplateValidationError(
      "Review acknowledgement is required before changing an existing DLT Template ID or approved content pair",
    );
  }

  const compatibility = checkDltCompatibility(existing.body, dltApprovedContent);

  if (!compatibility.compatible) {
    throw new TemplateValidationError(
      compatibility.issues[0] ??
        "DLT content is not compatible with the application template",
    );
  }

  const updated = await prisma.messageTemplate.update({
    where: { id: templateId },
    data: {
      dltTemplateId,
      dltApprovedContent,
    },
  });

  return serializeTemplateSmsSetup(updated);
}

export function assertTemplateReadyForCustomHttpSend(
  template: Pick<
    MessageTemplate,
    "channel" | "body" | "dltTemplateId" | "dltApprovedContent"
  >,
  options?: {
    renderedBody?: string;
    variableValues?: Record<string, string>;
  },
) {
  const readiness = deriveRealSmsReadiness(template);

  if (!readiness.realSmsReady) {
    throw new TemplateValidationError(
      readiness.realSmsReadinessIssues[0] ??
        "SMS template is not ready for real SMS sending",
    );
  }

  if (
    options?.renderedBody &&
    options.variableValues &&
    template.dltApprovedContent
  ) {
    const renderedCheck = assertRenderedBodyMatchesApprovedStructure(
      template.body,
      template.dltApprovedContent,
      options.renderedBody,
      options.variableValues,
    );

    if (!renderedCheck.compatible) {
      throw new TemplateValidationError(
        renderedCheck.issues[0] ??
          "Rendered message does not match approved DLT content",
      );
    }
  }
}

export { TemplateNotFoundError };
