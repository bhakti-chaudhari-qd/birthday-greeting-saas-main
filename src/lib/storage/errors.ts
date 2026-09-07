/** Storage isn't configured (missing/invalid env vars) - a setup problem, not a runtime failure. */
export class DocumentStorageNotConfiguredError extends Error {
  constructor() {
    super("Document storage is not configured");
    this.name = "DocumentStorageNotConfiguredError";
  }
}

/**
 * A storage operation (upload/download/delete) failed at the provider.
 * Never carries provider-specific details (credentials, bucket names, raw
 * SDK errors) - those are logged server-side by the caller, not exposed.
 */
export class DocumentStorageOperationError extends Error {
  constructor(operation: "upload" | "download" | "delete") {
    super(`Document storage ${operation} failed`);
    this.name = "DocumentStorageOperationError";
  }
}
