export class ContactValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactValidationError";
  }
}

export class ContactNotFoundError extends Error {
  constructor() {
    super("Contact not found");
    this.name = "ContactNotFoundError";
  }
}

export class ContactConflictError extends Error {
  constructor(message = "A contact with this mobile already exists") {
    super(message);
    this.name = "ContactConflictError";
  }
}

export class ContactLimitError extends Error {
  constructor(message = "Contact limit reached for this organization") {
    super(message);
    this.name = "ContactLimitError";
  }
}

export class ContactDeleteBlockedError extends Error {
  constructor(
    message = "Contact could not be deleted because related message history could not be removed",
  ) {
    super(message);
    this.name = "ContactDeleteBlockedError";
  }
}
