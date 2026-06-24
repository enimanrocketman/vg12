const STOP_WORDS = new Set([
  "about",
  "and",
  "are",
  "because",
  "but",
  "can",
  "for",
  "from",
  "have",
  "just",
  "not",
  "that",
  "the",
  "this",
  "with",
  "you",
]);

export function tokenize(value: string) {
  return new Set(
    value
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

export function tokenOverlapScore(query: string, text: string) {
  const queryTokens = tokenize(query);
  const textTokens = tokenize(text);
  let score = 0;

  for (const token of queryTokens) {
    if (textTokens.has(token)) {
      score += token.length > 5 ? 2 : 1;
    }
  }

  return score;
}
