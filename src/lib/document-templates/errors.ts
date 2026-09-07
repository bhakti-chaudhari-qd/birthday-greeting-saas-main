export class DocumentTemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentTemplateValidationError";
  }
}

export class DocumentTemplateNotFoundError extends Error {
  constructor() {
    super("Document template not found");
    this.name = "DocumentTemplateNotFoundError";
  }
}
