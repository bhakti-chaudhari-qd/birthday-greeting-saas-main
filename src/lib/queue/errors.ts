export class QueueValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueValidationError";
  }
}

export class QueueTemplateNotFoundError extends Error {
  constructor() {
    super("Template not found");
    this.name = "QueueTemplateNotFoundError";
  }
}

export class QueueTemplateRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueTemplateRejectedError";
  }
}

export class QueueNotFoundError extends Error {
  constructor() {
    super("Queue item not found");
    this.name = "QueueNotFoundError";
  }
}

export class QueueInvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueInvalidStateError";
  }
}

export class QueueMaxAttemptsError extends Error {
  constructor() {
    super("Maximum send attempts reached");
    this.name = "QueueMaxAttemptsError";
  }
}
