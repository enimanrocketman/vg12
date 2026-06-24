import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { createVectorQueryTool } from "@mastra/rag";

import {
  EMBEDDING_MODEL,
  TOPIC_INDEX_NAME,
  TOPIC_VECTOR_STORE_NAME,
} from "./config.js";
import { topicVectorStore } from "./topic-vector-store.js";

export const topicKnowledgeTool = createVectorQueryTool({
  id: "search-topic-knowledge",
  vectorStoreName: TOPIC_VECTOR_STORE_NAME,
  vectorStore: topicVectorStore,
  indexName: TOPIC_INDEX_NAME,
  model: new ModelRouterEmbeddingModel(EMBEDDING_MODEL),
  description:
    "Search articles and papers for factual background on vegan topics such as nutrition, sentience, slaughter welfare, environment, and ethics. Call after searchClaimKnowledge when you need a specific fact, statistic, or mechanism to ground the rebuttal. Use topK 6.",
  databaseConfig: {
    libsql: {
      minScore: 0.35,
    },
  },
});
