import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { mkdirSync } from "node:fs";

import { veganRoastAgent } from "./agents/vegan-roast-agent.js";
import { CLAIMS_VECTOR_STORE_NAME, TOPIC_VECTOR_STORE_NAME } from "./rag/config.js";
import { claimVectorStore } from "./rag/claim-vector-store.js";
import { ensureClaimIndexSeeded } from "./rag/seed-claim-index.js";
import { ensureTopicIndexSeeded } from "./rag/seed-topic-index.js";
import { topicVectorStore } from "./rag/topic-vector-store.js";

mkdirSync(".mastra", { recursive: true });

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: "vgn-storage",
    url: "file:./.mastra/vgn-memory.db",
  }),
  vectors: {
    [CLAIMS_VECTOR_STORE_NAME]: claimVectorStore,
    [TOPIC_VECTOR_STORE_NAME]: topicVectorStore,
  },
  agents: { veganRoastAgent },
});

void ensureClaimIndexSeeded().then((result) => {
  if (result.seeded) {
    console.log(`Seeded claim RAG index with ${result.count} vectors.`);
  }
});

void ensureTopicIndexSeeded().then((result) => {
  if (result.seeded) {
    console.log(`Seeded topic RAG index with ${result.count} vectors.`);
  }
});
