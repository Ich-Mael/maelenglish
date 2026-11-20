/** Text helpers shared by graders and metrics (framework-free). */

const CONTRACTIONS: Record<string, string> = {
  "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are", "he's": "he is", "she's": "she is",
  "it's": "it is", "that's": "that is", "there's": "there is", "what's": "what is", "i've": "i have", "you've": "you have",
  "we've": "we have", "they've": "they have", "i'll": "i will", "you'll": "you will", "we'll": "we will", "they'll": "they will",
  "i'd": "i would", "you'd": "you would", "we'd": "we would", "they'd": "they would", "can't": "cannot", "won't": "will not",
  "don't": "do not", "doesn't": "does not", "didn't": "did not", "isn't": "is not", "aren't": "are not", "wasn't": "was not",
  "weren't": "were not", "haven't": "have not", "hasn't": "has not", "couldn't": "could not", "wouldn't": "would not",
  "shouldn't": "should not", "let's": "let us",
};

/** Lowercase, straight apostrophes, no punctuation, contractions expanded, single spaces. */
export function normalizeEnglish(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => CONTRACTIONS[w] ?? w.replace(/^'+|'+$/g, ""))
    .join(" ")
    .trim();
}

export const words = (s: string): string[] => normalizeEnglish(s).split(" ").filter(Boolean);
