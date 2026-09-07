export class ChannelConfigNotFoundError extends Error {
  constructor(message = "SMS channel configuration was not found") {
    super(message);
    this.name = "ChannelConfigNotFoundError";
  }
}

export class ChannelConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChannelConfigValidationError";
  }
}

export class ChannelConfigVerificationError extends Error {
  readonly code: string;

  constructor(message: string, code = "VERIFICATION_FAILED") {
    super(message);
    this.name = "ChannelConfigVerificationError";
    this.code = code;
  }
}
