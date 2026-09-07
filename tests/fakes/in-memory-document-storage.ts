import type { DocumentStorage } from "@/lib/storage";

/** In-process fake implementing the same interface as the R2 adapter, for tests that shouldn't need real R2. */
export function createInMemoryDocumentStorage(): DocumentStorage & {
  objects: Map<string, Uint8Array>;
} {
  const objects = new Map<string, Uint8Array>();

  return {
    objects,
    async upload(key, bytes) {
      objects.set(key, bytes);
    },
    async download(key) {
      const bytes = objects.get(key);
      if (!bytes) {
        throw new Error(`Object not found: ${key}`);
      }
      return bytes;
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}
