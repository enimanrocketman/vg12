import { mastra } from "../mastra/index.js";
import { claimsAndRoasts } from "../mastra/agents/claim-bank.js";
import { VEGAN_ROAST_AGENT_ID } from "../mastra/agents/vegan-roast-agent.js";
import { matchClaimEvidenceSource } from "../mastra/rag/match-claim.js";
import { matchBestClaim } from "../mastra/rag/search-claims.js";
import { TOKEN_EVIDENCE_MIN_SCORE } from "../mastra/rag/config.js";
import {
  OFF_TOPIC_ROAST,
  roastOutputSchema,
  type EvidenceSource,
  type RoastResponse,
} from "../shared/schemas.js";

const DEFAULT_MODEL = "openai/gpt-5.4-mini";

const fallbackRoasts = [
  "Plants can meet protein needs without killing animals.",
  "Plant iron absorbs better when vitamin C joins the meal.",
  "B12 comes from bacteria, so supplements cut out exploitation.",
  "Capability does not turn unnecessary harm into moral necessity.",
  "Sentience makes avoidable suffering ethically relevant, not appetite.",
  "Personal choice ends where another body is exploited.",
  "Livestock feed demand drives soy expansion and deforestation.",
  "Animal agriculture uses vast farmland for needless harm.",
  "Pleasure cannot outweigh suffering we can easily prevent.",
  "Consumer demand still funds breeding, confinement, and slaughter.",
  "Dairy requires repeated pregnancy, separation, and eventual slaughter.",
  "Egg production still kills male chicks and spent hens.",
] as const;

const claimEntries = claimsAndRoasts.categories.flatMap((category) =>
  category.claims.map((item) => ({
    source: item.source,
    rebuttal: item.rebuttal,
    tokens: tokenize(item.claim),
  })),
);


export class RoastGenerationError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 502,
  ) {
    super(message);
    this.name = "RoastGenerationError";
  }
}

const OFF_TOPIC_EXPLANATION =
  "Ask about veganism, animal ethics, or anti-vegan claims.";

export async function roastClaim(
  claim: string,
  sessionId?: string,
): Promise<RoastResponse> {
  if (hasProviderKey()) {
    try {
      const agent = mastra.getAgentById(VEGAN_ROAST_AGENT_ID);
      const memory = sessionId
        ? {
            resource: `session-${sessionId}`,
            thread: `thread-${sessionId}`,
          }
        : undefined;

      const result = await agent.generate(buildGenerationPrompt(claim), {
        maxSteps: 7,
        memory,
        structuredOutput: {
          schema: roastOutputSchema,
          errorStrategy: "strict",
          instructions:
            'Return { roast, explanation }. If the claim is not about veganism, animal ethics, diet in a vegan context, or anti-vegan justifications, return roast: "i dont answer this" and explanation: "Ask about veganism, animal ethics, or anti-vegan claims." — do not call tools. Otherwise roast: one English sentence, 8–12 words (max 14). explanation: 1–2 short factual sentences that expand on the roast. Ground both in tool retrieval when available. Factual claims get direct rebuttals; weak justifications get a counter-question in roast. No citations or source names.',
        },
        modelSettings: {
          maxOutputTokens: 200,
          temperature: 0.45,
        },
      });

      const rawRoast = result.object?.roast ?? result.text;
      const roast = normalizeRoast(rawRoast);
      const isOffTopic = roast === OFF_TOPIC_ROAST;

      if (!roast) {
        throw new RoastGenerationError(
          "GPT returned an invalid answer length. Try again.",
        );
      }

      const explanation = isOffTopic
        ? (normalizeExplanation(result.object?.explanation) ?? OFF_TOPIC_EXPLANATION)
        : (normalizeExplanation(result.object?.explanation) ??
          (await selectClaimBankExplanation(claim)));

      return {
        roast,
        explanation: explanation ?? roast,
        words: countWords(roast),
        source: "mastra",
        evidenceSource: isOffTopic
          ? undefined
          : await selectEvidenceSource(claim),
      };
    } catch (error) {
      console.error("Mastra rebuttal generation failed:", error);
      throw toRoastGenerationError(error);
    }
  }

  const roast = selectFallbackRoast(claim);
  const explanation = (await selectClaimBankExplanation(claim)) ?? roast;

  return {
    roast,
    explanation,
    words: countWords(roast),
    source: "local",
    evidenceSource: await selectEvidenceSource(claim),
  };
}

function buildGenerationPrompt(claim: string) {
  return `Claim: ${claim}\n\nReturn the concise rebuttal and factual explanation in the required JSON shape.`;
}

function hasProviderKey() {
  const model = process.env.MASTRA_MODEL ?? DEFAULT_MODEL;
  const [provider] = model.split("/");

  if (provider === "openai") {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  if (provider === "anthropic") {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  if (provider === "google") {
    return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  }

  return true;
}

function normalizeRoast(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const cleaned = value
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^roast:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.toLowerCase() === OFF_TOPIC_ROAST) {
    return OFF_TOPIC_ROAST;
  }

  const words = countWords(cleaned);

  if (words >= 6 && words <= 14) {
    return cleaned;
  }

  return undefined;
}

function normalizeExplanation(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const cleaned = value
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^explanation:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 20) {
    return undefined;
  }

  return cleaned.length <= 240 ? cleaned : truncateToSentence(cleaned, 240);
}

async function selectClaimBankExplanation(claim: string) {
  if (!process.env.OPENAI_API_KEY) {
    return selectClaimBankExplanationByTokens(claim);
  }

  const match = await matchBestClaim(claim);
  if (!match?.rebuttal) {
    return selectClaimBankExplanationByTokens(claim);
  }

  return summarizeRebuttal(match.rebuttal);
}

function selectClaimBankExplanationByTokens(claim: string) {
  const queryTokens = tokenize(claim);

  if (queryTokens.size === 0) {
    return undefined;
  }

  let bestScore = 0;
  let bestRebuttal: string | undefined;

  for (const item of claimEntries) {
    const score = scoreTokenMatch(queryTokens, item.tokens);

    if (score > bestScore) {
      bestScore = score;
      bestRebuttal = item.rebuttal;
    }
  }

  return bestRebuttal ? summarizeRebuttal(bestRebuttal) : undefined;
}

function summarizeRebuttal(rebuttal: string) {
  const cleaned = rebuttal.replace(/\s+/g, " ").trim();
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) ?? [cleaned];
  const summary = sentences.slice(0, 2).join(" ").trim();

  if (summary.length < 20) {
    return undefined;
  }

  return summary.length <= 240 ? summary : truncateToSentence(summary, 240);
}

function truncateToSentence(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const slice = value.slice(0, maxLength);
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );

  if (lastSentenceEnd > 40) {
    return slice.slice(0, lastSentenceEnd + 1).trim();
  }

  const lastSpace = slice.lastIndexOf(" ");
  const trimmed = (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim();

  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}

function selectFallbackRoast(seed: string) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return fallbackRoasts[hash % fallbackRoasts.length];
}

function countWords(value: string) {
  return value.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)?/g)?.length ?? 0;
}

async function selectEvidenceSource(
  claim: string,
): Promise<EvidenceSource | undefined> {
  const ragSource = await matchClaimEvidenceSource(claim);
  if (ragSource) {
    return ragSource;
  }

  return selectEvidenceSourceByTokens(claim);
}

function selectEvidenceSourceByTokens(claim: string): EvidenceSource | undefined {
  const queryTokens = tokenize(claim);

  if (queryTokens.size === 0) {
    return undefined;
  }

  let bestScore = 0;
  let bestSource: EvidenceSource | undefined;

  for (const item of claimEntries) {
    const score = scoreTokenMatch(queryTokens, item.tokens);

    if (score > bestScore) {
      bestScore = score;
      bestSource = item.source;
    }
  }

  return bestScore >= TOKEN_EVIDENCE_MIN_SCORE ? bestSource : undefined;
}

function scoreTokenMatch(queryTokens: Set<string>, itemTokens: Set<string>) {
  let score = 0;

  for (const token of queryTokens) {
    if (itemTokens.has(token)) {
      score += token.length > 5 ? 2 : 1;
    }
  }

  return score;
}

function toRoastGenerationError(error: unknown) {
  if (error instanceof RoastGenerationError) {
    return error;
  }

  const statusCode = getStatusCode(error);

  if (statusCode === 429) {
    return new RoastGenerationError(
      "OpenAI rate limit reached. Try again shortly.",
      429,
    );
  }

  if (statusCode === 401 || statusCode === 403) {
    return new RoastGenerationError(
      "OpenAI API key was rejected. Check your .env key.",
      502,
    );
  }

  return new RoastGenerationError(
    "OpenAI generation failed. Check the server logs.",
  );
}

function getStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const statusCode = (error as { statusCode?: unknown }).statusCode;
  const status = (error as { status?: unknown }).status;

  if (typeof statusCode === "number") {
    return statusCode;
  }

  if (typeof status === "number") {
    return status;
  }

  return undefined;
}

function tokenize(value: string) {
  const stopWords = new Set([
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

  return new Set(
    value
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((token) => token.length > 2 && !stopWords.has(token)),
  );
}
