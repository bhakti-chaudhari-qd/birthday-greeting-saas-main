/** Max contactIds accepted by a single manual-send / preview API request. */
export const MANUAL_SEND_API_BATCH_SIZE = 50;

/**
 * Max contacts a user may select on Send Message before confirm.
 * Sends are automatically split into MANUAL_SEND_API_BATCH_SIZE chunks.
 */
export const MAX_MANUAL_SEND_SELECTION = 500;

/** sessionStorage key used to preselect contacts from the Contacts page. */
export const MANUAL_SEND_PRESELECT_STORAGE_KEY =
  "manual-send-preselect-contact-ids";

export function chunkIds<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error("Chunk size must be positive");
  }

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function getManualSendBatchCount(recipientCount: number): number {
  if (recipientCount <= 0) {
    return 0;
  }
  return Math.ceil(recipientCount / MANUAL_SEND_API_BATCH_SIZE);
}
