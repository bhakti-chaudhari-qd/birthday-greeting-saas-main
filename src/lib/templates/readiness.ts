import { Channel, type MessageTemplate } from "@prisma/client";

import { checkDltCompatibility } from "./dlt-compatibility";
import { validateTemplateVariables } from "./variables";

export type RealSmsReadiness = {
  realSmsReady: boolean;
  realSmsReadinessIssues: string[];
  realSmsStatusLabel: "Ready for Real SMS" | "Needs SMS Setup" | "Available for Test";
};

export function deriveRealSmsReadiness(
  template: Pick<
    MessageTemplate,
    "channel" | "body" | "dltTemplateId" | "dltApprovedContent"
  >,
): RealSmsReadiness {
  if (template.channel !== Channel.SMS) {
    return {
      realSmsReady: false,
      realSmsReadinessIssues: ["Template is not an SMS template"],
      realSmsStatusLabel: "Available for Test",
    };
  }

  const issues: string[] = [];

  if (!template.dltTemplateId?.trim()) {
    issues.push("DLT Template ID is required for real SMS");
  }

  if (!template.dltApprovedContent?.trim()) {
    issues.push("Approved DLT content is required for real SMS");
  }

  try {
    validateTemplateVariables(template.body);
  } catch (error) {
    issues.push(
      error instanceof Error
        ? error.message
        : "Application template has invalid variables",
    );
  }

  if (template.dltApprovedContent?.trim()) {
    const compatibility = checkDltCompatibility(
      template.body,
      template.dltApprovedContent,
    );

    if (!compatibility.compatible) {
      issues.push(...compatibility.issues);
    }
  }

  const realSmsReady = issues.length === 0;

  let realSmsStatusLabel: RealSmsReadiness["realSmsStatusLabel"];

  if (realSmsReady) {
    realSmsStatusLabel = "Ready for Real SMS";
  } else if (
    template.dltTemplateId?.trim() ||
    template.dltApprovedContent?.trim()
  ) {
    realSmsStatusLabel = "Needs SMS Setup";
  } else {
    realSmsStatusLabel = "Available for Test";
  }

  return {
    realSmsReady,
    realSmsReadinessIssues: issues,
    realSmsStatusLabel,
  };
}
