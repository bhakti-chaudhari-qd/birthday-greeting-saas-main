/**
 * Best-effort Latin-to-Devanagari transliteration for personal names, used
 * to show the dashboard greeting in the reader's script when Hindi/Marathi
 * is selected. This is phonetic guesswork, not a name dictionary - it will
 * not always match how someone conventionally spells their own name.
 */

const MULTI_CONSONANTS: Array<[string, string]> = [
  ["chh", "छ"],
  ["kh", "ख"],
  ["gh", "घ"],
  ["ch", "च"],
  ["jh", "झ"],
  ["th", "थ"],
  ["dh", "ध"],
  ["ph", "फ"],
  ["bh", "भ"],
  ["sh", "श"],
];

const SINGLE_CONSONANTS: Record<string, string> = {
  k: "क",
  g: "ग",
  c: "क",
  j: "ज",
  t: "त",
  d: "द",
  n: "न",
  p: "प",
  f: "फ",
  b: "ब",
  m: "म",
  y: "य",
  r: "र",
  l: "ल",
  v: "व",
  w: "व",
  s: "स",
  h: "ह",
  x: "क्स",
  z: "ज़",
  q: "क",
};

const MULTI_VOWELS: Array<[string, string]> = [
  ["aa", "आ"],
  ["ee", "ई"],
  ["oo", "ऊ"],
  ["ai", "ऐ"],
  ["au", "औ"],
];

const SINGLE_VOWELS: Record<string, string> = {
  a: "अ",
  i: "इ",
  u: "उ",
  e: "ए",
  o: "ओ",
};

const VOWEL_MATRAS: Record<string, string> = {
  aa: "ा",
  ee: "ी",
  oo: "ू",
  ai: "ै",
  au: "ौ",
  a: "",
  i: "ि",
  u: "ु",
  e: "े",
  o: "ो",
};

const CONSONANT_SOUNDS = new Set([
  ...MULTI_CONSONANTS.map(([latin]) => latin),
  ...Object.keys(SINGLE_CONSONANTS),
]);
const VOWEL_SOUNDS = new Set([
  ...MULTI_VOWELS.map(([latin]) => latin),
  ...Object.keys(SINGLE_VOWELS),
]);

type Token = { kind: "consonant" | "vowel" | "literal"; latin: string };

function tokenize(lower: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < lower.length) {
    const three = lower.slice(i, i + 3);
    const two = lower.slice(i, i + 2);
    const one = lower.slice(i, i + 1);

    if (three === "chh") {
      tokens.push({ kind: "consonant", latin: three });
      i += 3;
      continue;
    }

    if (CONSONANT_SOUNDS.has(two) && two.length === 2) {
      tokens.push({ kind: "consonant", latin: two });
      i += 2;
      continue;
    }

    if (VOWEL_SOUNDS.has(two) && two.length === 2) {
      tokens.push({ kind: "vowel", latin: two });
      i += 2;
      continue;
    }

    if (SINGLE_CONSONANTS[one]) {
      tokens.push({ kind: "consonant", latin: one });
      i += 1;
      continue;
    }

    if (SINGLE_VOWELS[one]) {
      tokens.push({ kind: "vowel", latin: one });
      i += 1;
      continue;
    }

    tokens.push({ kind: "literal", latin: one });
    i += 1;
  }

  return tokens;
}

function consonantBase(latin: string): string {
  const multi = MULTI_CONSONANTS.find(([key]) => key === latin);
  return multi ? multi[1] : (SINGLE_CONSONANTS[latin] ?? "");
}

function vowelStandalone(latin: string): string {
  const multi = MULTI_VOWELS.find(([key]) => key === latin);
  return multi ? multi[1] : (SINGLE_VOWELS[latin] ?? "");
}

/** Best-effort transliteration of one word (no spaces) into Devanagari. */
function transliterateWord(word: string): string {
  const tokens = tokenize(word.toLowerCase());
  let output = "";
  let pendingConsonants: string[] = [];

  function flushPending() {
    if (pendingConsonants.length === 0) return;
    for (let i = 0; i < pendingConsonants.length - 1; i += 1) {
      output += consonantBase(pendingConsonants[i]!) + "्";
    }
    output += consonantBase(pendingConsonants[pendingConsonants.length - 1]!);
    pendingConsonants = [];
  }

  for (const token of tokens) {
    if (token.kind === "consonant") {
      pendingConsonants.push(token.latin);
      continue;
    }

    if (token.kind === "vowel") {
      if (pendingConsonants.length > 0) {
        for (let i = 0; i < pendingConsonants.length - 1; i += 1) {
          output += consonantBase(pendingConsonants[i]!) + "्";
        }
        output +=
          consonantBase(pendingConsonants[pendingConsonants.length - 1]!) +
          (VOWEL_MATRAS[token.latin] ?? "");
        pendingConsonants = [];
      } else {
        output += vowelStandalone(token.latin);
      }
      continue;
    }

    flushPending();
    output += token.latin;
  }

  flushPending();
  return output;
}

/**
 * Transliterates a Latin-script name into Devanagari, word by word.
 * Falls back to the original name for anything empty or non-alphabetic.
 */
export function toDevanagari(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return name;
  }

  const result = trimmed
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? part : transliterateWord(part)))
    .join("");

  return result || name;
}
