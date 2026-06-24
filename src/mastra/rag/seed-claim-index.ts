import "dotenv/config";

import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { embedMany } from "ai";

import { buildClaimChunks } from "./claim-chunks.js";
import {
  CLAIMS_INDEX_NAME,
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
} from "./config.js";
import { claimVectorStore, describeClaimsIndex } from "./claim-vector-store.js";

const embeddingModel = new ModelRouterEmbeddingModel(EMBEDDING_MODEL);

export async function seedClaimIndex(options: { force?: boolean } = {}) {
  const existing = await describeClaimsIndex();

  if (existing && existing.count > 0 && !options.force) {
    return {
      seeded: false,
      count: existing.count,
    };
  }

  if (existing && options.force) {
    await claimVectorStore.deleteIndex({ indexName: CLAIMS_INDEX_NAME });
  }

  if (!existing || options.force) {
    await claimVectorStore.createIndex({
      indexName: CLAIMS_INDEX_NAME,
      dimension: EMBEDDING_DIMENSION,
    });
  }

  const chunks = buildClaimChunks();
  const vectors: number[][] = [];

  for (let offset = 0; offset < chunks.length; offset += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: batch.map((chunk) => chunk.text),
    });

    vectors.push(...embeddings);
  }

  await claimVectorStore.upsert({
    indexName: CLAIMS_INDEX_NAME,
    ids: chunks.map((chunk) => chunk.id),
    vectors,
    metadata: chunks.map((chunk) => chunk.metadata),
  });

  const stats = await describeClaimsIndex();

  return {
    seeded: true,
    count: stats?.count ?? chunks.length,
  };
}

export async function ensureClaimIndexSeeded() {
  if (!process.env.OPENAI_API_KEY) {
    return { seeded: false, count: 0, reason: "missing-openai-key" as const };
  }

  return seedClaimIndex();
}

const isDirectRun = process.argv[1]?.includes("seed-claim-index");

if (isDirectRun) {
  const force = process.argv.includes("--force");

  seedClaimIndex({ force })
    .then((result) => {
      if (result.seeded) {
        console.log(`Seeded ${result.count} claim-bank vectors.`);
      } else {
        console.log(`Claim index already seeded (${result.count} vectors).`);
      }
    })
    .catch((error) => {
      console.error("Failed to seed claim index:", error);
      process.exit(1);
    });
}
