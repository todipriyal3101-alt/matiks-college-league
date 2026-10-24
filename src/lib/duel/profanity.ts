// "Top today" names: first name only, letters, and nothing abusive (English + common Hinglish), including l33t
// spellings and spacing tricks. Not perfect; admins can still hide entries.

const BLOCKED = [
  "fuck", "shit", "bitch", "cunt", "dick", "cock", "pussy", "whore", "slut", "rape", "porn", "nigg", "fag", "bastard",
  "asshole", "wank", "penis", "vagina", "boob", "sex", "nazi", "hitler",
  "chut", "madarc", "behenc", "bhenc", "bhosd", "gandu", "gaand", "randi", "lund", "loda", "lauda", "harami", "kamina",
  "chod", "bsdk", "mkc", "bkl", "tatti", "suar",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i" };

function squash(text: string) {
  return text
    .toLowerCase()
    .replace(/[0134578@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1+/g, "$1");
}

/** True when the text contains a blocked word (after undoing l33t, spacing and repeated letters). */
export function isProfane(text: string) {
  const s = squash(text);
  return BLOCKED.some((w) => s.includes(w.replace(/(.)\1+/g, "$1")));
}

/** A clean first name for public boards, or null: one word, letters only, 1–24 characters, not abusive. */
export function cleanFirstName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const first = input.trim().split(/\s+/)[0] ?? "";
  if (!/^\p{L}[\p{L}'-]{0,23}$/u.test(first) || isProfane(first)) return null;
  return first.charAt(0).toUpperCase() + first.slice(1);
}
