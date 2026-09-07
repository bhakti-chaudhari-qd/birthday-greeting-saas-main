import { b2Storage } from "./b2-storage";
import type { DocumentStorage } from "./types";

/**
 * The rest of the app depends on this capability, not on Backblaze B2
 * itself. Swapping providers (e.g. to AWS S3 or Cloudflare R2) means
 * adding a new adapter next to b2-storage.ts and changing this one line.
 */
export const documentStorage: DocumentStorage = b2Storage;

export type { DocumentStorage } from "./types";
export {
  DocumentStorageNotConfiguredError,
  DocumentStorageOperationError,
} from "./errors";
