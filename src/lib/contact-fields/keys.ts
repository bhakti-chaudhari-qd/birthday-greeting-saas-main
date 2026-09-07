export function normalizeContactFieldKey(input: string): string {
  const words = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "";
  }

  return words
    .map((word, index) =>
      index === 0 ? word : `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`,
    )
    .join("");
}

export function isValidContactFieldKey(key: string): boolean {
  return /^[a-z][a-zA-Z0-9]{0,49}$/.test(key);
}
