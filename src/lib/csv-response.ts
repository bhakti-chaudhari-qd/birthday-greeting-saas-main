const UTF8_BOM = "\uFEFF";

/**
 * Prefixes a CSV with a UTF-8 byte-order mark. Without it Excel opens the file
 * in a legacy encoding and non-Latin text (Hindi/Marathi) shows as garbage.
 * The contact importer already strips a leading BOM, so exports re-import cleanly.
 */
export function withUtf8Bom(csv: string): string {
  return csv.startsWith(UTF8_BOM) ? csv : `${UTF8_BOM}${csv}`;
}
