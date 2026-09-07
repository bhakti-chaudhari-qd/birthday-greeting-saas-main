export class GeneratedDocumentNotFoundError extends Error {
  constructor() {
    super("Generated document not found");
    this.name = "GeneratedDocumentNotFoundError";
  }
}

export class GeneratedDocumentExpiredError extends Error {
  constructor() {
    super("This generated document has expired");
    this.name = "GeneratedDocumentExpiredError";
  }
}
