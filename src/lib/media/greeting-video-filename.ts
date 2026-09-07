/**
 * App-generated greeting videos are named greeting-birthday.webm (etc.) and
 * burn in a placeholder name. Those must be re-rendered per recipient.
 * Keep this module free of Node-only imports so client components can use it.
 */
export function shouldPersonalizeWhatsAppMedia(
  filename: string | null | undefined,
) {
  if (!filename) {
    return false;
  }
  return /^greeting-(birthday|anniversary|custom)\.(webm|mp4)$/i.test(
    filename.trim(),
  );
}

/**
 * Per-contact files already rendered with the real name
 * (e.g. greeting-birthday-a1b2c3.webm).
 */
export function isPerContactPersonalizedGreetingMedia(
  filename: string | null | undefined,
) {
  if (!filename) {
    return false;
  }
  return /^greeting-(birthday|anniversary|custom)-[a-z0-9]+\.(webm|mp4)$/i.test(
    filename.trim(),
  );
}

/**
 * Activity / confirm Preview should rebuild when the stored file still has the
 * placeholder name. Missing filenames are treated as needing a rebuild so we
 * never silently show placeholder content when metadata was omitted by the caller.
 */
export function needsGreetingVideoPreviewRebuild(
  filename: string | null | undefined,
) {
  if (isPerContactPersonalizedGreetingMedia(filename)) {
    return false;
  }
  if (!filename?.trim()) {
    return true;
  }
  return shouldPersonalizeWhatsAppMedia(filename);
}
