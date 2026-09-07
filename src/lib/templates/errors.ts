export class TemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateValidationError";
  }
}

export class TemplateDuplicateError extends TemplateValidationError {
  constructor(name: string, channel: string) {
    super(
      `A ${channelLabel(channel)} message named “${name}” already exists. Rename this one or edit the existing message.`,
    );
    this.name = "TemplateDuplicateError";
  }
}

function channelLabel(channel: string) {
  if (channel === "WHATSAPP") return "WhatsApp";
  if (channel === "EMAIL") return "Email";
  return "SMS";
}

export class TemplateNotFoundError extends Error {
  constructor() {
    super("Template not found");
    this.name = "TemplateNotFoundError";
  }
}

export class TemplateInUseError extends Error {
  constructor() {
    super(
      "This template has message history and cannot be deleted. Mark it inactive instead.",
    );
    this.name = "TemplateInUseError";
  }
}

export class TemplateRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateRenderError";
  }
}
