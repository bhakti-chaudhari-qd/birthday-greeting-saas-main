/**
 * Provider-agnostic object storage capability. Nothing outside this
 * directory should import an R2/S3 SDK directly - the rest of the app
 * works with `storageKey` strings, not provider URLs or SDK clients, so
 * the provider can be swapped without touching business logic.
 */
export type DocumentStorage = {
  /** Uploads bytes under `key`, creating or overwriting the object. */
  upload(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Downloads the object at `key`. */
  download(key: string): Promise<Uint8Array>;
  /** Deletes the object at `key`. Succeeds silently if it doesn't exist. */
  delete(key: string): Promise<void>;
};
