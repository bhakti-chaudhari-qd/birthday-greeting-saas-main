export class DeliveryNotFoundError extends Error {
  constructor() {
    super("Delivery log not found");
    this.name = "DeliveryNotFoundError";
  }
}

export class DeliveryRefreshError extends Error {
  readonly code: string;

  constructor(message: string, code = "DELIVERY_REFRESH_FAILED") {
    super(message);
    this.name = "DeliveryRefreshError";
    this.code = code;
  }
}
