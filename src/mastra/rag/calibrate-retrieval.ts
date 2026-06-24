import "dotenv/config";

import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { embed } from "ai";

import { claimsAndRoasts } from "../agents/claim-bank.js";
import { EMBEDDING_MODEL, TOPIC_INDEX_NAME } from "./config.js";
import { describeClaimsIndex } from "./claim-vector-store.js";
import { matchClaimEvidenceSource } from "./match-claim.js";
import { searchClaims } from "./search-claims.js";
import { describeTopicIndex, topicVectorStore } from "./topic-vector-store.js";

const PARAPHRASED_QUERIES: Array<{ query: string; expectedClaimId: number }> = [
  { query: "you need meat to get protein", expectedClaimId: 1 },
  { query: "where do vegans get their protein", expectedClaimId: 1 },
  { query: "iron only comes from meat", expectedClaimId: 2 },
  { query: "b12 proves veganism is unnatural", expectedClaimId: 3 },
  { query: "red meat is healthy for you", expectedClaimId: 4 },
  { query: "vegan kids will be malnourished", expectedClaimId: 5 },
  { query: "beyond meat is ultra processed junk", expectedClaimId: 6 },
  { query: "soy gives men boobs", expectedClaimId: 33 },
  { query: "you need fish oil for brain health", expectedClaimId: 34 },
  { query: "humans are omnivores by design", expectedClaimId: 7 },
  { query: "eating meat is natural", expectedClaimId: 8 },
  { query: "lions eat meat so why can't we", expectedClaimId: 9 },
  { query: "meat made our brains bigger", expectedClaimId: 10 },
  { query: "look at our canine teeth", expectedClaimId: 11 },
  { query: "animals don't feel pain", expectedClaimId: 13 },
  { query: "my happy cows are treated well", expectedClaimId: 14 },
  { query: "it's my personal choice what I eat", expectedClaimId: 16 },
  { query: "plants feel pain too", expectedClaimId: 17 },
  { query: "cows need to be milked anyway", expectedClaimId: 38 },
  { query: "animal agriculture isn't bad for climate", expectedClaimId: 18 },
  { query: "soy destroys the amazon", expectedClaimId: 19 },
  { query: "I only eat local grass fed beef", expectedClaimId: 14 },
  { query: "taste is why I eat animals", expectedClaimId: 24 },
  { query: "tradition says we eat meat", expectedClaimId: 22 },
];

async function queryTopics(query: string, topK = 8) {
  const model = new ModelRouterEmbeddingModel(EMBEDDING_MODEL);
  const { embedding } = await embed({ model, value: query });
  return topicVectorStore.query({
    indexName: TOPIC_INDEX_NAME,
    queryVector: embedding,
    topK,
  });
}

async function evaluateClaimRetrieval() {
  const claimIndex = await describeClaimsIndex();
  console.log(`\n=== Claim index: ${claimIndex?.count ?? 0} vectors ===\n`);

  let exactTop1 = 0;
  let exactTop3 = 0;
  let paraphraseTop1 = 0;
  let paraphraseTop3 = 0;

  for (const category of claimsAndRoasts.categories) {
    for (const item of category.claims) {
      const matches = await searchClaims(item.claim, { limit: 1 });
      const topId = matches[0]?.claimId;

      if (topId === item.id) exactTop1 += 1;
      const top3 = await searchClaims(item.claim, { limit: 3 });
      if (top3.some((match) => match.claimId === item.id)) exactTop3 += 1;
    }
  }

  const totalClaims = claimsAndRoasts.categories.reduce(
    (sum, category) => sum + category.claims.length,
    0,
  );

  console.log(
    `Exact claim queries: top-1 ${exactTop1}/${totalClaims} (${pct(exactTop1, totalClaims)}), top-3 ${exactTop3}/${totalClaims} (${pct(exactTop3, totalClaims)})`,
  );

  const failures: string[] = [];

  for (const { query, expectedClaimId } of PARAPHRASED_QUERIES) {
    const matches = await searchClaims(query, { limit: 3 });
    const topIds = matches.map((match) => match.claimId);

    if (topIds[0] === expectedClaimId) {
      paraphraseTop1 += 1;
    } else {
      failures.push(
        `  FAIL top-1: "${query}" → expected #${expectedClaimId}, got #${topIds[0]} (${matches[0]?.claim?.slice(0, 72) ?? "none"})`,
      );
    }

    if (topIds.includes(expectedClaimId)) {
      paraphraseTop3 += 1;
    } else {
      failures.push(
        `  FAIL top-3: "${query}" → expected #${expectedClaimId}, top-3=[${topIds.join(", ")}]`,
      );
    }
  }

  console.log(
    `Paraphrased queries: top-1 ${paraphraseTop1}/${PARAPHRASED_QUERIES.length} (${pct(paraphraseTop1, PARAPHRASED_QUERIES.length)}), top-3 ${paraphraseTop3}/${PARAPHRASED_QUERIES.length} (${pct(paraphraseTop3, PARAPHRASED_QUERIES.length)})`,
  );

  if (failures.length > 0) {
    console.log("\nParaphrase misses:");
    for (const line of failures) {
      console.log(line);
    }
  }

  console.log("\nSample ranked claim matches for paraphrases:");
  for (const { query, expectedClaimId } of PARAPHRASED_QUERIES.slice(0, 5)) {
    const matches = await searchClaims(query, { limit: 5 });
    console.log(`\n"${query}" (expected #${expectedClaimId})`);
    matches.forEach((match, index) => {
      console.log(
        `  ${JSON.stringify({
          rank: index + 1,
          score: Number(match.score.toFixed(4)),
          claimId: match.claimId,
          claim: match.claim.slice(0, 72),
        })}`,
      );
    });
  }
}

async function evaluateEvidenceMatching() {
  console.log("\n=== Evidence source matching ===\n");

  let correct = 0;
  const misses: string[] = [];

  for (const { query, expectedClaimId } of PARAPHRASED_QUERIES) {
    const expected = findClaim(expectedClaimId);
    const source = await matchClaimEvidenceSource(query);

    if (source?.url === expected?.source.url) {
      correct += 1;
    } else {
      misses.push(
        `  "${query}" → got ${source?.tag ?? "null"}, expected ${expected?.source.tag}`,
      );
    }
  }

  console.log(
    `Evidence match: ${correct}/${PARAPHRASED_QUERIES.length} (${pct(correct, PARAPHRASED_QUERIES.length)})`,
  );

  if (misses.length > 0) {
    console.log("\nEvidence misses:");
    for (const line of misses) {
      console.log(line);
    }
  }
}

async function evaluateTopicRetrieval() {
  const topicIndex = await describeTopicIndex();
  console.log(`\n=== Topic index: ${topicIndex?.count ?? 0} vectors ===\n`);

  const topicQueries = [
    { query: "vegan protein requirements amino acids", expectTopic: "nutrition" },
    { query: "animal sentience consciousness pain", expectTopic: "sentience" },
    { query: "greenhouse gas emissions livestock methane", expectTopic: "environment" },
    { query: "slaughterhouse welfare stunning practices", expectTopic: "welfare" },
    { query: "deforestation soy cattle feed", expectTopic: "environment" },
    { query: "B12 supplementation vegan diet", expectTopic: "nutrition" },
    { query: "ethical justification harming animals", expectTopic: "ethics" },
  ];

  for (const { query, expectTopic } of topicQueries) {
    const results = await queryTopics(query, 5);
    console.log(`\n"${query}" (want topic: ${expectTopic})`);
    results.forEach((row, index) => {
      const metadata = row.metadata as {
        title?: string;
        topics?: string[];
        sectionHeading?: string;
      };
      const topics = metadata?.topics?.join(", ") ?? "";
      const hit = metadata?.topics?.some((topic) =>
        topic.toLowerCase().includes(expectTopic),
      );
      console.log(
        `  ${index + 1}. score=${Number((row.score ?? 0).toFixed(4))} hit=${hit ? "yes" : "no"} | ${metadata?.title} | ${metadata?.sectionHeading} | topics: ${topics}`,
      );
    });
  }
}

function findClaim(id: number) {
  for (const category of claimsAndRoasts.categories) {
    const item = category.claims.find((claim) => claim.id === id);
    if (item) return item;
  }
  return undefined;
}

function pct(numerator: number, denominator: number) {
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required for retrieval calibration.");
    process.exit(1);
  }

  await evaluateClaimRetrieval();
  await evaluateEvidenceMatching();
  await evaluateTopicRetrieval();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
