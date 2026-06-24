import "dotenv/config";

import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { embedMany } from "ai";

import {
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  TOPIC_INDEX_NAME,
} from "./config.js";
import { buildTopicChunks } from "./topic-chunks.js";
import { describeTopicIndex, topicVectorStore } from "./topic-vector-store.js";

const embeddingModel = new ModelRouterEmbeddingModel(EMBEDDING_MODEL);

export async function seedTopicIndex(options: { force?: boolean } = {}) {
  const existing = await describeTopicIndex();

  if (existing && existing.count > 0 && !options.force) {
    return {
      seeded: false,
      count: existing.count,
    };
  }

  if (existing && options.force) {
    await topicVectorStore.deleteIndex({ indexName: TOPIC_INDEX_NAME });
  }

  if (!existing || options.force) {
    await topicVectorStore.createIndex({
      indexName: TOPIC_INDEX_NAME,
      dimension: EMBEDDING_DIMENSION,
    });
  }

  const chunks = buildTopicChunks();
  const vectors: number[][] = [];

  for (let offset = 0; offset < chunks.length; offset += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: batch.map((chunk) => chunk.text),
    });

    vectors.push(...embeddings);
  }

  await topicVectorStore.upsert({
    indexName: TOPIC_INDEX_NAME,
    ids: chunks.map((chunk) => chunk.id),
    vectors,
    metadata: chunks.map((chunk) => chunk.metadata),
  });

  const stats = await describeTopicIndex();

  return {
    seeded: true,
    count: stats?.count ?? chunks.length,
  };
}

export async function ensureTopicIndexSeeded() {
  if (!process.env.OPENAI_API_KEY) {
    return { seeded: false, count: 0, reason: "missing-openai-key" as const };
  }

  return seedTopicIndex();
}

const isDirectRun = process.argv[1]?.includes("seed-topic-index");

if (isDirectRun) {
  const force = process.argv.includes("--force");

  seedTopicIndex({ force })
    .then((result) => {
      if (result.seeded) {
        console.log(`Seeded ${result.count} topic-knowledge vectors.`);
      } else {
        console.log(`Topic index already seeded (${result.count} vectors).`);
      }
    })
    .catch((error) => {
      console.error("Failed to seed topic index:", error);
      process.exit(1);
    });
}
