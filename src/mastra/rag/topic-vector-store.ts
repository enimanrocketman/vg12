import { LibSQLVector } from "@mastra/libsql";

import {
  TOPIC_INDEX_NAME,
  TOPIC_VECTOR_DB_URL,
  TOPIC_VECTOR_STORE_NAME,
} from "./config.js";

export const topicVectorStore = new LibSQLVector({
  id: TOPIC_VECTOR_STORE_NAME,
  url: TOPIC_VECTOR_DB_URL,
});

export async function describeTopicIndex() {
  try {
    return await topicVectorStore.describeIndex({ indexName: TOPIC_INDEX_NAME });
  } catch {
    return null;
  }
}
