/**
 * Pick a random template id from eligible options (Manual Send "Pick random").
 */
export function pickRandomTemplateId<T extends { id: string }>(
  templates: readonly T[],
  options?: {
    /** Prefer a different template when more than one is available. */
    excludeId?: string;
    /** Injected for tests; defaults to Math.random. */
    random?: () => number;
  },
): string | null {
  if (templates.length === 0) {
    return null;
  }

  let pool: readonly T[] = templates;
  if (options?.excludeId && templates.length > 1) {
    const filtered = templates.filter(
      (template) => template.id !== options.excludeId,
    );
    if (filtered.length > 0) {
      pool = filtered;
    }
  }

  const random = options?.random ?? Math.random;
  const index = Math.floor(random() * pool.length);
  return pool[index]?.id ?? null;
}
